-- Isolated database only; all fixture changes roll back.
begin;
do $probe$
declare
  v_event uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_stage uuid;
  v_close timestamptz := pg_catalog.clock_timestamp() - interval '1 hour';
  v_first jsonb;
  v_repeat jsonb;
  v_error text;
begin
  if has_function_privilege('anon',
      'public.recovery_void_missed_division_reveal(uuid,uuid)', 'EXECUTE') then
    raise exception 'Missed-reveal function is public';
  end if;
  select id into v_stage from public.stage_profiles order by id limit 1;
  if v_stage is null then raise exception 'Missing isolated stage fixture'; end if;
  insert into public.events(id, name, kind, gender, country_code,
    stage_profile_id, status, entry_fee, deadline, registration_deadline,
    tactics_deadline, scheduled_at, calendar_source, race_tier)
  values(v_event, 'Disposable missed-reveal probe', 'one_day', 'M', 'FR',
    v_stage, 'OPEN', 0, v_close, v_close,
    pg_catalog.clock_timestamp() + interval '1 hour',
    (date_trunc('week', pg_catalog.clock_timestamp() at time zone 'UTC')
      + interval '9 days 12 hours') at time zone 'UTC', 'PELOTONIA', 2);
  insert into public.recovery_autopilot_jobs(event_id, status, processed_count)
    values(v_event, 'COMPLETE', 2);
  begin
    perform public.recovery_void_missed_division_reveal(v_event, v_admin);
    raise exception 'Race cancelled before tactics closed';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'This race cannot be cancelled under the missed-reveal rule.' then raise; end if;
  end;
  update public.events set tactics_deadline = pg_catalog.clock_timestamp() - interval '1 minute'
    where id = v_event;
  update public.recovery_autopilot_jobs set status = 'PENDING' where event_id = v_event;
  begin
    perform public.recovery_void_missed_division_reveal(v_event, v_admin);
    raise exception 'Race cancelled before scan completed';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'The entry scan is not safely complete.' then raise; end if;
  end;
  update public.recovery_autopilot_jobs set status = 'COMPLETE' where event_id = v_event;
  update public.events set entry_fee = 1 where id = v_event;
  begin
    perform public.recovery_void_missed_division_reveal(v_event, v_admin);
    raise exception 'Paid race cancelled';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'This race cannot be cancelled under the missed-reveal rule.' then raise; end if;
  end;
  update public.events set entry_fee = 0 where id = v_event;
  v_first := public.recovery_void_missed_division_reveal(v_event, v_admin);
  if v_first->>'already_cancelled' is distinct from 'false'
    or v_first->>'reason' is distinct from 'MISSED_DIVISION_REVEAL'
    or (select status from public.events where id = v_event) <> 'CANCELLED'
    or not exists(select 1 from public.recovery_two_phase_voids
      where event_id = v_event and reason = 'MISSED_DIVISION_REVEAL'
        and processed_teams = 2 and registered_teams = 0) then
    raise exception 'Missed-reveal no-contest decision was not saved atomically';
  end if;
  v_repeat := public.recovery_void_missed_division_reveal(v_event, v_admin);
  if v_repeat->>'already_cancelled' is distinct from 'true'
    or (select count(*) from public.recovery_two_phase_voids
      where event_id = v_event) <> 1 then
    raise exception 'Missed-reveal retry was not idempotent';
  end if;
  if exists(select 1 from public.recovery_ranking_awards where event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals where event_id = v_event)
    or exists(select 1 from public.event_team_results where event_id = v_event) then
    raise exception 'No-contest race produced reveal, results or points';
  end if;
  -- A saved reveal makes this rule inapplicable even when tactics later expire.
  delete from public.recovery_two_phase_voids where event_id = v_event;
  update public.events set status = 'OPEN' where id = v_event;
  insert into public.recovery_division_reveals
    (event_id, season_year, gender, points_policy_version)
  values(v_event, extract(year from pg_catalog.clock_timestamp())::integer,
    'M', 'probe');
  begin
    perform public.recovery_void_missed_division_reveal(v_event, v_admin);
    raise exception 'Revealed race cancelled';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'The race has a reveal, saved result or paid entry.' then raise; end if;
  end;
end;
$probe$;
rollback;
