-- Isolated test project only. Calendar fixtures and stage profile roll back.
begin;
do $$
declare
  request_id uuid := gen_random_uuid();
  owner_id uuid;
  template public.stage_profiles;
  definition jsonb;
  result jsonb;
  race_day timestamptz := (date_trunc('week', now() at time zone 'UTC') + interval '9 days 12 hours') at time zone 'UTC';
  event_ids uuid[];
begin
  select user_id into owner_id from public.teams order by id limit 1;
  select * into template from public.stage_profiles where cardinality(tags)>0 limit 1;
  if owner_id is null or template.id is null then
    raise exception 'A seeded owner and stage profile are required';
  end if;
  definition := jsonb_build_object(
    'name', 'P02 scheduled calendar test', 'gender', 'BOTH',
    'deadline', clock_timestamp() + interval '1 day',
    'scheduled_at', race_day, 'calendar_source', 'UCI', 'race_tier', 3,
    'source_date', (race_day at time zone 'UTC')::date + 2,
    'source_url', 'https://example.org/test-calendar',
    'stage', jsonb_build_object('id', 'coast', 'name', template.name,
      'country_code', template.country_code, 'distance_km', template.distance_km,
      'profile_points', template.profile_points, 'keypoints', template.keypoints,
      'tags', to_jsonb(template.tags)));
  result := public.recovery_create_scheduled_race_day(request_id, owner_id, definition);
  event_ids := array(select jsonb_array_elements_text(result->'event_ids')::uuid);
  if cardinality(event_ids) <> 2 or (result->>'already_created')::boolean then
    raise exception 'Expected two newly created races: %', result;
  end if;
  if (select count(*) from public.events where id=any(event_ids)
      and calendar_source='UCI' and race_tier=3 and race_team_size=8
      and scheduled_at=race_day and calendar_pair_id=request_id) <> 2
    or (select count(distinct gender) from public.events where id=any(event_ids)) <> 2 then
    raise exception 'Scheduled race pair metadata is inconsistent';
  end if;
  result := public.recovery_create_scheduled_race_day(request_id, owner_id, definition);
  if (result->>'already_created')::boolean is distinct from true
    or (select count(*) from public.events where id=any(event_ids)) <> 2 then
    raise exception 'Repeated request created or changed a race';
  end if;
  begin
    perform public.recovery_create_scheduled_race_day(request_id, owner_id,
      jsonb_set(definition, '{name}', '"Changed title"'));
    raise exception 'Changed definition reused an existing request ID';
  exception when sqlstate 'PT409' then null; end;
  begin
    perform public.recovery_create_scheduled_race_day(gen_random_uuid(), owner_id,
      jsonb_set(definition, '{source_date}', to_jsonb(
        ((race_day at time zone 'UTC')::date + 7)::text)));
    raise exception 'Different UCI source week was accepted';
  exception when sqlstate 'PT400' then null; end;
end $$;
rollback;
select 'PASS: paired calendar creation, idempotence and UCI source week; fixtures rolled back' result;
