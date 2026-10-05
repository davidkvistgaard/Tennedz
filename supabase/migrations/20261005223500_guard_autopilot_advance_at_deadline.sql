-- Claim, entry and no-contest all use this race lock. Recheck the event and
-- lease against wall time under the same lock before recording scan progress.
begin;

create or replace function public.recovery_autopilot_advance_job(
  p_event uuid, p_token uuid, p_cursor uuid, p_processed integer,
  p_entered integer, p_complete boolean)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  v_rows integer;
  v_now timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  v_now := pg_catalog.clock_timestamp();
  if p_processed < 0 or p_entered < 0 or p_entered > p_processed
    or p_complete is null or p_token is null then
    raise sqlstate 'PT400' using message = 'Invalid autopilot progress.';
  end if;
  update public.recovery_autopilot_jobs j
    set cursor_team_id = case when p_processed > 0 then p_cursor else j.cursor_team_id end,
        processed_count = j.processed_count + p_processed,
        entered_count = (select count(*)::integer from public.recovery_autopilot_entries a
          where a.event_id = p_event),
        status = case when p_complete then 'COMPLETE' else 'PENDING' end,
        lease_token = null, lease_until = null, updated_at = v_now
    from public.events e
    where e.id = j.event_id and j.event_id = p_event
      and e.status = 'OPEN' and e.deadline > v_now
      and j.status = 'PENDING' and j.lease_token = p_token
      and j.lease_until >= v_now
      and (p_processed = 0 or p_cursor is not null);
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;
revoke all on function public.recovery_autopilot_advance_job(uuid, uuid, uuid, integer, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.recovery_autopilot_advance_job(uuid, uuid, uuid, integer, integer, boolean)
  to service_role;

commit;
