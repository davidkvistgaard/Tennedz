-- PostgreSQL has no min(uuid); preserve the unique team-link check.
begin;
create or replace function public.recovery_save_v2_tactics_draft(
  p_user uuid, p_event uuid, p_orders jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_team_id uuid;
  v_team_count integer;
  v_entry public.event_teams;
  v_helper text;
  v_saved_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select count(*), (array_agg(t.id))[1] into v_team_count, v_team_id
    from public.teams t where t.user_id = p_user;
  if v_team_count <> 1 then
    raise sqlstate 'PT409' using message = 'The team link is not unique.';
  end if;
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  if v_event.kind is distinct from 'one_day'
    or v_event.status is distinct from 'OPEN'
    or v_event.registration_deadline is null
    or v_event.registration_deadline > pg_catalog.clock_timestamp()
    or v_event.tactics_deadline <= pg_catalog.clock_timestamp()
    or exists(select 1 from public.recovery_tactics_commits c
      where c.event_id = p_event)
    or exists(select 1 from public.recovery_race_commits c
      where c.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'This race is outside tactics preparation.';
  end if;
  select * into v_entry from public.event_teams e
    where e.event_id = p_event and e.team_id = v_team_id for update;
  if v_entry.id is null or not exists(
    select 1 from public.recovery_division_reveal_entries r
      where r.event_id = p_event and r.team_id = v_team_id) then
    raise sqlstate 'PT403' using message = 'This team is not in the revealed race.';
  end if;
  if v_entry.selected_riders is null or cardinality(v_entry.selected_riders) <> 8
    or (select count(distinct rider_id) from unnest(v_entry.selected_riders) rider_id) <> 8
    or v_entry.captain_id is null
    or not (v_entry.captain_id = any(v_entry.selected_riders)) then
    raise sqlstate 'PT409' using message = 'The saved entry lineup is incomplete.';
  end if;
  if p_orders is null or jsonb_typeof(p_orders) is distinct from 'object'
    or pg_catalog.octet_length(p_orders::text) > 16384 then
    raise sqlstate 'PT400' using message = 'Invalid v2 race orders.';
  end if;
  if p_orders->'version' is distinct from '2'::jsonb
    or p_orders->>'captainId' is distinct from v_entry.captain_id::text
    or not coalesce(p_orders->>'roadCaptainId' = any(v_entry.selected_riders::text[]), false)
    or jsonb_typeof(p_orders->'helperIds') is distinct from 'array'
    or jsonb_typeof(p_orders->'baseline') is distinct from 'object'
    or jsonb_typeof(p_orders->'phases') is distinct from 'array' then
    raise sqlstate 'PT400' using message = 'Invalid v2 race orders.';
  end if;
  if jsonb_array_length(p_orders->'helperIds') > 8
    or jsonb_array_length(p_orders->'phases') > 40 then
    raise sqlstate 'PT400' using message = 'Invalid v2 race orders.';
  end if;
  for v_helper in select jsonb_array_elements_text(p_orders->'helperIds') loop
    if not (v_helper = any(v_entry.selected_riders::text[]))
      or v_helper = p_orders->>'captainId'
      or v_helper = p_orders->>'roadCaptainId' then
      raise sqlstate 'PT400' using message = 'Invalid v2 helpers.';
    end if;
  end loop;
  if (select count(*) from jsonb_array_elements_text(p_orders->'helperIds')) <>
    (select count(distinct h.value)
      from jsonb_array_elements_text(p_orders->'helperIds') as h(value)) then
    raise sqlstate 'PT400' using message = 'Invalid v2 helpers.';
  end if;
  insert into public.recovery_v2_tactics_drafts
    (event_id, team_id, selected_riders, captain_id, orders, saved_at)
  values (p_event, v_team_id, v_entry.selected_riders, v_entry.captain_id,
    p_orders, pg_catalog.clock_timestamp())
  on conflict (event_id, team_id) do update
    set selected_riders = excluded.selected_riders,
      captain_id = excluded.captain_id,
      orders = excluded.orders,
      saved_at = excluded.saved_at
  returning saved_at into v_saved_at;
  return jsonb_build_object('ok', true, 'event_id', p_event,
    'team_id', v_team_id, 'saved_at', v_saved_at,
    'orders_version', 2);
end;
$$;
commit;
