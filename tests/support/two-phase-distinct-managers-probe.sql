-- Isolated project only. Uses two existing, separately owned fixture rosters.
-- PZ001 rolls back the event, entries, reveal, and tactics edits together.
do $probe$
declare
  v_event uuid := gen_random_uuid();
  v_stage uuid;
  v_teams uuid[];
  v_users uuid[];
  v_a uuid[];
  v_b uuid[];
  v_orders_a jsonb;
  v_orders_b jsonb;
  v_initial_a jsonb;
  v_initial_b jsonb;
  v_message text;
  v_registration timestamptz;
begin
  select id into v_stage from public.stage_profiles
    where distance_km between 20 and 400 order by id limit 1;
  select array_agg(team_id order by team_id), array_agg(user_id order by team_id)
    into v_teams, v_users
  from (
    select t.id team_id, t.user_id
    from public.teams t
    join public.team_riders tr on tr.team_id = t.id
    join public.riders r on r.id = tr.rider_id
    where t.user_id is not null and r.gender = 'M'
      and (r.injury_until is null or r.injury_until <=
        (select game_date from public.game_state where id = 1))
    group by t.id, t.user_id
    having count(distinct r.id) >= 8
    order by t.id limit 2
  ) candidates;
  if v_stage is null or cardinality(v_teams) <> 2
    or v_users[1] = v_users[2] then
    raise exception 'Two separate isolated managers and a route are required.';
  end if;
  select array_agg(rider_id order by rider_id) into v_a from (
    select r.id rider_id from public.team_riders tr
    join public.riders r on r.id = tr.rider_id
    where tr.team_id = v_teams[1] and r.gender = 'M'
      and (r.injury_until is null or r.injury_until <=
        (select game_date from public.game_state where id = 1))
    order by r.id limit 8
  ) selected;
  select array_agg(rider_id order by rider_id) into v_b from (
    select r.id rider_id from public.team_riders tr
    join public.riders r on r.id = tr.rider_id
    where tr.team_id = v_teams[2] and r.gender = 'M'
      and (r.injury_until is null or r.injury_until <=
        (select game_date from public.game_state where id = 1))
    order by r.id limit 8
  ) selected;
  select jsonb_build_object('version', 1, 'plan', 'breakaway',
    'riders', jsonb_object_agg(id::text,
      jsonb_build_object('role', case when id = v_a[1]
        then 'captain' else 'free' end, 'effort', 'balanced')))
    into v_orders_a from unnest(v_a) id;
  select jsonb_build_object('version', 1, 'plan', 'conserve',
    'riders', jsonb_object_agg(id::text,
      jsonb_build_object('role', case when id = v_b[1]
        then 'captain' else 'free' end, 'effort', 'careful')))
    into v_orders_b from unnest(v_b) id;
  v_initial_a := jsonb_set(v_orders_a, '{plan}', '"balanced"'::jsonb);
  v_initial_b := jsonb_set(v_orders_b, '{plan}', '"balanced"'::jsonb);

  begin
    v_registration := clock_timestamp() + interval '1 hour';
    insert into public.events(id, name, kind, gender, country_code,
      stage_profile_id, status, entry_fee, deadline,
      registration_deadline, tactics_deadline, scheduled_at,
      calendar_source, race_tier)
    values(v_event, 'Disposable distinct-managers tactics probe',
      'one_day', 'M', 'FR', v_stage, 'OPEN', 0,
      v_registration, v_registration, v_registration + interval '1 hour',
      v_registration + interval '2 hours', 'PELOTONIA', 2);
    insert into public.event_teams(event_id, team_id, selected_riders,
      captain_id, orders)
    values(v_event, v_teams[1], v_a, v_a[1], v_initial_a),
      (v_event, v_teams[2], v_b, v_b[1], v_initial_b);
    v_registration := clock_timestamp() - interval '1 hour';
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours'
      where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    perform public.recovery_commit_division_reveal(v_event);

    begin
      perform public.recovery_edit_revealed_tactics(
        v_users[1], v_event, v_b, v_b[1], v_orders_b);
      raise exception 'Manager A accepted manager B riders.';
    exception when sqlstate 'PT400' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'Riders must belong to this team and race category and be injury-free.'
        then raise; end if;
    end;
    if (select count(*) from public.event_teams et
      where et.event_id = v_event and
        ((et.team_id = v_teams[1] and et.orders = v_initial_a)
          or (et.team_id = v_teams[2] and et.orders = v_initial_b))) <> 2 then
      raise exception 'Rejected foreign riders changed either manager entry.';
    end if;
    perform public.recovery_edit_revealed_tactics(
      v_users[1], v_event, v_a, v_a[1], v_orders_a);
    perform public.recovery_edit_revealed_tactics(
      v_users[2], v_event, v_b, v_b[1], v_orders_b);
    if (select count(*) from public.event_teams et
      where et.event_id = v_event and
        ((et.team_id = v_teams[1] and et.orders = v_orders_a)
          or (et.team_id = v_teams[2] and et.orders = v_orders_b))) <> 2 then
      raise exception 'Separate managers did not retain separate orders.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback distinct managers.';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists(select 1 from public.events where id = v_event)
    or exists(select 1 from public.recovery_division_reveals
      where event_id = v_event)
    or exists(select 1 from public.event_teams where event_id = v_event) then
    raise exception 'Distinct-managers probe left persistent rows.';
  end if;
end;
$probe$;
