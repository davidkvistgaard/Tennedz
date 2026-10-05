-- Isolated test project only. Every fixture write rolls back in a subtransaction.
-- Proves a missed entry-scan deadline cannot silently admit a late team or reveal.
do $probe$
declare
  v_event uuid := gen_random_uuid();
  v_stage uuid;
  v_owner uuid;
  v_claim jsonb;
  v_error text;
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
  v_scheduled timestamptz := (date_trunc('week', clock_timestamp() at time zone 'UTC')
    + interval '9 days 12 hours') at time zone 'UTC';
begin
  select id into v_stage from public.stage_profiles order by id limit 1;
  select user_id into v_owner from public.teams order by id limit 1;
  if v_stage is null or v_owner is null then
    raise exception 'Isolated fixtures missing';
  end if;

  begin
    insert into public.events(id, name, kind, gender, country_code,
      stage_profile_id, status, entry_fee, deadline, registration_deadline,
      tactics_deadline, scheduled_at, calendar_source, race_tier)
    values(v_event, 'Disposable missed-deadline probe', 'one_day', 'M',
      'FR', v_stage, 'OPEN', 0, v_registration, v_registration,
      clock_timestamp() + interval '1 hour', v_scheduled, 'PELOTONIA', 2);
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'PENDING');

    v_claim := public.recovery_autopilot_claim_job(gen_random_uuid());
    if v_claim->>'event_id' = v_event::text then
      raise exception 'Expired race was claimed';
    end if;

    begin
      perform public.recovery_commit_division_reveal(v_event);
      raise exception 'Incomplete scan was revealed';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_error = message_text;
      if v_error <> 'The autopilot entry scan is incomplete.' then raise; end if;
    end;

    -- The atomic join rejects the deadline before inspecting the invalid
    -- lineup, which is also the final write path used by autopilot.
    begin
      perform public.recovery_join_event(v_owner, v_event, '{}'::uuid[], null);
      raise exception 'Late entry was accepted';
    exception when sqlstate 'PT409' then null;
    end;

    if exists(select 1 from public.event_teams where event_id = v_event)
      or exists(select 1 from public.recovery_division_reveals
        where event_id = v_event) then
      raise exception 'Late entry or reveal persisted';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback missed-deadline fixture';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.events where id = v_event)
    or exists(select 1 from public.recovery_autopilot_jobs
      where event_id = v_event) then
    raise exception 'Missed-deadline fixture remained';
  end if;
end;
$probe$;
select 'PASS: missed deadline blocks claim, reveal and entry; fixture rolled back' result;
