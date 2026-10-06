-- Private, provisional v2 output. This does not finish the event, expose a
-- replay, change rider state or award points in the legacy game. The service
-- must first run validateV2OneDayResultAgainstLock; SQL enforces identity and
-- immutable retry boundaries, not the full kilometre simulation.
begin;

create table public.recovery_v2_recorded_candidates (
  event_id uuid primary key references public.recovery_v2_tactics_commits(event_id)
    on delete restrict,
  result_contract jsonb not null,
  recorded_at timestamptz not null default now(),
  check (result_contract->'schemaVersion' is not distinct from '1'::jsonb
    and result_contract->'engineVersion' is not distinct from '2'::jsonb
    and jsonb_typeof(result_contract->'divisions') = 'array')
);
alter table public.recovery_v2_recorded_candidates enable row level security;
revoke all on public.recovery_v2_recorded_candidates from public, anon, authenticated;
grant select, insert on public.recovery_v2_recorded_candidates to service_role;

create function public.recovery_save_v2_recorded_candidate(
  p_event uuid, p_contract jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_lock public.recovery_v2_tactics_commits;
  v_candidate public.recovery_v2_recorded_candidates;
  v_divisions integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  select * into v_lock from public.recovery_v2_tactics_commits c
    where c.event_id = p_event;
  if v_lock.event_id is null then
    raise sqlstate 'PT409' using message = 'The v2 tactics input is not locked.';
  end if;
  select * into v_candidate from public.recovery_v2_recorded_candidates c
    where c.event_id = p_event;
  if v_candidate.event_id is not null then
    if p_contract is distinct from v_candidate.result_contract then
      raise sqlstate 'PT409' using message = 'The saved v2 recording differs from this retry.';
    end if;
    return jsonb_build_object('eventId',p_event,
      'recordedAt',v_candidate.recorded_at,'alreadyRecorded',true);
  end if;
  if v_event.kind is distinct from 'one_day'
    or v_event.status is distinct from 'OPEN'
    or v_event.registration_deadline is null
    or v_event.scheduled_at > pg_catalog.clock_timestamp()
    or v_event.tactics_deadline > pg_catalog.clock_timestamp()
    or v_event.race_tier is null
    or v_event.race_tier not between 1 and 6
    or exists(select 1 from public.recovery_race_commits c
      where c.event_id = p_event)
    or exists(select 1 from public.event_division_runs d
      where d.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'The v2 recording is outside its phase.';
  end if;
  select max(r.division_index) into v_divisions
    from public.recovery_division_reveal_entries r where r.event_id = p_event;
  if jsonb_typeof(p_contract) is distinct from 'object'
    or p_contract->'schemaVersion' is distinct from '1'::jsonb
    or p_contract->'engineVersion' is distinct from '2'::jsonb
    or p_contract->>'eventId' is distinct from p_event::text
    or p_contract->>'gender' is distinct from v_event.gender::text
    or p_contract->'tier' is distinct from to_jsonb(v_event.race_tier::integer)
    or p_contract->>'pointsPolicyVersion' is distinct from 'v0.1'
    or p_contract->'divisionReveal' is distinct from
      v_lock.input_snapshot->'locked_division_reveal'
    or jsonb_typeof(p_contract->'divisions') is distinct from 'array'
    or v_divisions is null then
    raise sqlstate 'PT400' using message = 'The v2 result contract does not match its lock.';
  end if;
  if jsonb_array_length(p_contract->'divisions') <> v_divisions then
    raise sqlstate 'PT400' using message = 'The v2 result contract does not match its lock.';
  end if;
  insert into public.recovery_v2_recorded_candidates(event_id,result_contract)
    values(p_event,p_contract);
  select * into v_candidate from public.recovery_v2_recorded_candidates c
    where c.event_id = p_event;
  return jsonb_build_object('eventId',p_event,
    'recordedAt',v_candidate.recorded_at,'alreadyRecorded',false);
end;
$$;
revoke all on function public.recovery_save_v2_recorded_candidate(uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.recovery_save_v2_recorded_candidate(uuid,jsonb)
  to service_role;
commit;
