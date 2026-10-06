-- Isolated database only. A deliberately synthetic v2 candidate exercises
-- the atomic SQL boundary; JavaScript tests prove the actual recording.
-- PZ001 rolls every fixture mutation back, including the temporary finish.
do $probe$
declare
  v_event uuid;
  v_team public.event_teams;
  v_other public.event_teams;
  v_user uuid;
  v_other_user uuid;
  v_gender text;
  v_source text;
  v_year integer;
  v_weather jsonb := '{"source":"LOCKED_SIM","temp_c":18,"wind_kph":5,
    "precipitation_mm":0,"country_code":"DK","condition":"Clear"}'::jsonb;
  v_lock jsonb;
  v_team_ids jsonb;
  v_results jsonb;
  v_awards jsonb;
  v_division jsonb;
  v_contract jsonb;
  v_ledger jsonb;
  v_bad_ledger jsonb;
  v_first jsonb;
  v_repeat jsonb;
  v_registration timestamptz := clock_timestamp() - interval '2 hours';
  v_scheduled_at timestamptz;
begin
  if has_function_privilege('anon',
      'public.recovery_settle_v2_one_day(uuid,jsonb,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_settle_v2_one_day(uuid,jsonb,jsonb)', 'EXECUTE')
    or has_table_privilege('anon','public.recovery_v2_settlements','SELECT')
    or has_table_privilege('authenticated',
      'public.recovery_v2_settlements','SELECT') then
    raise exception 'The v2 settlement boundary is public.';
  end if;
  select e.id,e.gender into v_event,v_gender from public.events e
    where e.kind = 'one_day' and e.status = 'OPEN'
      and e.registration_deadline is null
      and not exists(select 1 from public.recovery_race_commits c
        where c.event_id = e.id)
      and (select count(*) from public.event_teams et
        where et.event_id = e.id) = 2
    order by e.id limit 1;
  if v_event is null then raise exception 'No isolated two-team event.'; end if;
  select * into v_team from public.event_teams et
    where et.event_id = v_event order by et.team_id limit 1;
  select * into v_other from public.event_teams et
    where et.event_id = v_event and et.team_id <> v_team.team_id;
  select t.user_id into v_user from public.teams t where t.id = v_team.team_id;
  select t.user_id into v_other_user from public.teams t
    where t.id = v_other.team_id;
  if v_user is null or v_other_user is null or v_user = v_other_user or
    coalesce(array_length(v_team.selected_riders,1),0) <> 8 or
    coalesce(array_length(v_other.selected_riders,1),0) <> 8 then
    raise exception 'The fixture needs two independent eight-rider managers.';
  end if;
  begin
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA', race_tier = 3
      where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id,status)
      values(v_event,'COMPLETE');
    perform public.recovery_commit_division_reveal(v_event);
    perform public.recovery_save_v2_tactics_draft(v_user,v_event,
      jsonb_build_object('version',2,'captainId',v_team.captain_id::text,
        'roadCaptainId',v_team.captain_id::text,'helperIds','[]'::jsonb,
        'baseline',jsonb_build_object('effort','steady'),'phases','[]'::jsonb));
    perform public.recovery_save_v2_tactics_draft(v_other_user,v_event,
      jsonb_build_object('version',2,'captainId',v_other.captain_id::text,
        'roadCaptainId',v_other.captain_id::text,'helperIds','[]'::jsonb,
        'baseline',jsonb_build_object('effort','hard'),'phases','[]'::jsonb));
    update public.events set tactics_deadline = clock_timestamp() - interval '1 hour',
      scheduled_at = clock_timestamp() - interval '1 minute'
      where id = v_event;
    select e.calendar_source,extract(year from e.scheduled_at at time zone 'UTC')
      into v_source,v_year from public.events e where e.id = v_event;
    select e.scheduled_at into v_scheduled_at from public.events e
      where e.id = v_event;
    v_lock := public.recovery_commit_v2_tactics_lock(v_event,v_weather);
    select jsonb_agg(to_jsonb(a.value->>'teamId')
      order by (a.value->>'seedRank')::integer) into v_team_ids
      from jsonb_array_elements(
        v_lock->'inputSnapshot'->'locked_division_reveal'->'assignments') a;
    with ranked as (
      select et.team_id, rider.rider_id,
        row_number() over(order by et.team_id,rider.rider_id)::integer as place
      from public.event_teams et
      cross join lateral unnest(et.selected_riders) rider(rider_id)
      where et.event_id = v_event
    )
    select
      jsonb_agg(jsonb_build_object('riderId',r.rider_id,
        'teamId',r.team_id,'position',r.place,
        'rankingPoints',public.recovery_one_day_sporting_points(
          3::smallint,r.place,1)) order by r.place),
      jsonb_agg(jsonb_build_object(
        'awardKey','one_day:' || v_event::text || ':' || r.rider_id::text,
        'riderId',r.rider_id,'teamId',r.team_id,'divisionIndex',1,
        'placing',r.place,'points',public.recovery_one_day_sporting_points(
          3::smallint,r.place,1)) order by r.place)
      into v_results,v_awards from ranked r;
    v_division := jsonb_build_object('index',1,'teamIds',v_team_ids,
      'recordingVersion',2,'recording','{}'::jsonb,
      'riderResults',v_results,'awards',v_awards);
    v_contract := jsonb_build_object('schemaVersion',1,'engineVersion',2,
      'eventId',v_event,'seasonYear',v_year,'gender',v_gender,
      'tier',3,'pointsPolicyVersion','v0.1',
      'divisionReveal',v_lock->'inputSnapshot'->'locked_division_reveal',
      'divisions',jsonb_build_array(v_division));
    perform public.recovery_save_v2_recorded_candidate(v_event,v_contract);
    select jsonb_agg(jsonb_build_object(
      'award_key',a.value->>'awardKey',
      'rider_id',a.value->>'riderId',
      'team_id',a.value->>'teamId',
      'event_id',v_event::text,'season_year',v_year,
      'gender',v_gender,'calendar_source',v_source,
      'event_format','ONE_DAY','race_tier',3,'result_type','ONE_DAY',
      'result_place',a.value->'placing','points',a.value->'points',
      'points_policy_version','v0.1') order by a.value->>'awardKey')
      into v_ledger from jsonb_array_elements(v_awards) a;
    v_bad_ledger := jsonb_set(v_ledger,'{0,points}',
      to_jsonb((v_ledger->0->>'points')::integer+1));
    begin
      perform public.recovery_settle_v2_one_day(v_event,v_contract,v_bad_ledger);
      raise exception 'A changed v2 point was accepted.';
    exception when sqlstate 'PT409' then null;
    end;
    if exists(select 1 from public.recovery_v2_settlements
        where event_id=v_event) or exists(select 1 from
        public.recovery_ranking_awards where event_id=v_event) then
      raise exception 'A rejected v2 settlement wrote rows.';
    end if;
    update public.events set scheduled_at = v_scheduled_at - interval '1 second'
      where id = v_event;
    begin
      perform public.recovery_settle_v2_one_day(v_event,v_contract,v_ledger);
      raise exception 'A changed race schedule was accepted.';
    exception when sqlstate 'PT409' then null;
    end;
    update public.events set scheduled_at = v_scheduled_at where id = v_event;
    if exists(select 1 from public.recovery_v2_settlements
        where event_id=v_event) or exists(select 1 from
        public.recovery_ranking_awards where event_id=v_event) then
      raise exception 'A changed schedule wrote v2 settlement rows.';
    end if;
    v_first := public.recovery_settle_v2_one_day(v_event,v_contract,v_ledger);
    v_repeat := public.recovery_settle_v2_one_day(v_event,v_contract,v_ledger);
    if v_first->>'alreadySettled' <> 'false'
      or v_repeat->>'alreadySettled' <> 'true'
      or v_first->>'settledAt' <> v_repeat->>'settledAt'
      or (select status from public.events where id=v_event) <> 'FINISHED'
      or (select count(*) from public.recovery_v2_settlements
        where event_id=v_event) <> 1
      or (select count(*) from public.recovery_ranking_awards
        where event_id=v_event) <> 16
      or exists(select 1 from public.recovery_race_commits
        where event_id=v_event) then
      raise exception 'The v2 settlement did not commit exactly once.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback v2 settlement probe.';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists(select 1 from public.recovery_v2_settlements
      where event_id=v_event)
    or exists(select 1 from public.recovery_ranking_awards
      where event_id=v_event)
    or exists(select 1 from public.recovery_v2_recorded_candidates
      where event_id=v_event)
    or exists(select 1 from public.recovery_v2_tactics_commits
      where event_id=v_event) then
    raise exception 'The v2 settlement probe left persistent changes.';
  end if;
end;
$probe$;
