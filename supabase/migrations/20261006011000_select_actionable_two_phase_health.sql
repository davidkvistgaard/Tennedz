-- Keep old revealed but unrun races from hiding an actionable race in the
-- administrator's bounded health scan. Recent revealed races remain visible.
begin;

create function public.recovery_actionable_two_phase_health(p_now timestamptz)
returns table(id uuid, name text, registration_deadline timestamptz,
  tactics_deadline timestamptz)
language sql stable security invoker set search_path = '' as $$
  select e.id, e.name::text, e.registration_deadline, e.tactics_deadline
  from public.events e
  where e.kind = 'one_day' and e.status = 'OPEN'
    and e.calendar_source in ('UCI', 'PELOTONIA')
    and e.registration_deadline is not null
    and e.registration_deadline <= p_now + interval '48 hours'
    and (e.tactics_deadline >= p_now or not exists (
      select 1 from public.recovery_division_reveals r
      where r.event_id = e.id
    ))
  order by e.registration_deadline, e.id
  limit 101;
$$;
revoke all on function public.recovery_actionable_two_phase_health(timestamptz)
  from public, anon, authenticated;
grant execute on function public.recovery_actionable_two_phase_health(timestamptz)
  to service_role;

commit;
