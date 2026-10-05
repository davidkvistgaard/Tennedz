-- A transaction can wait on the race lock across registration close.
-- Evaluate deadline and lease eligibility against wall time after acquiring it.
begin;

create or replace function public.recovery_autopilot_claim_job(p_token uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_job public.recovery_autopilot_jobs;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  if p_token is null then
    raise sqlstate 'PT400' using message = 'A lease token is required.';
  end if;
  insert into public.recovery_autopilot_jobs(event_id)
    select e.id from public.events e
    where e.kind = 'one_day' and e.status = 'OPEN'
      and e.scheduled_at is not null
      and e.calendar_source in ('UCI', 'PELOTONIA')
      and e.deadline > pg_catalog.clock_timestamp()
      and e.deadline <= pg_catalog.clock_timestamp() + interval '48 hours'
    on conflict (event_id) do nothing;
  update public.recovery_autopilot_jobs j
    set cursor_team_id = null, status = 'PENDING', updated_at = pg_catalog.clock_timestamp()
    from public.events e
    where e.id = j.event_id and j.status = 'COMPLETE'
      and j.updated_at < pg_catalog.clock_timestamp() - interval '6 hours'
      and e.status = 'OPEN' and e.deadline > pg_catalog.clock_timestamp()
      and e.deadline <= pg_catalog.clock_timestamp() + interval '48 hours';
  select j.* into v_job from public.recovery_autopilot_jobs j
    join public.events e on e.id = j.event_id
    where j.status = 'PENDING'
      and (j.lease_until is null or j.lease_until < pg_catalog.clock_timestamp())
      and e.status = 'OPEN' and e.deadline > pg_catalog.clock_timestamp()
    order by e.deadline, j.event_id
    for update of j skip locked limit 1;
  if v_job.event_id is null then return null; end if;
  update public.recovery_autopilot_jobs j
    set lease_token = p_token, lease_until = pg_catalog.clock_timestamp() + interval '2 minutes',
        updated_at = pg_catalog.clock_timestamp()
    where j.event_id = v_job.event_id;
  return jsonb_build_object('event_id', v_job.event_id,
    'cursor_team_id', v_job.cursor_team_id);
end;
$$;
revoke all on function public.recovery_autopilot_claim_job(uuid)
  from public, anon, authenticated;
grant execute on function public.recovery_autopilot_claim_job(uuid) to service_role;

commit;
