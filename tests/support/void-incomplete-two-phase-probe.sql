-- Isolated database only. Run in a transaction after the no-contest migration;
-- roll back the transaction after this probe, or use a disposable test event.
do $probe$
declare
  v_stage uuid;
  v_team uuid;
  v_owner uuid;
  v_event uuid := gen_random_uuid();
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
  v_scheduled timestamptz := (date_trunc('week', clock_timestamp() at time zone 'UTC')
    + interval '9 days 12 hours') at time zone 'UTC';
  v_first jsonb;
  v_repeat jsonb;
  v_error text;
begin
  if has_function_privilege('anon',
      'public.recovery_void_incomplete_two_phase_race(uuid,uuid)', 'EXECUTE')
    or has_table_privilege('authenticated',
      'public.recovery_two_phase_voids', 'SELECT') then
    raise exception 'No-contest privileges are too broad';
  end if;
  select id into v_stage from public.stage_profiles order by id limit 1;
  select id, user_id into v_team, v_owner from public.teams order by id limit 1;
  if v_stage is null or v_owner is null then
    raise exception 'Isolated fixtures missing';
  end if;
  insert into public.events(id, name, kind, gender, country_code,
    stage_profile_id, status, entry_fee, deadline, registration_deadline,
    tactics_deadline, scheduled_at, calendar_source, race_tier)
  values(v_event, 'Disposable no-contest probe', 'one_day', 'M', 'FR',
    v_stage, 'OPEN', 0, v_registration, v_registration,
    clock_timestamp() + interval '1 hour', v_scheduled, 'PELOTONIA', 2);
  insert into public.recovery_autopilot_jobs(event_id, status, processed_count)
    values(v_event, 'PENDING', 1);
  insert into public.event_teams(event_id, team_id) values(v_event, v_team);

  -- An administrator must not race an active worker to the cancellation.
  update public.recovery_autopilot_jobs
    set lease_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '2 minutes'
    where event_id = v_event;
  begin
    perform public.recovery_void_incomplete_two_phase_race(v_event, v_owner);
    raise exception 'Active scan was cancelled';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'The entry scan lease is still active.' then raise; end if;
  end;
  update public.recovery_autopilot_jobs
    set lease_token = null, lease_until = null where event_id = v_event;

  -- An unfinished scan cannot reveal, but an administrator can declare the
  -- opted-in zero-fee race a no-contest without awarding points.
  v_first := public.recovery_void_incomplete_two_phase_race(v_event, v_owner);
  if v_first->>'already_cancelled' is distinct from 'false'
    or v_first->>'registered_teams' is distinct from '1'
    or (select status from public.events where id = v_event) <> 'CANCELLED'
    or not exists(select 1 from public.recovery_two_phase_voids
      where event_id = v_event and reason = 'INCOMPLETE_ENTRY_SCAN'
        and registered_teams = 1 and processed_teams = 1) then
    raise exception 'No-contest decision was not saved atomically: %', v_first;
  end if;
  v_repeat := public.recovery_void_incomplete_two_phase_race(v_event, v_owner);
  if v_repeat->>'already_cancelled' is distinct from 'true'
    or (select count(*) from public.recovery_two_phase_voids
      where event_id = v_event) <> 1 then
    raise exception 'No-contest retry was not idempotent: %', v_repeat;
  end if;
  begin
    perform public.recovery_commit_division_reveal(v_event);
    raise exception 'Cancelled race revealed divisions';
  exception when sqlstate 'PT409' then null;
  end;
  if exists(select 1 from public.recovery_ranking_awards
      where event_id = v_event)
    or exists(select 1 from public.event_team_results where event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals
      where event_id = v_event) then
    raise exception 'No-contest race produced results or points';
  end if;

  -- A finished entry scan is never eligible for this rule.
  update public.events set status = 'OPEN' where id = v_event;
  delete from public.recovery_two_phase_voids where event_id = v_event;
  update public.recovery_autopilot_jobs set status = 'COMPLETE' where event_id = v_event;
  begin
    perform public.recovery_void_incomplete_two_phase_race(v_event, v_owner);
    raise exception 'Completed scan was cancelled';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'The race has a completed scan, saved result or paid entry.' then raise; end if;
  end;
end;
$probe$;
