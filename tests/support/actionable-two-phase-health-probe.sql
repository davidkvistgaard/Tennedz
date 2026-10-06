-- Run only against the allowlisted isolated project after the health selector.
-- All inserted rows are rolled back by the caught PZ001 exception.
do $probe$
declare
  v_stage uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_event uuid;
  v_missing uuid;
  v_active uuid;
  v_index integer;
  v_now timestamptz := clock_timestamp();
begin
  if has_function_privilege('anon',
      'public.recovery_actionable_two_phase_health(timestamptz)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_actionable_two_phase_health(timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role',
      'public.recovery_actionable_two_phase_health(timestamptz)', 'EXECUTE') then
    raise exception 'Actionable health selector grants are incorrect.';
  end if;
  select id into v_stage from public.stage_profiles order by id limit 1;
  if v_stage is null then raise exception 'An isolated route fixture is required.'; end if;

  begin
    for v_index in 1..107 loop
      v_event := gen_random_uuid();
      v_ids := array_append(v_ids, v_event);
      insert into public.events(id, name, kind, gender, country_code,
        stage_profile_id, status, entry_fee, deadline,
        registration_deadline, tactics_deadline, scheduled_at,
        calendar_source, race_tier)
      values(v_event, format('Disposable health selector %s', v_index),
        'one_day', 'M', 'FR', v_stage, 'OPEN', 0,
        v_now - interval '1 hour', v_now - interval '1 hour',
        case when v_index = 107 then v_now + interval '1 hour'
          else v_now - interval '30 minutes' end,
        v_now + interval '1 day', 'PELOTONIA', 2);
      if v_index <> 106 then
        insert into public.recovery_division_reveals
          (event_id, season_year, gender, points_policy_version)
        values(v_event, extract(year from v_now)::integer, 'M', 'probe');
      end if;
      if v_index = 106 then v_missing := v_event; end if;
      if v_index = 107 then v_active := v_event; end if;
    end loop;

    if not exists(select 1 from public.recovery_actionable_two_phase_health(v_now)
        where id = v_missing) then
      raise exception 'Old revealed races hid an actionable race.';
    end if;
    if not exists(select 1 from public.recovery_actionable_two_phase_health(v_now)
        where id = v_active) then
      raise exception 'An active revealed race disappeared from health.';
    end if;
    if exists(select 1 from public.recovery_actionable_two_phase_health(v_now)
        where id = any(v_ids[1:105])) then
      raise exception 'Old revealed races still filled the health scan.';
    end if;

    raise sqlstate 'PZ001' using message = 'Rollback health selector probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.events where id = any(v_ids))
    or exists(select 1 from public.recovery_division_reveals
      where event_id = any(v_ids)) then
    raise exception 'Health selector probe left persistent rows.';
  end if;
end;
$probe$;
