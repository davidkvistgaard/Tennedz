-- Preview-only v2 finish. It consumes an independently validated, immutable
-- recording candidate; the existing replay-v1 and legacy finish path stay intact.
begin;

create table public.recovery_v2_settlements (
  event_id uuid primary key references public.recovery_v2_recorded_candidates(event_id)
    on delete restrict,
  contract_md5 text not null check (length(contract_md5) = 32),
  award_count integer not null check (award_count > 0 and award_count <= 400),
  settled_at timestamptz not null default now()
);
alter table public.recovery_v2_settlements enable row level security;
revoke all on public.recovery_v2_settlements from public, anon, authenticated;
grant select, insert on public.recovery_v2_settlements to service_role;

create function public.recovery_settle_v2_one_day(
  p_event uuid, p_contract jsonb, p_ledger jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_lock public.recovery_v2_tactics_commits;
  v_candidate public.recovery_v2_recorded_candidates;
  v_marker public.recovery_v2_settlements;
  v_saved_contract jsonb;
  v_divisions jsonb;
  v_expected_ledger jsonb;
  v_given_ledger jsonb;
  v_saved_ledger jsonb;
  v_division_count integer;
  v_team_count integer;
  v_result_count integer;
  v_award_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  select * into v_lock from public.recovery_v2_tactics_commits c
    where c.event_id = p_event;
  select * into v_candidate from public.recovery_v2_recorded_candidates c
    where c.event_id = p_event;
  if v_lock.event_id is null or v_candidate.event_id is null then
    raise sqlstate 'PT409' using message = 'The v2 race lacks its locked recording.';
  end if;
  if v_candidate.contract_header is not null then
    if v_candidate.result_contract is not null then
      raise sqlstate 'PT409' using message = 'The v2 recording storage is ambiguous.';
    end if;
    select count(*), jsonb_agg(d.result_division order by d.division_index)
      into v_division_count, v_divisions
      from public.recovery_v2_recorded_divisions d
      where d.event_id = p_event;
    if v_division_count < 1 or exists(
      select 1 from public.recovery_v2_recorded_divisions d
      where d.event_id = p_event and
        (d.division_index > v_division_count or
          d.result_division->'index' is distinct from
            to_jsonb(d.division_index::integer))) then
      raise sqlstate 'PT409' using message = 'The v2 recording divisions are incomplete.';
    end if;
    v_saved_contract := v_candidate.contract_header ||
      jsonb_build_object('divisions',v_divisions);
  else
    if v_candidate.result_contract is null or exists(
      select 1 from public.recovery_v2_recorded_divisions d
      where d.event_id = p_event) then
      raise sqlstate 'PT409' using message = 'The v2 recording storage is ambiguous.';
    end if;
    v_saved_contract := v_candidate.result_contract;
    v_division_count := jsonb_array_length(v_saved_contract->'divisions');
  end if;
  if p_contract is distinct from v_saved_contract or
    jsonb_typeof(p_ledger) is distinct from 'array' or
    v_saved_contract->'schemaVersion' is distinct from '1'::jsonb or
    v_saved_contract->'engineVersion' is distinct from '2'::jsonb or
    v_saved_contract->>'eventId' is distinct from p_event::text or
    v_saved_contract->'divisionReveal' is distinct from
      v_lock.input_snapshot->'locked_division_reveal' or
    v_saved_contract->>'gender' is distinct from v_event.gender or
    v_saved_contract->'tier' is distinct from
      to_jsonb(v_event.race_tier::integer) or
    v_saved_contract->'seasonYear' is distinct from
      to_jsonb(extract(year from v_event.scheduled_at at time zone 'UTC')::integer) or
    v_saved_contract->>'pointsPolicyVersion' is distinct from 'v0.1' then
    raise sqlstate 'PT409' using message = 'The v2 settlement input differs from its saved lock.';
  end if;
  select count(*) into v_team_count from public.event_teams et
    where et.event_id = p_event;
  if v_team_count < 2 or v_team_count > 400 or
    v_division_count <> pg_catalog.ceil(v_team_count::numeric/20)::integer or
    jsonb_array_length(v_saved_contract->'divisions') <> v_division_count or
    jsonb_array_length(v_saved_contract->'divisionReveal'->'assignments')
      <> v_team_count or
    (select count(*) from public.recovery_division_reveal_entries r
      where r.event_id = p_event) <> v_team_count or
    exists(
      select 1 from public.recovery_division_reveal_entries r
      where r.event_id = p_event and not exists(
        select 1 from jsonb_array_elements(
          v_saved_contract->'divisionReveal'->'assignments') a
        where a.value->>'teamId' = r.team_id::text
          and a.value->>'divisionIndex' = r.division_index::text
          and a.value->>'seedRank' = r.seed_rank::text
          and a.value->>'earnedPointsAtLock' =
            r.earned_points_at_lock::text)) or
    exists(
      select 1 from jsonb_array_elements(v_saved_contract->'divisions') d
      where d.value->'teamIds' is distinct from (
        select jsonb_agg(a.value->'teamId'
          order by (a.value->>'seedRank')::integer)
        from jsonb_array_elements(
          v_saved_contract->'divisionReveal'->'assignments') a
        where a.value->>'divisionIndex' = d.value->>'index')) then
    raise sqlstate 'PT409' using message = 'The v2 divisions differ from their saved reveal.';
  end if;
  select count(*) into v_result_count
    from jsonb_array_elements(v_saved_contract->'divisions') d
    cross join lateral jsonb_array_elements(d.value->'riderResults') r;
  if v_result_count <> 8*v_team_count or
    (select count(distinct r.value->>'riderId')
      from jsonb_array_elements(v_saved_contract->'divisions') d
      cross join lateral jsonb_array_elements(d.value->'riderResults') r)
      <> v_result_count or
    exists(
      select 1 from jsonb_array_elements(v_saved_contract->'divisions') d
      cross join lateral jsonb_array_elements(d.value->'riderResults') r
      where not exists(
        select 1 from public.event_teams et
        join public.recovery_division_reveal_entries re
          on re.event_id = et.event_id and re.team_id = et.team_id
        where et.event_id = p_event
          and et.team_id::text = r.value->>'teamId'
          and (r.value->>'riderId')::uuid = any(et.selected_riders)
          and re.division_index::text = d.value->>'index')) or
    exists(
      select 1 from jsonb_array_elements(v_saved_contract->'divisions') d
      cross join lateral jsonb_array_elements(d.value->'awards') a
      where a.value->'divisionIndex' is distinct from d.value->'index'
        or not exists(
          select 1 from jsonb_array_elements(d.value->'riderResults') r
          where r.value->'riderId' = a.value->'riderId'
            and r.value->'teamId' = a.value->'teamId'
            and r.value->'position' = a.value->'placing'
            and r.value->'rankingPoints' = a.value->'points')) or
    exists(
      select 1 from jsonb_array_elements(v_saved_contract->'divisions') d
      cross join lateral jsonb_array_elements(d.value->'riderResults') r
      where (r.value->>'rankingPoints')::integer > 0 and not exists(
        select 1 from jsonb_array_elements(d.value->'awards') a
        where a.value->'riderId' = r.value->'riderId'
          and a.value->'teamId' = r.value->'teamId'
          and a.value->'placing' = r.value->'position'
          and a.value->'points' = r.value->'rankingPoints')) then
    raise sqlstate 'PT409' using message = 'The v2 rider results differ from the locked lineups.';
  end if;
  -- The server has independently re-simulated this exact contract. Compare
  -- each proposed ledger row to the stored division awards inside this lock.
  select jsonb_agg(jsonb_build_object(
      'award_key',a.value->>'awardKey',
      'rider_id',a.value->>'riderId',
      'team_id',a.value->>'teamId',
      'event_id',p_event::text,
      'season_year',v_saved_contract->'seasonYear',
      'gender',v_event.gender,
      'calendar_source',v_event.calendar_source,
      'event_format','ONE_DAY',
      'race_tier',v_event.race_tier,
      'result_type','ONE_DAY',
      'result_place',a.value->'placing',
      'points',a.value->'points',
      'points_policy_version',v_saved_contract->>'pointsPolicyVersion')
      order by a.value->>'awardKey')
    into v_expected_ledger
    from jsonb_array_elements(v_saved_contract->'divisions') d
    cross join lateral jsonb_array_elements(d.value->'awards') a;
  select count(*), jsonb_agg(l.value order by l.value->>'award_key')
    into v_award_count,v_given_ledger
    from jsonb_array_elements(p_ledger) l;
  if v_award_count < 1 or v_award_count > 400 or
    v_given_ledger is distinct from v_expected_ledger or
    (select count(distinct l.value->>'award_key') from
      jsonb_array_elements(p_ledger) l) <> v_award_count or
    (select count(distinct l.value->>'rider_id') from
      jsonb_array_elements(p_ledger) l) <> v_award_count or
    exists(select 1 from jsonb_array_elements(p_ledger) l
      where (l.value->>'points')::integer <= 0 or
        l.value->>'award_key' is distinct from
          'one_day:' || p_event::text || ':' || (l.value->>'rider_id')) then
    raise sqlstate 'PT409' using message = 'The v2 ranking awards differ from the recording.';
  end if;
  select * into v_marker from public.recovery_v2_settlements s
    where s.event_id = p_event;
  if v_marker.event_id is not null then
    select jsonb_agg(jsonb_build_object(
      'award_key',a.award_key,'rider_id',a.rider_id::text,
      'team_id',a.team_id::text,'event_id',a.event_id::text,
      'season_year',a.season_year,'gender',a.gender,
      'calendar_source',a.calendar_source,'event_format',a.event_format,
      'race_tier',a.race_tier,'result_type',a.result_type,
      'result_place',a.result_place,'points',a.points,
      'points_policy_version',a.points_policy_version)
      order by a.award_key) into v_saved_ledger
      from public.recovery_ranking_awards a where a.event_id = p_event;
    if v_event.status is distinct from 'FINISHED' or
      v_marker.contract_md5 is distinct from md5(v_saved_contract::text) or
      v_marker.award_count <> v_award_count or
      v_saved_ledger is distinct from v_expected_ledger then
      raise sqlstate 'PT409' using message = 'The existing v2 settlement needs review.';
    end if;
    return jsonb_build_object('eventId',p_event,'settledAt',v_marker.settled_at,
      'awardCount',v_award_count,'alreadySettled',true);
  end if;
  if v_event.kind is distinct from 'one_day' or
    v_event.status is distinct from 'OPEN' or
    v_event.registration_deadline is null or
    v_event.tactics_deadline is null or
    v_event.scheduled_at > pg_catalog.clock_timestamp() or
    v_event.tactics_deadline > pg_catalog.clock_timestamp() or
    v_event.registration_deadline > pg_catalog.clock_timestamp() or
    v_event.registration_deadline is distinct from
      (v_lock.input_snapshot->'event'->>'registration_deadline')::timestamptz or
    v_event.tactics_deadline is distinct from
      (v_lock.input_snapshot->'event'->>'tactics_deadline')::timestamptz or
    v_event.scheduled_at is distinct from
      (v_lock.input_snapshot->'event'->>'scheduled_at')::timestamptz or
    v_event.calendar_source is distinct from
      v_lock.input_snapshot->'event'->>'calendar_source' or
    v_event.gender is distinct from
      v_lock.input_snapshot->'event'->>'gender' or
    v_event.race_tier is distinct from
      (v_lock.input_snapshot->'event'->>'race_tier')::smallint or
    exists(select 1 from public.recovery_race_commits
      where event_id = p_event) or
    exists(select 1 from public.event_division_runs
      where event_id = p_event) or
    exists(select 1 from public.event_divisions
      where event_id = p_event) or
    exists(select 1 from public.event_team_results
      where event_id = p_event) or
    exists(select 1 from public.event_rider_results
      where event_id = p_event) or
    exists(select 1 from public.event_runs
      where event_id = p_event) or
    exists(select 1 from public.event_stages
      where event_id = p_event) or
    exists(select 1 from public.recovery_ranking_awards
      where event_id = p_event) then
    raise sqlstate 'PT409' using message = 'The v2 race is not ready for settlement.';
  end if;
  insert into public.recovery_ranking_awards (
    award_key,rider_id,team_id,event_id,season_year,gender,
    calendar_source,event_format,race_tier,result_type,result_place,
    points,points_policy_version)
  select l.value->>'award_key',(l.value->>'rider_id')::uuid,
    (l.value->>'team_id')::uuid,p_event,
    (l.value->>'season_year')::integer,l.value->>'gender',
    l.value->>'calendar_source',l.value->>'event_format',
    (l.value->>'race_tier')::smallint,l.value->>'result_type',
    (l.value->>'result_place')::integer,(l.value->>'points')::integer,
    l.value->>'points_policy_version'
  from jsonb_array_elements(p_ledger) l;
  update public.events set status='FINISHED' where id=p_event;
  insert into public.recovery_v2_settlements
    (event_id,contract_md5,award_count)
    values(p_event,md5(v_saved_contract::text),v_award_count)
    returning * into v_marker;
  return jsonb_build_object('eventId',p_event,'settledAt',v_marker.settled_at,
    'awardCount',v_award_count,'alreadySettled',false);
end;
$$;
revoke all on function public.recovery_settle_v2_one_day(uuid,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.recovery_settle_v2_one_day(uuid,jsonb,jsonb)
  to service_role;
commit;
