-- Isolated test project only. Scheduled races and the profile roll back.
begin;
set local time zone 'Pacific/Auckland';
do $$
declare
  owner_id uuid;
  template public.stage_profiles;
  definition jsonb;
  result jsonb;
  request_id uuid := gen_random_uuid();
  next_run timestamptz := (date_trunc('day',now() at time zone 'UTC')
    + interval '2 hours') at time zone 'UTC';
  race_day timestamptz := (date_trunc('week', now() at time zone 'UTC')
    + interval '9 days 12 hours') at time zone 'UTC';
begin
  select user_id into owner_id from public.teams order by id limit 1;
  select * into template from public.stage_profiles where cardinality(tags)>0 limit 1;
  if owner_id is null or template.id is null then
    raise exception 'A seeded owner and stage profile are required';
  end if;
  definition := jsonb_build_object(
    'name', 'P02 guarded race test', 'gender', 'M',
    'deadline', clock_timestamp() + interval '1 hour',
    'scheduled_at', race_day, 'calendar_source', 'PELOTONIA', 'race_tier', 3,
    'stage', jsonb_build_object('id', 'coast', 'name', template.name,
      'country_code', template.country_code, 'distance_km', template.distance_km,
      'profile_points', template.profile_points, 'keypoints', template.keypoints,
      'tags', to_jsonb(template.tags)));
  begin
    perform public.recovery_create_scheduled_race_day_safe(request_id, owner_id, definition);
    raise exception 'Short-notice scheduled race was accepted';
  exception when sqlstate 'PT400' then
    if sqlerrm <> 'Entry deadline must follow the next autopilot scan.' then
      raise exception 'Wrong deadline rejection: %', sqlerrm;
    end if;
  end;
  if exists(select 1 from public.race_calendar_requests where id=request_id) then
    raise exception 'Rejected race left a request behind';
  end if;
  if now()>=next_run then next_run:=next_run+interval '1 day'; end if;
  begin
    perform public.recovery_create_scheduled_race_day_safe(gen_random_uuid(), owner_id,
      jsonb_set(definition, '{deadline}',
        to_jsonb((next_run+interval '70 minutes')::text)));
    raise exception 'Deadline on the cron-window boundary was accepted';
  exception when sqlstate 'PT400' then
    if sqlerrm <> 'Entry deadline must follow the next autopilot scan.' then
      raise exception 'Wrong boundary rejection: %', sqlerrm;
    end if;
  end;

  -- An earlier successful request must remain idempotent if the safe wrapper
  -- is called later with the same ID and its deadline is now too close.
  result := public.recovery_create_scheduled_race_day(request_id, owner_id, definition);
  result := public.recovery_create_scheduled_race_day_safe(request_id, owner_id, definition);
  if (result->>'already_created')::boolean is distinct from true then
    raise exception 'The guarded retry lost request idempotence';
  end if;
  begin
    perform public.recovery_create_scheduled_race_day_safe(request_id, owner_id,
      jsonb_set(definition, '{name}', '"Changed title"'));
    raise exception 'A changed retry was accepted';
  exception when sqlstate 'PT409' then null; end;

  definition := jsonb_set(definition, '{deadline}',
    to_jsonb((clock_timestamp()+interval '2 days')::text));
  result := public.recovery_create_scheduled_race_day_safe(
    gen_random_uuid(),owner_id,definition);
  if (result->>'already_created')::boolean is distinct from false then
    raise exception 'A safe new race was not created';
  end if;
end $$;
rollback;
select 'PASS: short deadline rejected, safe race created, retries remain idempotent; fixtures rolled back' result;
