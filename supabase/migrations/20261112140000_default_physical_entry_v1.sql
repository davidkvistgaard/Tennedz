-- A manager may save a reusable, rider-independent one-day tactic.
-- Race-specific orders always take precedence. Private to game service.
create table public.recovery_default_tactics_v1 (
  team_id uuid not null references public.teams(id) on delete cascade,
  gender text not null check (gender in ('M','F')),
  event_format text not null check (event_format='ONE_DAY'),
  effort text not null check (effort in ('conserve','steady','hard')),
  chase text not null check (chase in ('ignore','selective','all')),
  attack text not null check (attack in ('none','selective','repeated')),
  front_work text not null check (front_work in ('rotate','sit_in')),
  sporting_goal text not null check (sporting_goal in
    ('none','sprint_finish','summit_attack','break_stage')),
  updated_at timestamptz not null default clock_timestamp(),
  primary key(team_id,gender,event_format)
);
alter table public.recovery_default_tactics_v1 enable row level security;
revoke all on public.recovery_default_tactics_v1
  from public,anon,authenticated;
grant select,insert,update on public.recovery_default_tactics_v1
  to service_role;

-- Keep the provenance separate so old physical input and recording schemas
-- remain immutable. A generated choice is never presented as manager input.
create table public.recovery_default_physical_entry_audit_v1 (
  event_id uuid not null,
  team_id uuid not null,
  policy_version text not null
    check (policy_version='default-physical-entry-v1'),
  lineup_source text not null
    check (lineup_source in ('entered','manager_default','game_ai')),
  tactics_source text not null
    check (tactics_source in ('manager_default','game_ai')),
  committed_at timestamptz not null default clock_timestamp(),
  primary key(event_id,team_id),
  foreign key(event_id,team_id)
    references public.recovery_physical_entry_inputs(event_id,team_id)
);
alter table public.recovery_default_physical_entry_audit_v1
  enable row level security;
revoke all on public.recovery_default_physical_entry_audit_v1
  from public,anon,authenticated;
grant select,insert on public.recovery_default_physical_entry_audit_v1
  to service_role;

