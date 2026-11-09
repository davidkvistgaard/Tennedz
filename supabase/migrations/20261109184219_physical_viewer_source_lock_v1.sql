-- Commit the exact seed and weather the official recovery engine will read.
-- A physical preview can only be recorded after its complete private inputs
-- agree with the same post-deadline snapshot under the cycle lock.
create function public.recovery_lock_physical_viewer_source_v1(
  p_event uuid, p_snapshot jsonb, p_entries jsonb,
  p_seed text, p_weather jsonb
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare current_snapshot jsonb; current_entries jsonb;
  expected_seed text;
begin
  perform pg_advisory_xact_lock(73192026);
  current_snapshot := public.recovery_race_snapshot(p_event);
  if current_snapshot is distinct from p_snapshot
    or current_snapshot->'event'->>'id' is distinct from
      p_event::text then
    raise exception using errcode='PT409',
      message='The race changed before its physical source was locked.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(i) - 'committed_at'
    order by i.team_id),'[]'::jsonb) into current_entries
    from public.recovery_physical_entry_inputs i
    where i.event_id=p_event;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or current_entries is distinct from p_entries
    or jsonb_array_length(current_entries) is distinct from
      jsonb_array_length(current_snapshot->'teams') then
    raise exception using errcode='PT409',
      message='Physical team inputs changed or are incomplete.';
  end if;
  expected_seed := coalesce(nullif(
    current_snapshot->'event'->>'seed',''),
    p_event::text || ':recovery-one-day-3');
  if p_seed is distinct from expected_seed
    or jsonb_typeof(p_weather) is distinct from 'object'
    or coalesce(p_weather->>'source','') = ''
    or jsonb_typeof(p_weather->'temp_c') is distinct from 'number'
    or jsonb_typeof(p_weather->'wind_kph') is distinct from 'number'
    or jsonb_typeof(p_weather->'precipitation_mm') is distinct from 'number'
    or (current_snapshot->'event'->'weather_locked' is not null
      and current_snapshot->'event'->'weather_locked' <> 'null'::jsonb
      and current_snapshot->'event'->'weather_locked'
        is distinct from p_weather) then
    raise exception using errcode='PT409',
      message='The physical source differs from official race inputs.';
  end if;
  update public.events set
    seed=p_seed,weather_locked=p_weather,
    weather_locked_at=clock_timestamp(),
    weather_source=p_weather->>'source'
  where id=p_event and
    (seed is distinct from p_seed
      or weather_locked is distinct from p_weather);
  return public.recovery_race_snapshot(p_event);
end $$;
revoke all on function
  public.recovery_lock_physical_viewer_source_v1(
    uuid,jsonb,jsonb,text,jsonb)
  from public,anon,authenticated;
grant execute on function
  public.recovery_lock_physical_viewer_source_v1(
    uuid,jsonb,jsonb,text,jsonb)
  to service_role;