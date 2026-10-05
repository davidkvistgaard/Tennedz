-- Run only on the allowlisted isolated project. The final ROLLBACK removes
-- all fixture changes while returning the saved private simulator snapshot.
begin;
do $probe$
declare
  v_event uuid;
  v_registration timestamptz := clock_timestamp()-interval '2 hours';
begin
  select e.id into v_event from public.events e
    where e.kind='one_day' and e.status='OPEN'
      and e.registration_deadline is null
      and not exists(select 1 from public.recovery_race_commits c
        where c.event_id=e.id)
      and not exists(select 1 from public.recovery_autopilot_jobs j
        where j.event_id=e.id)
      and (select count(*) from public.event_teams et
        where et.event_id=e.id)=2
    order by e.id limit 1;
  if v_event is null then raise exception 'No isolated two-team event.'; end if;
  update public.events set deadline=v_registration,
    registration_deadline=v_registration,
    tactics_deadline=clock_timestamp()+interval '1 hour',
    scheduled_at=clock_timestamp()+interval '2 hours',
    calendar_source='PELOTONIA',race_tier=2
    where id=v_event;
  insert into public.recovery_autopilot_jobs(event_id,status)
    values(v_event,'COMPLETE');
  perform public.recovery_commit_division_reveal(v_event);
  update public.event_teams et set orders=jsonb_build_object(
    'version',1,'plan','balanced','riders',
    (select jsonb_object_agg(rider_id::text,
      jsonb_build_object('role',case when rider_id=et.captain_id
        then 'captain' else 'free' end,'effort','balanced'))
      from unnest(et.selected_riders) rider_id))
    where et.event_id=v_event;
  update public.events set tactics_deadline=clock_timestamp()-interval '1 minute'
    where id=v_event;
  perform public.recovery_commit_tactics_lock(v_event);
  perform pg_catalog.set_config('pelotonia.contract_event',v_event::text,true);
end;
$probe$;
select public.recovery_race_snapshot(
  pg_catalog.current_setting('pelotonia.contract_event')::uuid) as snapshot;
rollback;
