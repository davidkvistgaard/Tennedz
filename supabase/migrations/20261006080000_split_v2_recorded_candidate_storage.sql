-- Split future provisional v2 candidates by division. The legacy full JSONB
-- candidate column remains readable for already-recorded preview races. No
-- legacy event results, rider state or ranking awards are changed.
begin;

alter table public.recovery_v2_recorded_candidates
  alter column result_contract drop not null,
  add column contract_header jsonb;
alter table public.recovery_v2_recorded_candidates
  drop constraint recovery_v2_recorded_candidates_result_contract_check,
  add constraint recovery_v2_candidate_header_check check (
    (contract_header is null and result_contract is not null and
      result_contract->'schemaVersion' is not distinct from '1'::jsonb and
      result_contract->'engineVersion' is not distinct from '2'::jsonb and
      jsonb_typeof(result_contract->'divisions') is not distinct from 'array') or
    (contract_header is not null and result_contract is null and
      contract_header->'schemaVersion' is not distinct from '1'::jsonb and
      contract_header->'engineVersion' is not distinct from '2'::jsonb and
      not (contract_header ? 'divisions'))
  );

create table public.recovery_v2_recorded_divisions (
  event_id uuid not null references public.recovery_v2_recorded_candidates(event_id)
    on delete restrict,
  division_index smallint not null check (division_index between 1 and 20),
  result_division jsonb not null check (
    jsonb_typeof(result_division) is not distinct from 'object' and
    result_division->'index' is not distinct from to_jsonb(division_index::integer) and
    result_division->'recordingVersion' is not distinct from '2'::jsonb),
  primary key (event_id, division_index)
);
alter table public.recovery_v2_recorded_divisions enable row level security;
revoke all on public.recovery_v2_recorded_divisions from public, anon, authenticated;
grant select, insert on public.recovery_v2_recorded_divisions to service_role;

create or replace function public.recovery_save_v2_recorded_candidate(
  p_event uuid, p_contract jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_lock public.recovery_v2_tactics_commits;
  v_candidate public.recovery_v2_recorded_candidates;
  v_divisions integer;
  v_previous jsonb;
  v_saved_divisions jsonb;
  v_division jsonb;
  v_index integer;
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
    if v_candidate.contract_header is not null then
      select coalesce(jsonb_agg(d.result_division order by d.division_index),
        '[]'::jsonb) into v_saved_divisions
        from public.recovery_v2_recorded_divisions d
        where d.event_id = p_event;
      v_previous := v_candidate.contract_header ||
        jsonb_build_object('divisions',v_saved_divisions);
    else
      v_previous := v_candidate.result_contract;
    end if;
    if p_contract is distinct from v_previous then
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
  insert into public.recovery_v2_recorded_candidates
    (event_id,contract_header) values(p_event,p_contract - 'divisions');
  for v_division in select value from jsonb_array_elements(p_contract->'divisions') loop
    v_index := (v_division->>'index')::integer;
    if v_index is null or v_index < 1 or v_index > v_divisions or
      v_division->'recordingVersion' is distinct from '2'::jsonb then
      raise sqlstate 'PT400' using message = 'The v2 result contract does not match its lock.';
    end if;
    insert into public.recovery_v2_recorded_divisions
      (event_id,division_index,result_division)
      values(p_event,v_index,v_division);
  end loop;
  select * into v_candidate from public.recovery_v2_recorded_candidates c
    where c.event_id = p_event;
  return jsonb_build_object('eventId',p_event,
    'recordedAt',v_candidate.recorded_at,'alreadyRecorded',false);
end;
$$;

create or replace function public.recovery_get_v2_recorded_division(
  p_user uuid, p_event uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_team_count integer;
  v_team uuid;
  v_index integer;
  v_candidate public.recovery_v2_recorded_candidates;
  v_header jsonb;
  v_division jsonb;
  v_division_count integer;
  v_matches integer;
begin
  select count(*) into v_team_count from public.teams t where t.user_id = p_user;
  if v_team_count <> 1 then
    raise sqlstate 'PT403' using message = 'The team link is not unique.';
  end if;
  select t.id into v_team from public.teams t where t.user_id = p_user;
  select r.division_index into v_index
    from public.recovery_division_reveal_entries r
    join public.event_teams e on e.event_id = r.event_id
      and e.team_id = r.team_id
    where r.event_id = p_event and r.team_id = v_team;
  if v_index is null then
    raise sqlstate 'PT403' using message = 'The team is not in the revealed race.';
  end if;
  select * into v_candidate from public.recovery_v2_recorded_candidates c
    where c.event_id = p_event;
  if v_candidate.event_id is null then
    raise sqlstate 'PT404' using message = 'The v2 recording is not ready.';
  end if;
  if v_candidate.contract_header is not null then
    v_header := v_candidate.contract_header;
    select count(*) into v_division_count
      from public.recovery_v2_recorded_divisions d where d.event_id = p_event;
    select d.result_division into v_division
      from public.recovery_v2_recorded_divisions d
      where d.event_id = p_event and d.division_index = v_index;
    v_matches := case when v_division is null then 0 else 1 end;
  else
    v_header := v_candidate.result_contract - 'divisions';
    if jsonb_typeof(v_candidate.result_contract->'divisions') is distinct from 'array' then
      raise sqlstate 'PT409' using message = 'The saved v2 recording needs review.';
    end if;
    v_division_count := jsonb_array_length(v_candidate.result_contract->'divisions');
    select count(*) into v_matches
      from jsonb_array_elements(v_candidate.result_contract->'divisions') d
      where d.value->'index' = to_jsonb(v_index);
    if v_matches = 1 then
      select d.value into v_division
        from jsonb_array_elements(v_candidate.result_contract->'divisions') d
        where d.value->'index' = to_jsonb(v_index);
    end if;
  end if;
  if v_matches <> 1 or v_division_count < 1 then
    raise sqlstate 'PT409' using message = 'The saved v2 division needs review.';
  end if;
  return v_header || jsonb_build_object('divisionCount',v_division_count,
    'division',v_division,'recordedAt',v_candidate.recorded_at);
end;
$$;
commit;
