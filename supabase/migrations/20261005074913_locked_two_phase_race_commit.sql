-- Opted-in two-phase races run from the immutable tactics snapshot. Legacy
-- races still use the live one-deadline snapshot and finish transaction.
begin;

create or replace function public.recovery_race_snapshot(p_event uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  e public.events;
  s public.stage_profiles;
  gd date;
  ts jsonb;
  previous jsonb;
  locked jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  select c.summary into previous from public.recovery_race_commits c
    where c.event_id = p_event;
  if found then return jsonb_build_object('finished', true, 'summary', previous); end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise sqlstate 'PT404' using message = 'The race was not found.'; end if;
  if e.kind <> 'one_day' or e.status is distinct from 'OPEN' then
    raise sqlstate 'PT409' using message = 'This one-day race is not open.';
  end if;
  if e.deadline > pg_catalog.clock_timestamp() then
    raise sqlstate 'PT409' using message = 'Registration has not closed.';
  end if;
  if exists(select 1 from public.event_division_runs where event_id = p_event)
    or exists(select 1 from public.event_team_results where event_id = p_event)
    or exists(select 1 from public.event_rider_results where event_id = p_event)
    or exists(select 1 from public.event_runs where event_id = p_event)
    or exists(select 1 from public.event_stages where event_id = p_event) then
    raise sqlstate 'PT409' using message = 'Existing race data needs manual review.';
  end if;

  -- The tactics-lock RPC calls this function before its own insert, including
  -- on delayed retries. Once a lock exists, every later caller sees the same
  -- final lineup, orders, riders, weather inputs, and saved point division.
  if e.registration_deadline is not null then
    select c.input_snapshot into locked from public.recovery_tactics_commits c
      where c.event_id = p_event;
    if found then return locked; end if;
  end if;

  select * into s from public.stage_profiles where id = e.stage_profile_id;
  if not found then raise sqlstate 'PT409' using message = 'The route profile is missing.'; end if;
  select game_date into gd from public.game_state where id = 1;
  if gd is null then raise sqlstate 'PT409' using message = 'The game date is missing.'; end if;
  select coalesce(jsonb_agg(x.bundle order by x.team_id), '[]'::jsonb) into ts from (
    select t.id team_id, jsonb_build_object('id', t.id, 'name', t.name,
      'entry', to_jsonb(et),
      'riders', (select coalesce(jsonb_agg(to_jsonb(r) order by r.id), '[]'::jsonb)
        from public.riders r where exists(select 1 from public.team_riders tr
          where tr.team_id = t.id and tr.rider_id = r.id))) bundle
    from public.event_teams et join public.teams t on t.id = et.team_id
    where et.event_id = p_event
  ) x;
  if jsonb_array_length(ts) < 2 or jsonb_array_length(ts) > 400 then
    raise sqlstate 'PT409' using message = 'A one-day race requires 2-400 teams.';
  end if;
  return jsonb_build_object('event', to_jsonb(e), 'stage', to_jsonb(s),
    'game_date', gd, 'teams', ts);
end;
$$;

-- This trigger runs after the existing finish RPC inserted all result rows,
-- but before its commit insert. Any mismatch rolls back the whole transaction,
-- including rider changes, ratings, divisions, and award ledger writes.
create or replace function public.recovery_guard_unfinished_two_phase_commit()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  e public.events;
  locked jsonb;
  entrants integer;
  divisions integer;
begin
  select * into e from public.events where id = new.event_id;
  if e.registration_deadline is null then return new; end if;
  select c.input_snapshot into locked from public.recovery_tactics_commits c
    where c.event_id = new.event_id;
  if locked is null or new.input_snapshot is distinct from locked
    or e.status is distinct from 'FINISHED'
    or e.scheduled_at > pg_catalog.clock_timestamp() then
    raise sqlstate 'PT409' using message = 'The saved tactics input is not ready to finish.';
  end if;
  select count(*), max(r.division_index) into entrants, divisions
    from public.recovery_division_reveal_entries r
    where r.event_id = new.event_id;
  if entrants < 2 or entrants > 400 or divisions < 1
    or (select count(*) from public.event_divisions where event_id = new.event_id) <> entrants
    or (select count(*) from public.event_team_results where event_id = new.event_id) <> entrants
    or (select count(*) from public.event_rider_results where event_id = new.event_id) <> 8 * entrants
    or (select count(*) from public.event_division_runs where event_id = new.event_id) <> divisions then
    raise sqlstate 'PT409' using message = 'The saved division results are incomplete.';
  end if;
  if exists (
    select 1 from public.recovery_division_reveal_entries r
    left join public.event_divisions d on d.event_id = r.event_id and d.team_id = r.team_id
    left join public.event_team_results t on t.event_id = r.event_id and t.team_id = r.team_id
    where r.event_id = new.event_id
      and (d.division_index is distinct from r.division_index
        or t.division_index is distinct from r.division_index
        or d.total_divisions is distinct from divisions
        or t.total_divisions is distinct from divisions
        or t.captain_id is distinct from (
          select (x->'entry'->>'captain_id')::uuid
          from jsonb_array_elements(locked->'teams') x
          where (x->>'id')::uuid = r.team_id))
  ) or exists (
    select 1 from public.event_rider_results rr
    left join public.recovery_division_reveal_entries r
      on r.event_id = rr.event_id and r.team_id = rr.team_id
    where rr.event_id = new.event_id
      and (r.division_index is null or rr.division_index <> r.division_index
        or rr.total_divisions <> divisions)
  ) or exists (
    select 1 from public.event_division_runs run
    where run.event_id = new.event_id and (run.replay is null
      or not exists(select 1 from public.recovery_division_reveal_entries r
        where r.event_id = run.event_id and r.division_index = run.division_index))
  ) then
    raise sqlstate 'PT409' using message = 'The result differs from the saved division reveal.';
  end if;
  return new;
end;
$$;

commit;
