-- Service-only, division-scoped read of the immutable provisional candidate.
-- This avoids transferring every rival replay when one entered manager opens
-- a viewer. The candidate save path and legacy result/ledger stay unchanged.
begin;

create function public.recovery_get_v2_recorded_division(p_user uuid, p_event uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_team_count integer;
  v_team uuid;
  v_index integer;
  v_candidate public.recovery_v2_recorded_candidates;
  v_contract jsonb;
  v_division jsonb;
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
  v_contract := v_candidate.result_contract;
  if jsonb_typeof(v_contract->'divisions') is distinct from 'array' then
    raise sqlstate 'PT409' using message = 'The saved v2 recording needs review.';
  end if;
  select count(*) into v_matches
    from jsonb_array_elements(v_contract->'divisions') d
    where d->'index' = to_jsonb(v_index);
  if v_matches <> 1 then
    raise sqlstate 'PT409' using message = 'The saved v2 division needs review.';
  end if;
  select d.value into v_division
    from jsonb_array_elements(v_contract->'divisions') d
    where d.value->'index' = to_jsonb(v_index);
  return jsonb_build_object(
    'schemaVersion',v_contract->'schemaVersion',
    'engineVersion',v_contract->'engineVersion',
    'eventId',v_contract->'eventId',
    'seasonYear',v_contract->'seasonYear',
    'gender',v_contract->'gender',
    'tier',v_contract->'tier',
    'pointsPolicyVersion',v_contract->'pointsPolicyVersion',
    'divisionReveal',v_contract->'divisionReveal',
    'divisionCount',jsonb_array_length(v_contract->'divisions'),
    'division',v_division,
    'recordedAt',v_candidate.recorded_at);
end;
$$;
revoke all on function public.recovery_get_v2_recorded_division(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.recovery_get_v2_recorded_division(uuid,uuid)
  to service_role;
commit;
