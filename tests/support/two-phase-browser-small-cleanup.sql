-- Isolated project nxhvaoonnvmvohqaxfdx only. Replace __EVENT_ID__ with
-- the ID printed by two-phase-browser-small.mjs and run through management SQL.
-- The service-role API cannot DELETE the private reveal/tactics tables.
begin;
do $cleanup$
declare
  v_event uuid := '__EVENT_ID__'::uuid;
  v_name text;
  v_teams uuid[];
  v_riders uuid[];
begin
  select name into v_name from public.events where id = v_event for update;
  if v_name is distinct from 'Disposable two-phase browser probe' then
    raise exception 'Refusing cleanup of another event or a missing fixture.';
  end if;
  select array_agg(id) into v_riders from public.riders
    where name like 'Two-phase probe ' || left(v_event::text, 8) || ' %';
  select array_agg(distinct tr.team_id) into v_teams
    from public.team_riders tr join public.teams t on t.id = tr.team_id
    where tr.rider_id = any(v_riders) and t.name like 'P02 isolated cron %';
  if coalesce(array_length(v_teams, 1), 0) <> 2
    or coalesce(array_length(v_riders, 1), 0) <> 16
    or (select count(*) from public.team_riders
      where rider_id = any(v_riders) and team_id = any(v_teams)) <> 16
    or (select count(*) from public.event_teams
      where event_id = v_event and team_id <> all(v_teams)) <> 0 then
    raise exception 'Unexpected browser fixture ownership; refusing cleanup.';
  end if;

  delete from public.recovery_ranking_awards where event_id = v_event;
  delete from public.event_rider_results where event_id = v_event;
  delete from public.event_team_results where event_id = v_event;
  delete from public.event_divisions where event_id = v_event;
  delete from public.event_division_runs where event_id = v_event;
  delete from public.recovery_race_commits where event_id = v_event;
  delete from public.recovery_tactics_commits where event_id = v_event;
  delete from public.recovery_division_reveal_entries where event_id = v_event;
  delete from public.recovery_division_reveals where event_id = v_event;
  delete from public.recovery_autopilot_entries where event_id = v_event;
  delete from public.recovery_autopilot_jobs where event_id = v_event;
  delete from public.recovery_entry_receipts where event_id = v_event;
  delete from public.event_teams where event_id = v_event;
  delete from public.events where id = v_event;
  delete from public.team_riders where rider_id = any(v_riders);
  delete from public.riders where id = any(v_riders);
end;
$cleanup$;
commit;
