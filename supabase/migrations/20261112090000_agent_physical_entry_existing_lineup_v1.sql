-- Agent submissions can update tactics, never the already entered lineup.
-- The server verifies the agent's Auth app metadata and event-scoped token.
-- This wrapper closes the check/write race under the same cycle lock as join.
create function public.recovery_join_agent_event_physical_v1(
  p_user uuid, p_event uuid, p_riders uuid[], p_captain uuid,
  p_orders jsonb, p_stake jsonb, p_team_style jsonb
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare team_uuid uuid; entry public.event_teams;
begin
  perform pg_advisory_xact_lock(73192026);
  select id into team_uuid from public.teams where user_id=p_user;
  if team_uuid is null then
    raise exception using errcode='PT403',
      message='This agent has no team.';
  end if;
  select * into entry from public.event_teams
    where event_id=p_event and team_id=team_uuid for update;
  if not found or entry.selected_riders is distinct from p_riders
    or entry.captain_id is distinct from p_captain then
    raise exception using errcode='PT403',
      message='Agent tactics must preserve the entered lineup.';
  end if;
  return public.recovery_join_event_physical_v1(
    p_user,p_event,p_riders,p_captain,p_orders,p_stake,p_team_style);
end $$;
revoke all on function public.recovery_join_agent_event_physical_v1(
  uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.recovery_join_agent_event_physical_v1(
  uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb)
  to service_role;
