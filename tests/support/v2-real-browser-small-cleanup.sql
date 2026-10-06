-- Isolated project nxhvaoonnvmvohqaxfdx only. Replace __EVENT_ID__ with
-- the ID printed by v2-real-browser-small.mjs and run through management SQL.
begin;
do $cleanup$
declare
  v_event uuid := '__EVENT_ID__'::uuid;
  v_name text;
  v_teams uuid[];
  v_riders uuid[];
  v_team_count integer;
begin
  select name into v_name from public.events where id = v_event for update;
  if v_name not in ('Disposable v2 browser probe',
    'Disposable v2 browser probe ' || left(v_event::text, 8)) then
    raise exception 'Refusing cleanup of another event or a missing fixture.';
  end if;
  select array_agg(id) into v_riders from public.riders
    where name like 'V2 browser probe ' || left(v_event::text, 8) || ' %';
  select array_agg(distinct tr.team_id) into v_teams
    from public.team_riders tr join public.teams t on t.id = tr.team_id
    where tr.rider_id = any(v_riders) and t.name like 'P02 isolated cron %';
  v_team_count := coalesce(array_length(v_teams, 1), 0);
  if v_team_count not in (2, 22, 45)
    or coalesce(array_length(v_riders, 1), 0) <> 8*v_team_count
    or (select count(*) from public.team_riders
      where rider_id = any(v_riders) and team_id = any(v_teams)) <> 8*v_team_count
    or (select count(*) from public.event_teams
      where event_id = v_event and team_id <> all(v_teams)) <> 0 then
    raise exception 'Unexpected v2 fixture ownership; refusing cleanup.';
  end if;

  delete from public.recovery_v2_settlements where event_id = v_event;
  delete from public.recovery_v2_recorded_divisions where event_id = v_event;
  delete from public.recovery_v2_recorded_candidates where event_id = v_event;
  delete from public.recovery_v2_tactics_commits where event_id = v_event;
  delete from public.recovery_v2_tactics_drafts where event_id = v_event;
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
