-- Opt-in no-contest rule for a missed two-phase registration scan.
-- An administrator must review and invoke this; deadlines and entries never
-- change silently. All existing registrations remain as an audit trail.
begin;

create table public.recovery_two_phase_voids (
  event_id uuid primary key references public.events(id) on delete restrict,
  reason text not null check (reason = 'INCOMPLETE_ENTRY_SCAN'),
  decided_by uuid not null,
  voided_at timestamptz not null default now(),
  registered_teams integer not null check (registered_teams >= 0),
  processed_teams integer not null check (processed_teams >= 0),
  automatic_entries integer not null check (automatic_entries >= 0)
);
alter table public.recovery_two_phase_voids enable row level security;
revoke all on public.recovery_two_phase_voids from public, anon, authenticated;
grant select, insert on public.recovery_two_phase_voids to service_role;

create function public.recovery_void_incomplete_two_phase_race(
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
      'event_id', p_event, 'registered_teams', v_void.registered_teams);
  end if;
  if v_event.status is distinct from 'OPEN'
    or v_event.kind is distinct from 'one_day'
    or v_event.registration_deadline is null
    or v_event.tactics_deadline is null
    or v_event.registration_deadline > pg_catalog.clock_timestamp()
    or coalesce(v_event.entry_fee, 0) <> 0 then
    raise sqlstate 'PT409' using message = 'This race cannot be cancelled under the missed-scan rule.';
  end if;
  select * into v_job from public.recovery_autopilot_jobs where event_id = p_event;
  if v_job.lease_token is not null and v_job.lease_until >= pg_catalog.clock_timestamp() then
    raise sqlstate 'PT409' using message = 'The entry scan lease is still active.';
  end if;
  if v_job.status = 'COMPLETE'
    or exists(select 1 from public.recovery_division_reveals where event_id = p_event)
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
    raise sqlstate 'PT409' using message = 'The race has a completed scan, saved result or paid entry.';
  end if;
  select count(*) into v_registered from public.event_teams where event_id = p_event;
  insert into public.recovery_two_phase_voids(event_id, reason, decided_by,
    registered_teams, processed_teams, automatic_entries)
  values(p_event, 'INCOMPLETE_ENTRY_SCAN', p_user, v_registered,
    coalesce(v_job.processed_count, 0), coalesce(v_job.entered_count, 0));
  update public.events set status = 'CANCELLED' where id = p_event;
  return jsonb_build_object('ok', true, 'already_cancelled', false,
    'event_id', p_event, 'registered_teams', v_registered);
end;
$$;
revoke all on function public.recovery_void_incomplete_two_phase_race(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.recovery_void_incomplete_two_phase_race(uuid, uuid)
  to service_role;

commit;
