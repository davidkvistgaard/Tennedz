-- A completed scan without a reveal at tactics close has no fair preparation window.
-- An administrator may explicitly declare a zero-fee race no contest; never move deadlines.
begin;

alter table public.recovery_two_phase_voids
  drop constraint recovery_two_phase_voids_reason_check;
alter table public.recovery_two_phase_voids
  add constraint recovery_two_phase_voids_reason_check
  check (reason in ('INCOMPLETE_ENTRY_SCAN', 'MISSED_DIVISION_REVEAL'));

create function public.recovery_void_missed_division_reveal(
  p_event uuid, p_user uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_job public.recovery_autopilot_jobs;
  v_void public.recovery_two_phase_voids;
  v_registered integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  if p_event is null or p_user is null then
    raise sqlstate 'PT400' using message = 'A race and administrator are required.';
  end if;
  select * into v_event from public.events where id = p_event for update;
  if not found then
    raise sqlstate 'PT404' using message = 'The race was not found.';
  end if;
  select * into v_void from public.recovery_two_phase_voids where event_id = p_event;
  if found then
    if v_event.status is distinct from 'CANCELLED' then
      raise sqlstate 'PT409' using message = 'The cancellation record conflicts with the race.';
    end if;
    return jsonb_build_object('ok', true, 'already_cancelled', true,
      'event_id', p_event, 'reason', v_void.reason,
      'registered_teams', v_void.registered_teams);
  end if;
  if v_event.status is distinct from 'OPEN'
    or v_event.kind is distinct from 'one_day'
    or v_event.registration_deadline is null
    or v_event.tactics_deadline is null
    or v_event.tactics_deadline > pg_catalog.clock_timestamp()
    or coalesce(v_event.entry_fee, 0) <> 0 then
    raise sqlstate 'PT409' using message = 'This race cannot be cancelled under the missed-reveal rule.';
  end if;
  select * into v_job from public.recovery_autopilot_jobs where event_id = p_event;
  if v_job.status is distinct from 'COMPLETE'
    or v_job.lease_token is not null or v_job.lease_until is not null then
    raise sqlstate 'PT409' using message = 'The entry scan is not safely complete.';
  end if;
  if exists(select 1 from public.recovery_division_reveals where event_id = p_event)
    or exists(select 1 from public.recovery_tactics_commits where event_id = p_event)
    or exists(select 1 from public.recovery_race_commits where event_id = p_event)
    or exists(select 1 from public.event_runs where event_id = p_event)
    or exists(select 1 from public.event_stages where event_id = p_event)
    or exists(select 1 from public.event_divisions where event_id = p_event)
    or exists(select 1 from public.event_division_runs where event_id = p_event)
    or exists(select 1 from public.event_team_results where event_id = p_event)
    or exists(select 1 from public.event_rider_results where event_id = p_event)
    or exists(select 1 from public.recovery_ranking_awards where event_id = p_event)
    or exists(select 1 from public.recovery_entry_receipts
      where event_id = p_event and fee_paid <> 0) then
    raise sqlstate 'PT409' using message = 'The race has a reveal, saved result or paid entry.';
  end if;
  select count(*) into v_registered from public.event_teams where event_id = p_event;
  insert into public.recovery_two_phase_voids(event_id, reason, decided_by,
    registered_teams, processed_teams, automatic_entries)
  values(p_event, 'MISSED_DIVISION_REVEAL', p_user, v_registered,
    v_job.processed_count, v_job.entered_count);
  update public.events set status = 'CANCELLED' where id = p_event;
  return jsonb_build_object('ok', true, 'already_cancelled', false,
    'event_id', p_event, 'reason', 'MISSED_DIVISION_REVEAL',
    'registered_teams', v_registered);
end;
$$;
revoke all on function public.recovery_void_missed_division_reveal(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.recovery_void_missed_division_reveal(uuid, uuid)
  to service_role;

commit;
