-- Isolated two-phase reveal. No caller is wired to this RPC in production.
-- Entries and signed sporting awards are frozen in one transaction after the
-- registration deadline. Every write path for entries/awards uses the same lock.
begin;

revoke all on public.recovery_division_reveals,
  public.recovery_division_reveal_entries from service_role;
grant select, insert on public.recovery_division_reveals,
  public.recovery_division_reveal_entries to service_role;

create function public.recovery_commit_division_reveal(p_event uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_event public.events;
  v_reveal public.recovery_division_reveals;
  v_entrants integer;
  v_divisions integer;
  v_base integer;
  v_extra integer;
  v_min_points bigint;
  v_max_points bigint;
  v_assignments jsonb;
  v_policy constant text := 'provisional-zero-point-id-tiebreak-v1';
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select * into v_event from public.events e where e.id = p_event for update;
  if v_event.id is null then
    raise sqlstate 'PT404' using message = 'The scheduled race was not found.';
  end if;
  if v_event.registration_deadline is null or v_event.tactics_deadline is null then
    raise sqlstate 'PT409' using message = 'This race does not use a division reveal.';
  end if;

  select * into v_reveal from public.recovery_division_reveals r
    where r.event_id = p_event;
  if v_reveal.event_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'teamId', x.team_id,
      'earnedPointsAtLock', x.earned_points_at_lock,
      'divisionIndex', x.division_index,
      'seedRank', x.seed_rank
    ) order by x.seed_rank), '[]'::jsonb) into v_assignments
      from public.recovery_division_reveal_entries x where x.event_id = p_event;
    return jsonb_build_object('eventId', p_event, 'seasonYear', v_reveal.season_year,
      'gender', v_reveal.gender, 'pointsPolicyVersion', v_reveal.points_policy_version,
      'revealedAt', v_reveal.revealed_at, 'assignments', v_assignments,
      'alreadyRevealed', true);
  end if;

  if v_event.status is distinct from 'OPEN'
    or v_event.registration_deadline > pg_catalog.clock_timestamp()
    or v_event.tactics_deadline <= pg_catalog.clock_timestamp() then
    raise sqlstate 'PT409' using message = 'The division reveal is outside its phase.';
  end if;
  if exists(select 1 from public.recovery_race_commits c where c.event_id = p_event)
    or exists(select 1 from public.event_division_runs d where d.event_id = p_event)
    or exists(select 1 from public.event_team_results t where t.event_id = p_event) then
    raise sqlstate 'PT409' using message = 'Existing race data needs manual review.';
  end if;
  if not exists(select 1 from public.recovery_autopilot_jobs j
    where j.event_id = p_event and j.status = 'COMPLETE'
      and j.lease_token is null and j.lease_until is null) then
    raise sqlstate 'PT409' using message = 'The autopilot entry scan is incomplete.';
  end if;

  select count(*) into v_entrants from public.event_teams et where et.event_id = p_event;
  if v_entrants < 2 or v_entrants > 400 then
    raise sqlstate 'PT409' using message = 'A division reveal requires 2-400 teams.';
  end if;
  v_divisions := (v_entrants + 19) / 20;
  v_base := v_entrants / v_divisions;
  v_extra := v_entrants % v_divisions;

  -- Award timestamps make the ranking snapshot refer to registration close,
  -- even when the reveal job runs later. Signed corrections are included only
  -- if they were committed before the same cutoff.
  with points as (
    select et.team_id, coalesce(sum(a.points), 0)::bigint earned_points
    from public.event_teams et
    left join public.recovery_ranking_awards a on a.team_id = et.team_id
      and a.season_year = extract(year from v_event.scheduled_at at time zone 'UTC')::integer
      and a.gender = v_event.gender
      and a.awarded_at <= v_event.registration_deadline
    where et.event_id = p_event
    group by et.team_id
  )
  select min(earned_points), max(earned_points)
    into v_min_points, v_max_points from points;
  if v_min_points < 0 or v_max_points > 9007199254740991 then
    raise sqlstate 'PT409' using message = 'The locked team points need manual review.';
  end if;

  insert into public.recovery_division_reveals
    (event_id, season_year, gender, points_policy_version)
    values (p_event,
      extract(year from v_event.scheduled_at at time zone 'UTC')::integer,
      v_event.gender, v_policy);

  with points as (
    select et.team_id, coalesce(sum(a.points), 0)::bigint earned_points
    from public.event_teams et
    left join public.recovery_ranking_awards a on a.team_id = et.team_id
      and a.season_year = extract(year from v_event.scheduled_at at time zone 'UTC')::integer
      and a.gender = v_event.gender
      and a.awarded_at <= v_event.registration_deadline
    where et.event_id = p_event
    group by et.team_id
  ), ranked as (
    select team_id, earned_points,
      row_number() over (order by earned_points desc, team_id)::integer seed_rank
    from points
  )
  insert into public.recovery_division_reveal_entries
    (event_id, team_id, earned_points_at_lock, division_index, seed_rank)
  select p_event, r.team_id, r.earned_points,
    case when r.seed_rank <= (v_base + 1) * v_extra
      then (r.seed_rank + v_base) / (v_base + 1)
      else v_extra + (r.seed_rank - (v_base + 1) * v_extra + v_base - 1) / v_base
    end, r.seed_rank
  from ranked r;

  select * into v_reveal from public.recovery_division_reveals r
    where r.event_id = p_event;
  select jsonb_agg(jsonb_build_object(
    'teamId', x.team_id,
    'earnedPointsAtLock', x.earned_points_at_lock,
    'divisionIndex', x.division_index,
    'seedRank', x.seed_rank
  ) order by x.seed_rank) into v_assignments
    from public.recovery_division_reveal_entries x where x.event_id = p_event;
  return jsonb_build_object('eventId', p_event, 'seasonYear', v_reveal.season_year,
    'gender', v_reveal.gender, 'pointsPolicyVersion', v_reveal.points_policy_version,
    'revealedAt', v_reveal.revealed_at, 'assignments', v_assignments,
    'alreadyRevealed', false);
end;
$$;
revoke all on function public.recovery_commit_division_reveal(uuid)
  from public, anon, authenticated;
grant execute on function public.recovery_commit_division_reveal(uuid) to service_role;
commit;
