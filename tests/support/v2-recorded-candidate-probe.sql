-- Isolated database only. Every fixture mutation is rolled back by PZ001.
-- This probes SQL identity, phase, privacy and idempotency; the JavaScript
-- result validator separately proves the kilometre recording against the lock.
do $probe$
declare
  v_event uuid;
  v_team public.event_teams;
  v_other public.event_teams;
  v_user uuid;
  v_other_user uuid;
  v_weather jsonb := '{"source":"LOCKED_SIM","temp_c":18,"wind_kph":5,
    "precipitation_mm":0,"country_code":"DK","condition":"Clear"}'::jsonb;
  v_lock jsonb;
  v_contract jsonb;
  v_first jsonb;
  v_repeat jsonb;
  v_slice jsonb;
  v_registration timestamptz := clock_timestamp() - interval '2 hours';
begin
  if has_function_privilege('anon',
      'public.recovery_save_v2_recorded_candidate(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_save_v2_recorded_candidate(uuid,jsonb)', 'EXECUTE')
    or has_table_privilege('anon',
      'public.recovery_v2_recorded_candidates', 'SELECT')
    or has_table_privilege('authenticated',
      'public.recovery_v2_recorded_candidates', 'SELECT')
    or has_function_privilege('anon',
      'public.recovery_get_v2_recorded_division(uuid,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_get_v2_recorded_division(uuid,uuid)', 'EXECUTE') then
    raise exception 'V2 recording permissions are not private.';
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
  select * into v_team from public.event_teams et
    where et.event_id = v_event order by et.team_id limit 1;
  select * into v_other from public.event_teams et
    where et.event_id = v_event and et.team_id <> v_team.team_id;
  select t.user_id into v_user from public.teams t where t.id = v_team.team_id;
  select t.user_id into v_other_user from public.teams t
    where t.id = v_other.team_id;
  if v_user is null or v_other_user is null or v_user = v_other_user then
    raise exception 'The fixture needs independent managers.';
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
    v_lock := public.recovery_commit_v2_tactics_lock(v_event,v_weather);
    v_contract := jsonb_build_object('schemaVersion',1,'engineVersion',2,
      'eventId',v_event,'gender','M','tier',3,'pointsPolicyVersion','v0.1',
      'divisionReveal',v_lock->'inputSnapshot'->'locked_division_reveal',
      'divisions',jsonb_build_array(jsonb_build_object('index',1)));
    if v_lock->'inputSnapshot'->'event'->>'gender' <> 'M' then
      v_contract := jsonb_set(v_contract,'{gender}',
        v_lock->'inputSnapshot'->'event'->'gender');
    end if;
    begin
      perform public.recovery_save_v2_recorded_candidate(v_event,
        jsonb_set(v_contract,'{tier}','4'::jsonb));
      raise exception 'V2 recording accepted a wrong tier.';
    exception when sqlstate 'PT400' then null;
    end;
    v_first := public.recovery_save_v2_recorded_candidate(v_event,v_contract);
    v_repeat := public.recovery_save_v2_recorded_candidate(v_event,v_contract);
    if v_first->>'alreadyRecorded' <> 'false'
      or v_repeat->>'alreadyRecorded' <> 'true'
      or v_repeat->>'recordedAt' <> v_first->>'recordedAt'
      or (select result_contract from public.recovery_v2_recorded_candidates
          where event_id = v_event) is distinct from v_contract then
      raise exception 'The v2 candidate was not stable on retry.';
    end if;
    v_slice := public.recovery_get_v2_recorded_division(v_user,v_event);
    if v_slice->>'eventId' <> v_event::text
      or v_slice->'divisionCount' <> '1'::jsonb
      or v_slice->'division'->'index' <> '1'::jsonb
      or v_slice ? 'divisions'
      or v_slice->>'recordedAt' <> v_first->>'recordedAt' then
      raise exception 'The v2 read did not return exactly one saved division.';
    end if;
    v_slice := public.recovery_get_v2_recorded_division(v_other_user,v_event);
    if v_slice->'division'->'index' <> '1'::jsonb then
      raise exception 'The other entered manager could not read the division.';
    end if;
    begin
      perform public.recovery_get_v2_recorded_division(gen_random_uuid(),v_event);
      raise exception 'A foreign manager read the v2 division.';
    exception when sqlstate 'PT403' then null;
    end;
    begin
      perform public.recovery_save_v2_recorded_candidate(v_event,
        jsonb_set(v_contract,'{divisions,0,index}','2'::jsonb));
      raise exception 'V2 recording accepted a changed retry.';
    exception when sqlstate 'PT409' then null;
    end;
    if exists(select 1 from public.recovery_race_commits c
        where c.event_id = v_event)
      or exists(select 1 from public.recovery_ranking_awards a
        where a.event_id = v_event)
      or exists(select 1 from public.event_division_runs d
        where d.event_id = v_event) then
      raise exception 'The candidate changed the legacy result or ledger.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback v2 recording probe.';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists(select 1 from public.recovery_v2_recorded_candidates c
      where c.event_id = v_event)
    or exists(select 1 from public.recovery_v2_tactics_commits c
      where c.event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals r
      where r.event_id = v_event)
    or exists(select 1 from public.recovery_autopilot_jobs j
      where j.event_id = v_event) then
    raise exception 'V2 recording probe left persistent changes.';
  end if;
end;
$probe$;
