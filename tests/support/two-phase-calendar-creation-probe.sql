-- Run only in the allowlisted isolated test project. All fixture writes roll back.
do $probe$
declare
  v_owner uuid;
  v_stage jsonb;
  v_request uuid := gen_random_uuid();
  v_registration timestamptz := clock_timestamp()+interval '1 day';
  v_tactics timestamptz := clock_timestamp()+interval '3 days';
  v_schedule timestamptz := (date_trunc('week',clock_timestamp() at time zone 'UTC')
    +interval '6 days 18 hours') at time zone 'UTC';
  v_definition jsonb;
  v_result jsonb;
  v_repeat jsonb;
  v_ids uuid[];
  v_rejected boolean;
begin
  select user_id into v_owner from public.teams order by id limit 1;
  select jsonb_build_object('id','coast','name',name,
    'country_code',country_code,'distance_km',distance_km,
    'profile_points',profile_points,'keypoints',keypoints,'tags',to_jsonb(tags))
    into v_stage from public.stage_profiles where distance_km between 20 and 400
    order by id limit 1;
  if v_owner is null or v_stage is null then
    raise exception 'Isolated project needs an existing fixture owner and route.';
  end if;
  v_definition:=jsonb_build_object('name','Two-phase creation probe',
    'template_id','coast','gender','BOTH','deadline',v_registration,
    'tactics_deadline',v_tactics,'scheduled_at',v_schedule,
    'calendar_source','PELOTONIA','race_tier',1,'stage',v_stage);

  begin
    v_result:=public.recovery_create_two_phase_race_day(
      v_request,v_owner,v_definition);
    v_ids:=array(select jsonb_array_elements_text(v_result->'event_ids')::uuid);
    if cardinality(v_ids)<>2 or v_result->>'already_created'<>'false' then
      raise exception 'Expected two newly created gender races.';
    end if;
    if (select count(*) from public.events where id=any(v_ids)
      and deadline=v_registration and registration_deadline=v_registration
      and tactics_deadline=v_tactics and scheduled_at=v_schedule)<>2 then
      raise exception 'Two-phase dates were not saved on both races.';
    end if;
    v_repeat:=public.recovery_create_two_phase_race_day(
      v_request,v_owner,v_definition);
    if v_repeat->>'already_created'<>'true' or
      v_repeat->'event_ids'<>v_result->'event_ids' then
      raise exception 'Retry created different races.';
    end if;

    v_rejected:=false;
    begin
      perform public.recovery_create_two_phase_race_day(v_request,v_owner,
        v_definition||jsonb_build_object('name','Changed request'));
    exception when sqlstate 'PT409' then v_rejected:=true;
    end;
    if not v_rejected then raise exception 'Changed retry was accepted.'; end if;

    v_rejected:=false;
    begin
      perform public.recovery_create_two_phase_race_day(gen_random_uuid(),v_owner,
        v_definition||jsonb_build_object('tactics_deadline',v_registration));
    exception when sqlstate 'PT400' then v_rejected:=true;
    end;
    if not v_rejected then raise exception 'Early tactics deadline was accepted.'; end if;

    raise sqlstate 'PZ001' using message='rollback fixtures';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists(select 1 from public.events where id=any(v_ids)) or
    exists(select 1 from public.race_calendar_requests where id=v_request) then
    raise exception 'Calendar probe did not roll back.';
  end if;
  raise notice 'Two-phase calendar creation, retry, guards and rollback passed.';
end;
$probe$;
