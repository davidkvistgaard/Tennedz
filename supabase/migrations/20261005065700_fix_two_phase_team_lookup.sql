-- Repair the team lookup: PostgreSQL has no min(uuid) aggregate.
-- Opted-in two-phase races may revise an existing entry after the division
-- reveal. This never creates an entry or charges a second fee. Legacy joins
-- and their original deadline remain unchanged.
begin;

create or replace function public.recovery_edit_revealed_tactics(
  p_user uuid, p_event uuid, p_riders uuid[], p_captain uuid, p_orders jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_team_id uuid;
  v_team_count integer;
  v_game_date date;
  v_valid_riders integer;
  v_item record;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select count(*) into v_team_count
    from public.teams t where t.user_id = p_user;
  if v_team_count <> 1 then
    raise sqlstate 'PT409' using message = 'The team link is not unique.';
  end if;
  select t.id into v_team_id from public.teams t
    where t.user_id = p_user limit 1;
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  if v_event.registration_deadline is null
    or v_event.status is distinct from 'OPEN'
    or v_event.registration_deadline > pg_catalog.clock_timestamp()
    or v_event.tactics_deadline <= pg_catalog.clock_timestamp()
    or not exists(select 1 from public.recovery_division_reveal_entries x
      where x.event_id = p_event and x.team_id = v_team_id)
    or exists(select 1 from public.recovery_race_commits c
      where c.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'This team is outside the tactics preparation phase.';
  end if;
  if not exists(select 1 from public.event_teams et
    where et.event_id = p_event and et.team_id = v_team_id) then
    raise sqlstate 'PT409' using message = 'This team has not entered the race.';
  end if;
  if p_riders is null or cardinality(p_riders) <> 8 or p_captain is null
    or not (p_captain = any(p_riders))
    or (select count(distinct x) from unnest(p_riders) x) <> 8 then
    raise sqlstate 'PT400' using message = 'Select eight distinct riders and their captain.';
  end if;
  select game_date into v_game_date from public.game_state where id = 1;
  if v_game_date is null then
    raise sqlstate 'PT409' using message = 'The game date is unavailable.';
  end if;
  select count(distinct r.id) into v_valid_riders
    from public.riders r
    join public.team_riders tr on tr.rider_id = r.id
    where tr.team_id = v_team_id and r.id = any(p_riders)
      and r.gender = v_event.gender
      and (r.injury_until is null or r.injury_until <= v_game_date);
  if v_valid_riders <> 8 then
    raise sqlstate 'PT400' using message = 'Riders must belong to this team and race category and be injury-free.';
  end if;

  if p_orders is null or jsonb_typeof(p_orders) is distinct from 'object'
    or p_orders->'version' is distinct from '1'::jsonb
    or coalesce(p_orders->>'plan', '') not in
      ('balanced', 'captain', 'breakaway', 'conserve')
    or jsonb_typeof(p_orders->'riders') is distinct from 'object' then
    raise sqlstate 'PT400' using message = 'Invalid race orders.';
  end if;
  if (select count(*) from jsonb_object_keys(p_orders)) <> 3
    or (select count(*) from jsonb_object_keys(p_orders->'riders')) <> 8 then
    raise sqlstate 'PT400' using message = 'Invalid race orders.';
  end if;
  for v_item in select * from jsonb_each(p_orders->'riders') loop
    if not coalesce(v_item.key = any(p_riders::text[]), false)
      or jsonb_typeof(v_item.value) is distinct from 'object' then
      raise sqlstate 'PT400' using message = 'Invalid race orders.';
    end if;
    if (select count(*) from jsonb_object_keys(v_item.value)) <> 2
      or coalesce(v_item.value->>'effort', '') not in
        ('careful', 'balanced', 'aggressive')
      or (v_item.key = p_captain::text
        and v_item.value->>'role' is distinct from 'captain')
      or (v_item.key <> p_captain::text
        and coalesce(v_item.value->>'role', '') not in
          ('free', 'helper', 'attacker')) then
      raise sqlstate 'PT400' using message = 'Invalid race orders.';
    end if;
  end loop;

  update public.event_teams et
    set selected_riders = p_riders, captain_id = p_captain, orders = p_orders
    where et.event_id = p_event and et.team_id = v_team_id;
  return jsonb_build_object('ok', true, 'event_id', p_event,
    'team_id', v_team_id, 'phase', 'preparation');
end;
$$;
revoke all on function public.recovery_edit_revealed_tactics(
  uuid, uuid, uuid[], uuid, jsonb) from public, anon, authenticated;
grant execute on function public.recovery_edit_revealed_tactics(
  uuid, uuid, uuid[], uuid, jsonb) to service_role;
commit;
