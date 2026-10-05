-- Count overdue races after excluding saved reveals. A limit on all OPEN
-- races can report a false truncation once enough revealed races accumulate.
begin;

create function public.recovery_overdue_division_reveals(p_now timestamptz)
returns table(event_id uuid)
language sql stable security invoker set search_path = '' as $$
  select e.id
  from public.events e
  where e.kind = 'one_day' and e.status = 'OPEN'
    and e.calendar_source in ('UCI', 'PELOTONIA')
    and e.tactics_deadline <= p_now
    and not exists (
      select 1 from public.recovery_division_reveals r
      where r.event_id = e.id
    )
  order by e.tactics_deadline, e.id
  limit 101;
$$;
revoke all on function public.recovery_overdue_division_reveals(timestamptz)
  from public, anon, authenticated;
grant execute on function public.recovery_overdue_division_reveals(timestamptz)
  to service_role;

commit;
