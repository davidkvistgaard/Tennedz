-- Isolated project only. This fixture persists until the matching cleanup
-- script runs. Its returned snapshot contains private rider and order data.
begin;
do $probe$
declare
  v_owner uuid;
  v_stage uuid;
  v_event uuid := gen_random_uuid();
  v_team uuid;
  v_rider uuid;
  v_selected uuid[];
  v_orders jsonb;
  v_registration timestamptz;
  v_tactics timestamptz;
  v_scheduled timestamptz;
  v_index integer;
  v_rider_index integer;
begin
  v_registration := clock_timestamp() + interval '2 hours';
  v_tactics := v_registration + interval '1 hour';
  v_scheduled := v_tactics + interval '1 hour';
  select user_id into v_owner from public.teams order by id limit 1;
  select id into v_stage from public.stage_profiles
    where distance_km between 20 and 400 order by id limit 1;
  if v_owner is null or v_stage is null then
    raise exception 'The isolated project needs a fixture owner and route.';
  end if;
  insert into public.events(id, name, kind, gender, country_code,
    stage_profile_id, status, entry_fee, deadline,
    registration_deadline, tactics_deadline, scheduled_at,
    calendar_source, race_tier)
  values(v_event, 'Disposable two-phase real-output probe', 'one_day',
    'M', 'FR', v_stage, 'OPEN', 0,
    v_registration, v_registration, v_tactics, v_scheduled, 'PELOTONIA', 2);
  for v_index in 1..2 loop
    v_team := gen_random_uuid();
    insert into public.teams(id, user_id, name)
      values(v_team, v_owner, format('Real-output probe team %s', v_index));
    v_selected := '{}'::uuid[];
    for v_rider_index in 1..8 loop
      v_rider := gen_random_uuid();
      insert into public.riders(id, name, gender, sprint, flat, hills,
        mountain, cobbles, timetrial, leadership, endurance, moral, luck,
        wind, form, strength)
      values(v_rider, format('Real-output probe rider %s-%s', v_index, v_rider_index),
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
      jsonb_build_object('version', 1, 'plan', 'balanced', 'riders', v_orders));
  end loop;
  v_registration := clock_timestamp() - interval '2 hours';
  v_tactics := clock_timestamp() + interval '1 hour';
  v_scheduled := clock_timestamp() + interval '2 hours';
  update public.events set deadline = v_registration,
    registration_deadline = v_registration,
    tactics_deadline = v_tactics,
    scheduled_at = v_scheduled
    where id = v_event;
  insert into public.recovery_autopilot_jobs(event_id, status)
    values(v_event, 'COMPLETE');
  perform public.recovery_commit_division_reveal(v_event);
  update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
    where id = v_event;
  perform public.recovery_commit_tactics_lock(v_event);
  update public.events set scheduled_at = clock_timestamp() - interval '30 seconds'
    where id = v_event;
  perform pg_catalog.set_config('pelotonia.real_output_event', v_event::text, true);
end;
$probe$;
select jsonb_build_object('event_id', pg_catalog.current_setting('pelotonia.real_output_event'),
  'snapshot', public.recovery_race_snapshot(
    pg_catalog.current_setting('pelotonia.real_output_event')::uuid)) as payload;
commit;
