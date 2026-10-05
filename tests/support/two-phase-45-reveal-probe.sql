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
  v_snapshot jsonb;
  v_output jsonb;
  v_divisions jsonb := '[]'::jsonb;
  v_team_rows jsonb;
  v_rider_rows jsonb;
  v_roster jsonb;
  v_team_record record;
  v_rider_record record;
  v_result jsonb;
  v_sizes integer[];
  v_index integer;
  v_rider_index integer;
  v_position integer;
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

    -- Exercise the existing atomic result writer with three complete synthetic
    -- replay divisions. The JavaScript simulation is tested separately.
    v_snapshot := public.recovery_race_snapshot(v_event);
    for v_index in 1..3 loop
      v_team_rows := '[]'::jsonb;
      v_rider_rows := '[]'::jsonb;
      v_roster := '[]'::jsonb;
      v_position := 0;
      for v_team_record in
        select r.team_id, x.bundle
        from public.recovery_division_reveal_entries r
        cross join lateral (
          select value bundle from jsonb_array_elements(v_snapshot->'teams')
          where (value->>'id')::uuid = r.team_id
        ) x
        where r.event_id = v_event and r.division_index = v_index
        order by r.seed_rank
      loop
        v_position := v_position + 1;
        v_team_rows := v_team_rows || jsonb_build_array(jsonb_build_object(
          'team_id', v_team_record.team_id,
          'captain_id', v_team_record.bundle->'entry'->>'captain_id',
          'position', v_position, 'time_sec', 10000 + v_position * 100,
          'points', case when v_position = 1 then 100 else 85 end,
          'seed_power', 50));
        for v_rider_record in
          select value rider, ordinal::integer rider_index
          from jsonb_array_elements(v_team_record.bundle->'entry'
            ->'selected_riders') with ordinality as x(value, ordinal)
        loop
          v_rider_index := (v_position - 1) * 8 + v_rider_record.rider_index;
          v_rider_rows := v_rider_rows || jsonb_build_array(jsonb_build_object(
            'rider_id', v_rider_record.rider #>> '{}',
            'team_id', v_team_record.team_id,
            'position', v_rider_index,
            'time_sec', 10000 + v_rider_index * 10,
            'points', 1,
            'after', jsonb_build_object('fatigue', 20, 'form', 50,
              'injury_until', null)));
          v_roster := v_roster || jsonb_build_array(jsonb_build_object(
            'id', v_rider_record.rider #>> '{}',
            'team_id', v_team_record.team_id));
        end loop;
      end loop;
      if jsonb_array_length(v_team_rows) <> 15
        or jsonb_array_length(v_rider_rows) <> 120 then
        raise exception 'A synthetic division was incomplete.';
      end if;
      v_divisions := v_divisions || jsonb_build_array(jsonb_build_object(
        'index', v_index, 'seed', format('rollback-probe:div%s', v_index),
        'multiplier', 1, 'teams', v_team_rows, 'results', v_rider_rows,
        'feed', '[]'::jsonb,
        'replay', jsonb_build_object('version', 1,
          'frames', '[{},{}]'::jsonb, 'roster', v_roster,
          'events', '[]'::jsonb)));
    end loop;
    v_output := jsonb_build_object('seed', 'rollback-probe',
      'engine_version', 'rollback-probe', 'stage', v_snapshot->'stage',
      'weather', jsonb_build_object('source', 'probe'),
      'divisions', v_divisions);
    update public.events set scheduled_at = clock_timestamp() - interval '30 seconds'
      where id = v_event;
    begin
      perform public.recovery_finish_race(v_event, v_snapshot,
        jsonb_set(v_output, '{divisions,0,replay,roster,0}',
          v_output #> '{divisions,1,replay,roster,0}'));
      raise exception 'A replay with a rider from another division was committed.';
    exception when sqlstate 'PT409' then
      if sqlerrm <> 'The recorded replay roster does not match its division results.' then raise; end if;
    end;
    if exists(select 1 from public.event_team_results where event_id = v_event)
      or exists(select 1 from public.event_division_runs where event_id = v_event)
      or exists(select 1 from public.recovery_ranking_awards where event_id = v_event) then
      raise exception 'A rejected cross-division replay left committed rows.';
    end if;
    v_result := public.recovery_finish_race(v_event, v_snapshot, v_output);
    if v_result->>'already_finished' <> 'false'
      or (v_result->>'total_divisions')::integer <> 3
      or (v_result->>'riders')::integer <> 360
      or (select count(*) from public.event_team_results
        where event_id = v_event) <> 45
      or (select count(*) from public.event_rider_results
        where event_id = v_event) <> 360
      or (select count(*) from public.event_division_runs
        where event_id = v_event and replay is not null) <> 3
      or (select count(*) from public.recovery_ranking_awards
        where event_id = v_event) <> 60 then
      raise exception 'The three recorded results or point awards were incomplete.';
    end if;
    if exists (
      select 1 from public.event_team_results result
      join public.teams team on team.id = result.team_id
      join public.recovery_division_reveal_entries revealed
        on revealed.event_id = result.event_id
        and revealed.team_id = result.team_id
      where result.event_id = v_event
        and (team.rating <> result.points
          or result.division_index <> revealed.division_index)
    ) or exists (
      select 1 from public.event_rider_results result
      join public.riders rider on rider.id = result.rider_id
      where result.event_id = v_event and rider.rating <> result.points
    ) or exists (
      select 1 from public.recovery_ranking_awards award
      join public.event_rider_results result
        on result.event_id = award.event_id
        and result.rider_id = award.rider_id
      where award.event_id = v_event
        and (award.points <> public.recovery_one_day_sporting_points(
          2::smallint, result.position, result.multiplier)
          or award.gender <> 'M' or award.calendar_source <> 'PELOTONIA'
          or award.points_policy_version <> 'v0.1')
    ) then
      raise exception 'A division, rating balance, or ranking award was inconsistent.';
    end if;
    if (public.recovery_finish_race(v_event, v_snapshot, v_output)
        ->>'already_finished') <> 'true'
      or (select count(*) from public.recovery_ranking_awards
        where event_id = v_event) <> 60 then
      raise exception 'A race retry changed the committed results.';
    end if;

    raise sqlstate 'PZ001' using message = 'Rollback 45-team probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.events where id = v_event)
    or exists(select 1 from public.recovery_division_reveals where event_id = v_event)
    or exists(select 1 from public.recovery_tactics_commits where event_id = v_event)
    or exists(select 1 from public.recovery_race_commits where event_id = v_event) then
    raise exception 'The 45-team probe left persistent rows.';
  end if;
end;
$probe$;
