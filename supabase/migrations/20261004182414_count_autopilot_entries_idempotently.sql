-- Count distinct automatic entries across retries and later rescans.
create table public.recovery_autopilot_entries (
  event_id uuid not null,
  team_id uuid not null,
  entered_at timestamptz not null default now(),
  primary key (event_id,team_id),
  foreign key (event_id,team_id) references public.event_teams(event_id,team_id)
    on delete cascade
);
alter table public.recovery_autopilot_entries enable row level security;
revoke all on public.recovery_autopilot_entries from public,anon,authenticated;
grant select,insert on public.recovery_autopilot_entries to service_role;
create or replace function public.recovery_autopilot_join_event(
  p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,p_orders jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_team_id uuid; v_count integer; v_event public.events; v_result jsonb;
begin
  -- The existing join uses the same advisory lock. This check and join are one
  -- transaction, so a concurrent manual selection can never be overwritten.
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select count(*),(array_agg(t.id))[1] into v_count,v_team_id
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
  insert into public.recovery_autopilot_entries(event_id,team_id)
    values(p_event,v_team_id) on conflict do nothing;
  return v_result||jsonb_build_object('entered',true);
end;
$$;
create or replace function public.recovery_autopilot_advance_job(
  p_event uuid, p_token uuid, p_cursor uuid, p_processed integer,
  p_entered integer, p_complete boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_rows integer;
begin
  if p_processed < 0 or p_entered < 0 or p_entered > p_processed
    or p_complete is null or p_token is null then
    raise sqlstate 'PT400' using message = 'Invalid autopilot progress.';
  end if;
  update public.recovery_autopilot_jobs j
    set cursor_team_id = case when p_processed > 0 then p_cursor else j.cursor_team_id end,
        processed_count = j.processed_count + p_processed,
        entered_count = (select count(*)::integer from public.recovery_autopilot_entries a where a.event_id = p_event),
        status = case when p_complete then 'COMPLETE' else 'PENDING' end,
        lease_token = null, lease_until = null, updated_at = now()
    where j.event_id = p_event and j.status = 'PENDING'
      and j.lease_token = p_token and j.lease_until >= now()
      and (p_processed = 0 or p_cursor is not null);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.recovery_autopilot_join_event(uuid,uuid,uuid[],uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.recovery_autopilot_join_event(uuid,uuid,uuid[],uuid,jsonb)
  to service_role;
revoke all on function public.recovery_autopilot_advance_job(uuid,uuid,uuid,integer,integer,boolean)
  from public,anon,authenticated;
grant execute on function public.recovery_autopilot_advance_job(uuid,uuid,uuid,integer,integer,boolean)
  to service_role;
