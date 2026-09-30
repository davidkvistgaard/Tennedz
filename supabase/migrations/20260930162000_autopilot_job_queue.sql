-- A resumable, service-only queue for scheduled one-day entries.
begin;

create table public.recovery_autopilot_jobs (
  event_id uuid primary key references public.events(id) on delete restrict,
  cursor_team_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETE')),
  lease_token uuid,
  lease_until timestamptz,
  processed_count integer not null default 0 check (processed_count >= 0),
  entered_count integer not null default 0 check (entered_count >= 0),
  updated_at timestamptz not null default now(),
  check ((lease_token is null) = (lease_until is null))
);
create index recovery_autopilot_jobs_pending_idx
  on public.recovery_autopilot_jobs(status, lease_until)
  where status = 'PENDING';
alter table public.recovery_autopilot_jobs enable row level security;
revoke all on public.recovery_autopilot_jobs from public, anon, authenticated;
grant select, insert, update on public.recovery_autopilot_jobs to service_role;

create function public.recovery_autopilot_claim_job(p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_job public.recovery_autopilot_jobs;
begin
  if p_token is null then
    raise sqlstate 'PT400' using message = 'A lease token is required.';
  end if;
  insert into public.recovery_autopilot_jobs(event_id)
    select e.id from public.events e
    where e.kind = 'one_day' and e.status = 'OPEN'
      and e.scheduled_at is not null
      and e.calendar_source in ('UCI', 'PELOTONIA')
      and e.deadline > now() and e.deadline <= now() + interval '48 hours'
    on conflict (event_id) do nothing;
  -- A manager may save a default after the first scan. Revisit completed races
  -- on a later invocation while entry is still open; existing entries are inert.
  update public.recovery_autopilot_jobs j
    set cursor_team_id = null, status = 'PENDING', updated_at = now()
    from public.events e
    where e.id = j.event_id and j.status = 'COMPLETE'
      and j.updated_at < now() - interval '6 hours'
      and e.status = 'OPEN' and e.deadline > now()
      and e.deadline <= now() + interval '48 hours';
  select j.* into v_job from public.recovery_autopilot_jobs j
    join public.events e on e.id = j.event_id
    where j.status = 'PENDING'
      and (j.lease_until is null or j.lease_until < now())
      and e.status = 'OPEN' and e.deadline > now()
    order by e.deadline, j.event_id
    for update of j skip locked limit 1;
  if v_job.event_id is null then return null; end if;
  update public.recovery_autopilot_jobs j
    set lease_token = p_token, lease_until = now() + interval '2 minutes',
        updated_at = now()
    where j.event_id = v_job.event_id;
  return jsonb_build_object('event_id', v_job.event_id,
    'cursor_team_id', v_job.cursor_team_id);
end;
$$;

create function public.recovery_autopilot_advance_job(
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
        entered_count = j.entered_count + p_entered,
        status = case when p_complete then 'COMPLETE' else 'PENDING' end,
        lease_token = null, lease_until = null, updated_at = now()
    where j.event_id = p_event and j.status = 'PENDING'
      and j.lease_token = p_token and j.lease_until >= now()
      and (p_processed = 0 or p_cursor is not null);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.recovery_autopilot_claim_job(uuid) from public, anon, authenticated;
revoke all on function public.recovery_autopilot_advance_job(uuid,uuid,uuid,integer,integer,boolean)
  from public, anon, authenticated;
grant execute on function public.recovery_autopilot_claim_job(uuid) to service_role;
grant execute on function public.recovery_autopilot_advance_job(uuid,uuid,uuid,integer,integer,boolean)
  to service_role;
commit;