-- The first participant to prepare an expired, entered one-day race may
-- supply validated missing inputs. The transaction rechecks membership,
-- eligibility and absence of manager input under the same race lock.
create function public.recovery_commit_default_physical_entries_v1(
  p_event uuid,p_defaults jsonb
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare e public.events; gd date; item jsonb; entry public.event_teams;
  team_uuid uuid; ids uuid[]; captain uuid; bibs jsonb;
  inserted_count integer := 0; expected_count integer;
begin
  perform pg_advisory_xact_lock(73192026);
  select * into e from public.events where id=p_event for update;
  if not found or e.kind is distinct from 'one_day'
    or e.status is distinct from 'OPEN'
    or e.deadline>clock_timestamp()
    or coalesce(e.race_team_size,8)<>8 then
    raise exception using errcode='PT409',
      message='This entered one-day race is not ready for default tactics.';
  end if;
  if jsonb_typeof(p_defaults) is distinct from 'array'
    or jsonb_array_length(p_defaults)>400 or
    exists(select 1 from public.recovery_race_commits
      where event_id=p_event) or
    exists(select 1 from public.recovery_position_race_recordings
      where event_id=p_event) or
    exists(select 1 from public.event_division_runs
      where event_id=p_event) or
    exists(select 1 from public.event_team_results
      where event_id=p_event) or
    exists(select 1 from public.event_rider_results
      where event_id=p_event) or
    exists(select 1 from public.event_runs
      where event_id=p_event) or
    exists(select 1 from public.event_stages
      where event_id=p_event) then
    raise exception using errcode='PT409',
      message='This race already has a recording or invalid defaults.';
  end if;
  select game_date into gd from public.game_state where id=1;
  if gd is null then
    raise exception using errcode='PT409',
      message='The game date is missing.';
  end if;
  for item in select value from jsonb_array_elements(p_defaults) x(value)
  loop
    if item->>'policyVersion' is distinct from
        'default-physical-entry-v1'
      or item->>'lineupSource' not in
        ('entered','manager_default','game_ai')
      or item->>'tacticsSource' not in
        ('manager_default','game_ai')
      or jsonb_typeof(item->'selectedRiders') is distinct from 'array'
      or jsonb_typeof(item->'orders') is distinct from 'object'
      or jsonb_typeof(item->'stake') is distinct from 'object'
      or jsonb_typeof(item->'teamStyle') is distinct from 'object' then
      raise exception using errcode='PT400',
        message='The generated race input is incomplete.';
    end if;
    team_uuid := (item->>'teamId')::uuid;
    captain := (item->>'captainId')::uuid;
    ids := array(select jsonb_array_elements_text(
      item->'selectedRiders')::uuid);
    select * into entry from public.event_teams
      where event_id=p_event and team_id=team_uuid for update;
    if not found then
      raise exception using errcode='PT403',
        message='Defaults may only be assigned to entered teams.';
    end if;
    if exists(select 1 from public.recovery_physical_entry_inputs
      where event_id=p_event and team_id=team_uuid) then
      continue;
    end if;
    if cardinality(ids)<>8 or captain is null
      or not (captain=any(ids))
      or (select count(distinct rider_id)
        from unnest(ids) rider_id)<>8
      or (select count(distinct r.id) from public.riders r
        join public.team_riders tr on tr.rider_id=r.id
        where tr.team_id=team_uuid and r.id=any(ids)
          and r.gender=e.gender
          and (r.injury_until is null or r.injury_until<=gd))<>8
      or item->'orders'->>'captainId' is distinct from
        captain::text
      or jsonb_typeof(item->'orders'->'baseline')
        is distinct from 'object'
      or not ((item->'orders'->'baseline') ?&
        array['effort','chase','attack','frontWork'])
      or item->'stake'->>'sportingCaptainId' is distinct
        from captain::text
      or item->'stake'->>'sportingGoal' not in
        ('none','sprint_finish','summit_attack','break_stage')
      or item->'teamStyle'->>'id' is distinct from
        team_uuid::text then
      raise exception using errcode='PT400',
        message='The generated lineup or tactic is invalid.';
    end if;
    if cardinality(entry.selected_riders)=8
      and entry.captain_id is not null then
      if entry.selected_riders is distinct from ids
        or entry.captain_id is distinct from captain
        or item->>'lineupSource' is distinct from 'entered' then
        raise exception using errcode='PT409',
          message='The manager lineup changed before default commitment.';
      end if;
    else
      update public.event_teams set selected_riders=ids,
        captain_id=captain,orders=null
        where event_id=p_event and team_id=team_uuid;
    end if;
    select jsonb_object_agg(rider_id::text,
      nextval('public.recovery_physical_bib_numbers'::regclass))
      into bibs from unnest(ids) rider_id;
    insert into public.recovery_physical_entry_inputs(
      event_id,team_id,schema_version,selected_riders,captain_id,
      orders,stake,team_style,rider_numbers)
    values(p_event,team_uuid,'physical-entry-input-v1',ids,captain,
      item->'orders',item->'stake',item->'teamStyle',bibs);
    insert into public.recovery_default_physical_entry_audit_v1(
      event_id,team_id,policy_version,lineup_source,tactics_source)
    values(p_event,team_uuid,'default-physical-entry-v1',
      item->>'lineupSource',item->>'tacticsSource');
    inserted_count := inserted_count+1;
  end loop;
  select count(*) into expected_count from public.event_teams
    where event_id=p_event;
  if (select count(*) from public.recovery_physical_entry_inputs
    where event_id=p_event)<>expected_count then
    raise exception using errcode='PT409',
      message='An entered team still has no physical race input.';
  end if;
  return jsonb_build_object('ok',true,'event_id',p_event,
    'default_entries_committed',inserted_count,
    'total_entries',expected_count);
end $$;
revoke all on function
  public.recovery_commit_default_physical_entries_v1(uuid,jsonb)
  from public,anon,authenticated;
grant execute on function
  public.recovery_commit_default_physical_entries_v1(uuid,jsonb)
  to service_role;
