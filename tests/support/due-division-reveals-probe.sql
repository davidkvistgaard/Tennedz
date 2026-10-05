-- Run only against the isolated project after select_unrevealed_divisions_for_cron.
-- The PZ001 exception rolls back every disposable event and queue row.
do $probe$
declare
  v_stage uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_event uuid;
  v_index integer;
  v_due timestamptz := clock_timestamp() - interval '1 hour';
  v_candidates uuid[];
  v_ready integer;
begin
  if has_function_privilege('anon',
      'public.recovery_due_division_reveals(timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role',
      'public.recovery_due_division_reveals(timestamptz)', 'EXECUTE') then
    raise exception 'Due-reveal selector grants are incorrect.';
  end if;
  select id into v_stage from public.stage_profiles order by id limit 1;
  if v_stage is null then raise exception 'An isolated route fixture is required.'; end if;

  begin
    for v_index in 1..25 loop
      v_event := gen_random_uuid();
      v_ids := array_append(v_ids, v_event);
      insert into public.events(id, name, kind, gender, country_code,
        stage_profile_id, status, entry_fee, deadline,
        registration_deadline, tactics_deadline, scheduled_at,
        calendar_source, race_tier)
      values(v_event, format('Disposable due-reveal probe %s', v_index),
        'one_day', 'M', 'FR', v_stage, 'OPEN', 0,
        v_due, v_due, clock_timestamp() + interval '1 hour',
        clock_timestamp() + interval '2 hours', 'PELOTONIA', 2);
      insert into public.recovery_autopilot_jobs(event_id, status)
        values(v_event, 'COMPLETE');
      if v_index <= 20 then
        insert into public.recovery_division_reveals
          (event_id, season_year, gender, points_policy_version)
        values(v_event, extract(year from clock_timestamp())::integer,
          'M', 'probe');
      end if;
    end loop;

    select array_agg(c.event_id order by c.event_id) into v_candidates
      from public.recovery_due_division_reveals(clock_timestamp()) c
      where c.event_id = any(v_ids);
    if v_candidates is distinct from
      (select array_agg(x order by x) from unnest(v_ids[21:25]) x) then
      raise exception 'Saved reveals starved later races: %', v_candidates;
    end if;

    delete from public.recovery_division_reveals
      where event_id = any(v_ids[1:20]);
    update public.recovery_autopilot_jobs set status = 'PENDING'
      where event_id = any(v_ids[1:20]);
    select count(*) into v_ready
      from public.recovery_due_division_reveals(clock_timestamp()) c
      where c.event_id = any(v_ids[21:25]) and c.autopilot_complete;
    if v_ready <> 5 then
      raise exception 'Pending scans starved ready races: %', v_ready;
    end if;

    raise sqlstate 'PZ001' using message = 'Rollback due-reveal probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.events where id = any(v_ids))
    or exists(select 1 from public.recovery_autopilot_jobs
      where event_id = any(v_ids))
    or exists(select 1 from public.recovery_division_reveals
      where event_id = any(v_ids)) then
    raise exception 'Due-reveal probe left persistent rows.';
  end if;
end;
$probe$;
