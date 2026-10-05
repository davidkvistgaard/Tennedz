-- Isolated-project verification only. The PZ001 subtransaction deliberately
-- rolls back every fixture mutation, including the temporary two-phase event.
do $probe$
declare
  v_event uuid;
  v_registration timestamptz := clock_timestamp() - interval '2 hours';
  v_lock jsonb;
  v_snapshot jsonb;
  v_message text;
  v_output jsonb;
  v_team_rows jsonb := '[]'::jsonb;
  v_rider_rows jsonb := '[]'::jsonb;
  v_roster jsonb := '[]'::jsonb;
  v_team jsonb;
  v_rider jsonb;
  v_team_number integer := 0;
  v_rider_number integer := 0;
  v_result jsonb;
begin
  if has_function_privilege('anon', 'public.recovery_race_snapshot(uuid)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_guard_unfinished_two_phase_commit()', 'EXECUTE') then
    raise exception 'Private race functions are exposed.';
  end if;
  select e.id into v_event from public.events e
    where e.kind = 'one_day' and e.status = 'OPEN'
      and e.registration_deadline is null
      and not exists(select 1 from public.recovery_race_commits c
        where c.event_id = e.id)
      and (select count(*) from public.event_teams et
        where et.event_id = e.id) = 2
    order by e.id limit 1;
  if v_event is null then raise exception 'No isolated two-team event.'; end if;

  begin
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA', race_tier = 2
      where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    perform public.recovery_commit_division_reveal(v_event);
    update public.event_teams et set orders = jsonb_build_object(
      'version', 1, 'plan', 'balanced', 'riders',
      (select jsonb_object_agg(rider_id::text,
        jsonb_build_object('role', case when rider_id = et.captain_id
          then 'captain' else 'free' end, 'effort', 'balanced'))
        from unnest(et.selected_riders) rider_id))
      where et.event_id = v_event;
    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;
    v_lock := public.recovery_commit_tactics_lock(v_event);
    if v_lock->>'alreadyLocked' <> 'false' then
      raise exception 'Tactics did not lock.';
    end if;
    update public.event_teams set orders = null where event_id = v_event;
    v_snapshot := public.recovery_race_snapshot(v_event);
    if v_snapshot is distinct from v_lock->'inputSnapshot'
      or exists(select 1 from jsonb_array_elements(v_snapshot->'teams') t
        where t->'entry'->'orders' is null) then
      raise exception 'The race did not retain its locked input.';
    end if;

    begin
      insert into public.recovery_race_commits(event_id,input_snapshot,summary)
        values(v_event,v_snapshot,'{}'::jsonb);
      raise exception 'An early race commit was allowed.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The saved tactics input is not ready to finish.' then raise; end if;
    end;
    update public.events set scheduled_at = clock_timestamp() - interval '1 second',
      status = 'FINISHED' where id = v_event;
    begin
      insert into public.recovery_race_commits(event_id,input_snapshot,summary)
        values(v_event,v_snapshot,'{}'::jsonb);
      raise exception 'An incomplete division result was allowed.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The saved division results are incomplete.' then raise; end if;
    end;

    update public.events set status = 'OPEN' where id = v_event;
    for v_team in select value from jsonb_array_elements(v_snapshot->'teams') loop
      v_team_number := v_team_number + 1;
      v_team_rows := v_team_rows || jsonb_build_array(jsonb_build_object(
        'team_id', v_team->>'id',
        'captain_id', v_team->'entry'->>'captain_id',
        'position', v_team_number, 'time_sec', 10000 + v_team_number * 100,
        'points', case when v_team_number = 1 then 100 else 85 end,
        'seed_power', 50));
      for v_rider in select value from jsonb_array_elements(
          v_team->'entry'->'selected_riders') loop
        v_rider_number := v_rider_number + 1;
        v_rider_rows := v_rider_rows || jsonb_build_array(jsonb_build_object(
          'rider_id', v_rider #>> '{}', 'team_id', v_team->>'id',
          'position', v_rider_number, 'time_sec', 10000 + v_rider_number * 10,
          'points', 1,
          'after', jsonb_build_object('fatigue', 20, 'form', 50,
            'injury_until', null)));
        v_roster := v_roster || jsonb_build_array(jsonb_build_object(
          'id', v_rider #>> '{}', 'team_id', v_team->>'id'));
      end loop;
    end loop;
    v_output := jsonb_build_object('seed', 'isolated-probe',
      'engine_version', 'isolated-probe', 'stage', v_snapshot->'stage',
      'weather', jsonb_build_object('source', 'probe'),
      'divisions', jsonb_build_array(jsonb_build_object(
        'index', 1, 'seed', 'isolated-probe:div1', 'multiplier', 1,
        'teams', v_team_rows, 'results', v_rider_rows, 'feed', '[]'::jsonb,
        'replay', jsonb_build_object('version', 1,
          'frames', '[{},{}]'::jsonb, 'roster', v_roster, 'events', '[]'::jsonb))));
    begin
      perform public.recovery_finish_race(v_event, v_snapshot,
        jsonb_set(v_output, '{divisions,0,index}', '2'::jsonb));
      raise exception 'A changed division assignment was committed.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The result differs from the saved division reveal.' then raise; end if;
    end;
    begin
      perform public.recovery_finish_race(v_event, v_snapshot,
        jsonb_set(v_output, '{divisions,0,replay,roster,0,team_id}',
          to_jsonb(v_event::text)));
      raise exception 'A replay with a foreign team was committed.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The recorded replay roster does not match its division results.' then raise; end if;
    end;
    begin
      perform public.recovery_finish_race(v_event, v_snapshot,
        jsonb_set(v_output, '{divisions,0,replay,roster,1}', v_roster->0));
      raise exception 'A replay with a duplicate rider was committed.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The recorded replay roster does not match its division results.' then raise; end if;
    end;
    if exists(select 1 from public.event_division_runs d where d.event_id = v_event)
      or exists(select 1 from public.event_team_results t where t.event_id = v_event)
      or exists(select 1 from public.recovery_ranking_awards a where a.event_id = v_event)
      or (select status from public.events where id = v_event) <> 'OPEN' then
      raise exception 'A rejected division result left writes behind.';
    end if;
    v_result := public.recovery_finish_race(v_event, v_snapshot, v_output);
    if v_result->>'already_finished' <> 'false'
      or (v_result->>'riders')::integer <> 16
      or (select count(*) from public.recovery_ranking_awards a
        where a.event_id = v_event) <> 16
      or (select count(*) from public.event_division_runs d
        where d.event_id = v_event and d.replay is not null) <> 1 then
      raise exception 'The locked race result or point awards are incomplete.';
    end if;
    v_result := public.recovery_finish_race(v_event, v_snapshot, v_output);
    if v_result->>'already_finished' <> 'true'
      or (select count(*) from public.recovery_ranking_awards a
        where a.event_id = v_event) <> 16 then
      raise exception 'A retry changed the committed race.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback finish probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.recovery_tactics_commits c where c.event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals r where r.event_id = v_event)
    or exists(select 1 from public.recovery_race_commits c where c.event_id = v_event)
    or exists(select 1 from public.events e where e.id = v_event
      and e.registration_deadline is not null) then
    raise exception 'Finish probe left persistent changes.';
  end if;
end;
$probe$;
