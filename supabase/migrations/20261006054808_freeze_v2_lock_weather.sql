-- Require a fixed weather object in the immutable v2 input. The legacy
-- event and its weather field remain untouched.
begin;

alter table public.recovery_v2_tactics_commits
  add constraint recovery_v2_locked_weather check (
    jsonb_typeof(input_snapshot->'event'->'weather_locked') = 'object');

create function public.recovery_commit_v2_tactics_lock(p_event uuid, p_weather jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_commit public.recovery_v2_tactics_commits;
  v_entry_count integer;
  v_reveal_count integer;
  v_draft_count integer;
  v_reveal jsonb;
  v_orders jsonb;
  v_snapshot jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  if v_event.registration_deadline is null then
    raise sqlstate 'PT409' using message = 'This race does not use a v2 tactics lock.';
  end if;
  select * into v_commit from public.recovery_v2_tactics_commits c
    where c.event_id = p_event;
  if v_commit.event_id is not null then
    return jsonb_build_object('eventId', p_event,
      'lockedAt', v_commit.locked_at,
      'inputSnapshot', v_commit.input_snapshot, 'alreadyLocked', true);
  end if;
  if v_event.kind is distinct from 'one_day'
    or v_event.status is distinct from 'OPEN'
    or v_event.registration_deadline > pg_catalog.clock_timestamp()
    or v_event.tactics_deadline > pg_catalog.clock_timestamp()
    or exists(select 1 from public.recovery_race_commits c
      where c.event_id = p_event)
    or exists(select 1 from public.event_division_runs d
      where d.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'The v2 tactics lock is outside its phase.';
  end if;
  if not exists(select 1 from public.recovery_division_reveals r
      where r.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'The division reveal must finish before v2 tactics lock.';
  end if;
  select count(*) into v_entry_count from public.event_teams et
    where et.event_id = p_event;
  select count(*) into v_reveal_count from public.recovery_division_reveal_entries r
    where r.event_id = p_event;
  select count(*) into v_draft_count from public.recovery_v2_tactics_drafts d
    where d.event_id = p_event;
  if v_entry_count < 2 or v_entry_count > 400
    or v_entry_count <> v_reveal_count
    or v_entry_count <> v_draft_count
    or exists(select 1 from public.event_teams et
      left join public.recovery_v2_tactics_drafts d
        on d.event_id = et.event_id and d.team_id = et.team_id
      where et.event_id = p_event
        and (d.team_id is null
          or d.selected_riders is distinct from et.selected_riders
          or d.captain_id is distinct from et.captain_id
          or d.orders->>'captainId' is distinct from et.captain_id::text)) then
    raise sqlstate 'PT409' using message = 'The v2 tactics drafts do not cover the revealed lineups.';
  end if;

  if p_weather is null or jsonb_typeof(p_weather) is distinct from 'object'
    or jsonb_typeof(p_weather->'temp_c') is distinct from 'number'
    or jsonb_typeof(p_weather->'wind_kph') is distinct from 'number'
    or jsonb_typeof(p_weather->'precipitation_mm') is distinct from 'number'
    or coalesce(p_weather->>'source', '') = '' then
    raise sqlstate 'PT400' using message = 'Valid locked v2 weather is required.';
  end if;
  if (p_weather->>'temp_c')::numeric not between -50 and 60
    or (p_weather->>'wind_kph')::numeric not between 0 and 200
    or (p_weather->>'precipitation_mm')::numeric not between 0 and 500
    or (v_event.weather_locked is not null
      and p_weather is distinct from v_event.weather_locked) then
    raise sqlstate 'PT400' using message = 'Valid locked v2 weather is required.';
  end if;

  v_reveal := public.recovery_commit_division_reveal(p_event)
    - 'alreadyRevealed';
  select jsonb_object_agg(d.team_id::text, d.orders) into v_orders
    from public.recovery_v2_tactics_drafts d where d.event_id = p_event;
  v_snapshot := public.recovery_race_snapshot(p_event)
    || jsonb_build_object('locked_division_reveal', v_reveal,
      'v2_input_version', 1, 'v2_orders_by_team_id', v_orders);
  v_snapshot := jsonb_set(v_snapshot, '{event,weather_locked}', p_weather, true);
  if jsonb_typeof(v_snapshot->'teams') is distinct from 'array'
    or jsonb_array_length(v_snapshot->'teams') <> v_entry_count then
    raise sqlstate 'PT409' using message = 'The final v2 race input is incomplete.';
  end if;
  insert into public.recovery_v2_tactics_commits(event_id, input_snapshot)
    values(p_event, v_snapshot);
  select * into v_commit from public.recovery_v2_tactics_commits c
    where c.event_id = p_event;
  return jsonb_build_object('eventId', p_event,
    'lockedAt', v_commit.locked_at,
    'inputSnapshot', v_commit.input_snapshot, 'alreadyLocked', false);
end;
$$;
drop function public.recovery_commit_v2_tactics_lock(uuid);
revoke all on function public.recovery_commit_v2_tactics_lock(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.recovery_commit_v2_tactics_lock(uuid, jsonb)
  to service_role;
commit;
