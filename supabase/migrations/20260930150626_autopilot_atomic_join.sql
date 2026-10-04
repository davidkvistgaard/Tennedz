-- Keep manual entries authoritative even when a scheduler races with a manager.
begin;
create function public.recovery_autopilot_join_event(
  p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,p_orders jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_team_id uuid; v_count integer; v_event public.events; v_result jsonb;
begin
  -- The existing join uses the same advisory lock. This check and join are one
  -- transaction, so a concurrent manual selection can never be overwritten.
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select count(*),min(t.id) into v_count,v_team_id
    from public.teams t where t.user_id=p_user;
  if v_count<>1 then
    raise sqlstate 'PT409' using message='The team link is not unique.';
  end if;
  if exists(select 1 from public.event_teams et
    where et.event_id=p_event and et.team_id=v_team_id) then
    return jsonb_build_object('ok',true,'entered',false,'reason','ENTRY_ALREADY_EXISTS',
      'event_id',p_event,'team_id',v_team_id);
  end if;
  select * into v_event from public.events e where e.id=p_event;
  if v_event.id is null or v_event.kind<>'one_day' or v_event.scheduled_at is null
    or coalesce(v_event.calendar_source,'') not in ('UCI','PELOTONIA')
    or extract(isodow from v_event.scheduled_at at time zone 'UTC') not in (3,7) then
    raise sqlstate 'PT409' using message='The autopilot race is not scheduled.';
  end if;
  if exists(select 1 from public.event_teams et
    join public.events other on other.id=et.event_id
    where et.team_id=v_team_id and et.event_id<>p_event
      and other.kind='one_day' and other.gender=v_event.gender
      and (other.scheduled_at at time zone 'UTC')::date=
          (v_event.scheduled_at at time zone 'UTC')::date) then
    return jsonb_build_object('ok',true,'entered',false,
      'reason','SIMULTANEOUS_EVENT_PRIORITY_UNRESOLVED',
      'event_id',p_event,'team_id',v_team_id);
  end if;
  v_result:=public.recovery_join_event_with_orders(
    p_user,p_event,p_riders,p_captain,p_orders);
  return v_result||jsonb_build_object('entered',true);
end;
$$;
revoke all on function public.recovery_autopilot_join_event(uuid,uuid,uuid[],uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.recovery_autopilot_join_event(uuid,uuid,uuid[],uuid,jsonb)
  to service_role;
commit;
