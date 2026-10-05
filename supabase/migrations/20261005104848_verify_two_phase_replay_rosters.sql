-- A finished two-phase race must not attach a replay from another division or
-- omit a rider who appears in its saved result. Legacy commits are unchanged.
begin;

create function public.recovery_verify_two_phase_replay_rosters()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_two_phase boolean;
  v_run public.event_division_runs;
  v_expected integer;
  v_unique integer;
begin
  select e.registration_deadline is not null into v_two_phase
    from public.events e where e.id = new.event_id;
  if not coalesce(v_two_phase, false) then return new; end if;

  for v_run in select * from public.event_division_runs r
    where r.event_id = new.event_id loop
    select count(*) into v_expected from public.event_rider_results r
      where r.event_id = new.event_id
        and r.division_index = v_run.division_index;
    if v_run.replay is null
      or jsonb_typeof(v_run.replay->'roster') is distinct from 'array'
      or jsonb_array_length(v_run.replay->'roster') <> v_expected then
      raise sqlstate 'PT409' using message = 'The recorded replay roster does not match its division results.';
    end if;
    select count(distinct rider->>'id') into v_unique
      from jsonb_array_elements(v_run.replay->'roster') rider;
    if v_unique <> v_expected or exists (
      select 1 from jsonb_array_elements(v_run.replay->'roster') rider
      left join public.event_rider_results result
        on result.event_id = new.event_id
        and result.division_index = v_run.division_index
        and result.rider_id::text = rider->>'id'
        and result.team_id::text = rider->>'team_id'
      where result.rider_id is null
    ) then
      raise sqlstate 'PT409' using message = 'The recorded replay roster does not match its division results.';
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.recovery_verify_two_phase_replay_rosters()
  from public, anon, authenticated;
grant execute on function public.recovery_verify_two_phase_replay_rosters()
  to service_role;
create trigger recovery_verify_two_phase_replay_rosters
  before insert on public.recovery_race_commits
  for each row execute function public.recovery_verify_two_phase_replay_rosters();

commit;
