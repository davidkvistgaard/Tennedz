-- Isolated database only. A claim transaction begins while registration is open,
-- then crosses the deadline before invoking the claim RPC. Always roll back.
begin;
do $probe$
declare
  v_event uuid := gen_random_uuid();
  v_close timestamptz := pg_catalog.clock_timestamp() + interval '1 second';
  v_stage uuid;
  v_claim jsonb;
begin
  select id into v_stage from public.stage_profiles order by id limit 1;
  if v_stage is null then raise exception 'Missing isolated stage fixture'; end if;
  insert into public.events(id, name, kind, gender, country_code,
    stage_profile_id, status, entry_fee, deadline, registration_deadline,
    tactics_deadline, scheduled_at, calendar_source, race_tier)
  values(v_event, 'Disposable stale-claim probe', 'one_day', 'M', 'FR',
    v_stage, 'OPEN', 0, v_close, v_close,
    pg_catalog.clock_timestamp() + interval '1 hour',
    (date_trunc('week', pg_catalog.clock_timestamp() at time zone 'UTC')
      + interval '9 days 12 hours') at time zone 'UTC', 'PELOTONIA', 2);
  perform pg_catalog.pg_sleep(2);
  if pg_catalog.clock_timestamp() <= v_close then
    raise exception 'Probe did not cross registration close';
  end if;
  v_claim := public.recovery_autopilot_claim_job(gen_random_uuid());
  if v_claim is not null then
    raise exception 'Claim acquired an expired race: %', v_claim;
  end if;
  if exists(select 1 from public.recovery_autopilot_jobs where event_id = v_event) then
    raise exception 'Expired race acquired an autopilot job';
  end if;
end;
$probe$;
rollback;
