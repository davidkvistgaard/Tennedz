-- Run only against the isolated project after select_overdue_unrevealed_divisions.
-- The PZ001 exception rolls back all disposable events and reveals.
do $probe$
declare
  v_stage uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_event uuid;
  v_missing uuid;
  v_index integer;
  v_closed timestamptz := clock_timestamp() - interval '1 hour';
begin
  if has_function_privilege('anon',
      'public.recovery_overdue_division_reveals(timestamptz)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_overdue_division_reveals(timestamptz)', 'EXECUTE')
    or not has_function_privilege('service_role',
      'public.recovery_overdue_division_reveals(timestamptz)', 'EXECUTE') then
    raise exception 'Overdue-reveal selector grants are incorrect.';
  end if;
  select id into v_stage from public.stage_profiles order by id limit 1;
  if v_stage is null then raise exception 'An isolated route fixture is required.'; end if;

  begin
    for v_index in 1..106 loop
      v_event := gen_random_uuid();
      v_ids := array_append(v_ids, v_event);
      insert into public.events(id, name, kind, gender, country_code,
        stage_profile_id, status, entry_fee, deadline,
        registration_deadline, tactics_deadline, scheduled_at,
        calendar_source, race_tier)
      values(v_event, format('Disposable overdue-reveal probe %s', v_index),
        'one_day', 'M', 'FR', v_stage, 'OPEN', 0,
        v_closed, v_closed, v_closed + interval '30 minutes',
        clock_timestamp() + interval '1 hour', 'PELOTONIA', 2);
      if v_index <= 105 then
        insert into public.recovery_division_reveals
          (event_id, season_year, gender, points_policy_version)
        values(v_event, extract(year from clock_timestamp())::integer,
          'M', 'probe');
      else
        v_missing := v_event;
      end if;
    end loop;

    if not exists(select 1 from public.recovery_overdue_division_reveals(
        clock_timestamp()) where event_id = v_missing) then
      raise exception 'Saved reveals hid an overdue race.';
    end if;
    if exists(select 1 from public.recovery_overdue_division_reveals(
        clock_timestamp()) where event_id = any(v_ids[1:105])) then
      raise exception 'A saved reveal was reported overdue.';
    end if;

    raise sqlstate 'PZ001' using message = 'Rollback overdue-reveal probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.events where id = any(v_ids))
    or exists(select 1 from public.recovery_division_reveals
      where event_id = any(v_ids)) then
    raise exception 'Overdue-reveal probe left persistent rows.';
  end if;
end;
$probe$;
