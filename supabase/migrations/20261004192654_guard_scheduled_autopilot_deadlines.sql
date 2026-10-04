begin;
-- Only the enabled autopilot path calls this wrapper. Keep the original creator
-- available for manual/legacy races and preserve its request idempotence.
create function public.recovery_create_scheduled_race_day_safe(
  p_request uuid,p_user uuid,p_definition jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_now timestamptz := clock_timestamp();
  v_deadline timestamptz;
  v_next_run timestamptz;
begin
  if p_request is null or p_user is null or p_definition is null then
    raise sqlstate 'PT400' using message='Scheduled race details are required.';
  end if;
  begin
    v_deadline := (p_definition->>'deadline')::timestamptz;
  exception when others then
    raise sqlstate 'PT400' using message='Invalid entry deadline.';
  end;
  if v_deadline is null then
    raise sqlstate 'PT400' using message='Invalid entry deadline.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_request::text,0));
  if not exists(select 1 from public.race_calendar_requests
      where id=p_request) then
    -- Vercel Hobby runs the 02:00 UTC cron somewhere in the 02:00-02:59
    -- window. Never count a run that may already have started.
    v_next_run := (pg_catalog.date_trunc('day',v_now at time zone 'UTC')
      + interval '2 hours') at time zone 'UTC';
    if v_now>=v_next_run then v_next_run:=v_next_run+interval '1 day'; end if;
    if v_deadline<=v_next_run+interval '70 minutes' then
      raise sqlstate 'PT400' using
        message='Entry deadline must follow the next autopilot scan.';
    end if;
  end if;
  return public.recovery_create_scheduled_race_day(
    p_request,p_user,p_definition);
end;
$$;
revoke all on function public.recovery_create_scheduled_race_day_safe(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.recovery_create_scheduled_race_day_safe(uuid,uuid,jsonb)
  to service_role;
commit;
