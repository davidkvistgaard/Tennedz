-- Select unrevealed races before applying the cron batch limit. A fixed
-- events.limit(20) would otherwise starve later races once the first twenty
-- have saved reveals. Completed scans come first so pending scans cannot
-- consume every slot while the function is inside its 60-second budget.
begin;

create function public.recovery_due_division_reveals(p_now timestamptz)
returns table(event_id uuid, autopilot_complete boolean)
language sql stable security invoker set search_path = '' as $$
  select e.id,
    coalesce(j.status = 'COMPLETE' and j.lease_token is null
      and j.lease_until is null, false) as autopilot_complete
  from public.events e
  left join public.recovery_autopilot_jobs j on j.event_id = e.id
  where e.kind = 'one_day' and e.status = 'OPEN'
    and e.registration_deadline <= p_now
    and e.tactics_deadline > p_now
    and not exists (
      select 1 from public.recovery_division_reveals r
      where r.event_id = e.id
    )
  order by autopilot_complete desc, e.registration_deadline, e.id
  limit 20;
$$;
revoke all on function public.recovery_due_division_reveals(timestamptz)
  from public, anon, authenticated;
grant execute on function public.recovery_due_division_reveals(timestamptz)
  to service_role;

commit;
