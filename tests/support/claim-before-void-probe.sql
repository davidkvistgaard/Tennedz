-- Isolated database only. The whole fixture and all results roll back.
-- A real claim before registration close must block no-contest while its lease
-- is active; only an expired lease can make the incomplete scan reviewable.
begin;
do $probe$
declare
  v_stage uuid;
  v_admin uuid;
  v_event uuid := gen_random_uuid();
  v_token uuid := gen_random_uuid();
  v_registration timestamptz := clock_timestamp() + interval '1 minute';
  v_scheduled timestamptz := (date_trunc('week', clock_timestamp() at time zone 'UTC')
    + interval '9 days 12 hours') at time zone 'UTC';
  v_claim jsonb;
  v_void jsonb;
  v_error text;
begin
  if exists(select 1 from public.recovery_autopilot_jobs)
    or exists(select 1 from public.events
      where kind = 'one_day' and status = 'OPEN'
        and calendar_source in ('UCI', 'PELOTONIA')
        and deadline > clock_timestamp()
        and deadline <= clock_timestamp() + interval '48 hours') then
    raise exception 'The isolated database has another claimable race';
  end if;
  select id into v_stage from public.stage_profiles order by id limit 1;
  select user_id into v_admin from public.teams order by id limit 1;
  if v_stage is null or v_admin is null then
    raise exception 'Isolated fixtures missing';
  end if;
  insert into public.events(id, name, kind, gender, country_code,
    stage_profile_id, status, entry_fee, deadline, registration_deadline,
    tactics_deadline, scheduled_at, calendar_source, race_tier)
  values(v_event, 'Disposable claim-before-void probe', 'one_day', 'M', 'FR',
    v_stage, 'OPEN', 0, v_registration, v_registration,
    clock_timestamp() + interval '1 hour', v_scheduled, 'PELOTONIA', 2);

  v_claim := public.recovery_autopilot_claim_job(v_token);
  if v_claim->>'event_id' is distinct from v_event::text
    or not exists(select 1 from public.recovery_autopilot_jobs
      where event_id = v_event and lease_token = v_token
        and lease_until > clock_timestamp()) then
    raise exception 'The expected race was not leased: %', v_claim;
  end if;

  -- Advance only this disposable race to its registration close. The actual
  -- worker lease remains live, so an administrator cannot cancel it yet.
  v_registration := clock_timestamp() - interval '1 second';
  update public.events set deadline = v_registration,
    registration_deadline = v_registration
    where id = v_event;
  begin
    perform public.recovery_void_incomplete_two_phase_race(v_event, v_admin);
    raise exception 'An active claimed scan was cancelled';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_error = message_text;
    if v_error <> 'The entry scan lease is still active.' then raise; end if;
  end;
  if (select status from public.events where id = v_event) <> 'OPEN'
    or exists(select 1 from public.recovery_two_phase_voids
      where event_id = v_event) then
    raise exception 'Rejected cancellation modified the race';
  end if;

  -- Model an abandoned worker after its lease expires. The explicit decision
  -- may now be recorded, without changing the saved scan counts or entries.
  update public.recovery_autopilot_jobs
    set lease_until = clock_timestamp() - interval '1 second'
    where event_id = v_event;
  v_void := public.recovery_void_incomplete_two_phase_race(v_event, v_admin);
  if v_void->>'already_cancelled' is distinct from 'false'
    or (select status from public.events where id = v_event) <> 'CANCELLED'
    or (select count(*) from public.recovery_two_phase_voids
      where event_id = v_event and reason = 'INCOMPLETE_ENTRY_SCAN') <> 1
    or exists(select 1 from public.recovery_ranking_awards
      where event_id = v_event) then
    raise exception 'Expired claimed scan did not record a clean no-contest: %', v_void;
  end if;
end;
$probe$;
rollback;
