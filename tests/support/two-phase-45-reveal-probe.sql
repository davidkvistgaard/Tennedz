-- Run only in the allowlisted isolated Supabase test project. The nested
-- PZ001 exception rolls back every fixture row before this statement ends.
do $probe$
declare
  v_owner uuid;
  v_stage uuid;
  v_event uuid := gen_random_uuid();
  v_registration timestamptz := clock_timestamp() + interval '2 hours';
  v_tactics timestamptz := clock_timestamp() + interval '3 hours';
  v_scheduled timestamptz := clock_timestamp() + interval '4 hours';
  v_team uuid;
  v_rider uuid;
  v_selected uuid[];
  v_orders jsonb;
  v_reveal jsonb;
  v_lock jsonb;
  v_sizes integer[];
  v_index integer;
  v_rider_index integer;
begin
  select user_id into v_owner from public.teams order by id limit 1;
  select id into v_stage from public.stage_profiles
    where distance_km between 20 and 400 order by id limit 1;
  if v_owner is null or v_stage is null then
    raise exception 'The isolated project needs an existing fixture owner and route.';
  end if;

  begin
    insert into public.events(id, name, kind, gender, country_code,
      stage_profile_id, status, entry_fee, deadline,
      registration_deadline, tactics_deadline, scheduled_at,
      calendar_source, race_tier)
    values(v_event, 'Rollback-only 45-team two-phase probe', 'one_day',
      'M', 'FR', v_stage, 'OPEN', 0,
      v_registration, v_registration, v_tactics,
      v_scheduled, 'PELOTONIA', 2);

    for v_index in 1..45 loop
      v_team := gen_random_uuid();
      insert into public.teams(id, user_id, name)
        values(v_team, v_owner, format('Two-phase probe team %s', v_index));
      v_selected := '{}'::uuid[];
      for v_rider_index in 1..8 loop
        v_rider := gen_random_uuid();
        insert into public.riders(id, name, gender, sprint, flat, hills,
          mountain, cobbles, timetrial, leadership, endurance, moral, luck,
          wind, form, strength)
        values(v_rider, format('Probe rider %s-%s', v_index, v_rider_index),
          'M', 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 50, 40);
        insert into public.team_riders(team_id, rider_id) values(v_team, v_rider);
        v_selected := array_append(v_selected, v_rider);
      end loop;
      select jsonb_object_agg(rider_id::text,
        jsonb_build_object('role', case when rider_id = v_selected[1]
          then 'captain' else 'free' end, 'effort', 'balanced'))
        into v_orders from unnest(v_selected) rider_id;
      insert into public.event_teams(event_id, team_id, selected_riders,
        captain_id, orders)
      values(v_event, v_team, v_selected, v_selected[1],
        jsonb_build_object('version', 1, 'plan', 'balanced',
          'riders', v_orders));
    end loop;

    v_registration := clock_timestamp() - interval '2 hours';
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours'
      where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    v_reveal := public.recovery_commit_division_reveal(v_event);
    if v_reveal->>'alreadyRevealed' <> 'false'
      or jsonb_array_length(v_reveal->'assignments') <> 45 then
      raise exception 'The 45-team division reveal was incomplete.';
    end if;
    select array_agg(n order by division_index) into v_sizes from (
      select division_index, count(*)::integer n
      from public.recovery_division_reveal_entries
      where event_id = v_event group by division_index
    ) divisions;
    if v_sizes is distinct from array[15,15,15] then
      raise exception 'Expected three balanced divisions, found %.', v_sizes;
    end if;
    if exists (
      select 1 from (
        select seed_rank, team_id, row_number() over (order by team_id) natural_rank
        from public.recovery_division_reveal_entries where event_id = v_event
      ) ranks where seed_rank <> natural_rank
    ) then
      raise exception 'Equal-point entrants did not use a stable team-ID tie-break.';
    end if;

    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;
    v_lock := public.recovery_commit_tactics_lock(v_event);
    if v_lock->>'alreadyLocked' <> 'false'
      or jsonb_array_length(v_lock->'inputSnapshot'->'teams') <> 45
      or jsonb_array_length(v_lock->'inputSnapshot'
        ->'locked_division_reveal'->'assignments') <> 45 then
      raise exception 'The 45-team final tactics input was incomplete.';
    end if;
    if (public.recovery_commit_tactics_lock(v_event)->>'alreadyLocked') <> 'true'
      or (public.recovery_commit_division_reveal(v_event)->>'alreadyRevealed') <> 'true'
      or (select count(*) from public.recovery_division_reveal_entries
        where event_id = v_event) <> 45 then
      raise exception 'A retry changed the persisted reveal or tactics lock.';
    end if;

    raise sqlstate 'PZ001' using message = 'Rollback 45-team probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.events where id = v_event)
    or exists(select 1 from public.recovery_division_reveals where event_id = v_event)
    or exists(select 1 from public.recovery_tactics_commits where event_id = v_event) then
    raise exception 'The 45-team probe left persistent rows.';
  end if;
end;
$probe$;
