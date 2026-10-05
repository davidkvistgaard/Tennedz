-- Replace __EVENT_ID__ with only the ID returned by real-output-setup.sql.
-- Isolated project only. Refuse to delete any other event.
begin;
do $cleanup$
declare
  v_event uuid := '__EVENT_ID__'::uuid;
  v_name text;
  v_teams uuid[];
  v_riders uuid[];
begin
  select name into v_name from public.events where id = v_event for update;
  if v_name is distinct from 'Disposable two-phase real-output probe' then
    raise exception 'Refusing cleanup of another event or a missing fixture.';
  end if;
  select array_agg(team_id) into v_teams from public.event_teams
    where event_id = v_event;
  select array_agg(rider_id) into v_riders from public.team_riders
    where team_id = any(v_teams);
  if coalesce(array_length(v_teams, 1), 0) <> 2
    or coalesce(array_length(v_riders, 1), 0) <> 16 then
    raise exception 'Unexpected fixture ownership; refusing cleanup.';
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
  delete from public.team_riders where team_id = any(v_teams);
  delete from public.riders where id = any(v_riders);
  delete from public.teams where id = any(v_teams);
end;
$cleanup$;
commit;
