-- Supabase Auth Admin's user endpoint fails on the test agents' nullable
-- token fields. Read only the protected app metadata inside Postgres instead.
-- This function exposes a boolean solely to the service role and only for
-- the exact Sunday pilot; it never changes Auth account data.
create function public.recovery_is_winter_agent_v1(
  p_user uuid,p_event uuid
) returns boolean language sql stable security definer
set search_path = '' as $$
  select p_event =
      '109a9235-44e6-d390-1fa9-aec19b65cf3b'::uuid
    and exists(select 1 from auth.users u
      where u.id=p_user
        and u.raw_app_meta_data->>'pelotonia_agent'='winter-2026');
$$;
revoke all on function public.recovery_is_winter_agent_v1(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.recovery_is_winter_agent_v1(uuid,uuid)
  to service_role;

create or replace function public.recovery_join_winter_agent_event_physical_v1(
  p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,
  p_orders jsonb,p_stake jsonb,p_team_style jsonb,
  p_policy_version text,p_reason text
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare result jsonb; team_uuid uuid;
begin
  if p_event is distinct from
      '109a9235-44e6-d390-1fa9-aec19b65cf3b'::uuid
    or p_policy_version is distinct from 'winter-agent-tactics-v1'
    or p_reason not in ('flat_route_sprint_captain',
      'flat_route_climb_captain_conserve') then
    raise exception using errcode='PT403',
      message='This agent policy is limited to the Sunday pilot.';
  end if;
  perform pg_advisory_xact_lock(73192026);
  if not public.recovery_is_winter_agent_v1(p_user,p_event) then
    raise exception using errcode='PT403',
      message='This team has no winter agent authorization.';
  end if;
  select id into team_uuid from public.teams where user_id=p_user;
  if team_uuid is null then
    raise exception using errcode='PT403',
      message='The agent has no team.';
  end if;
  if exists(select 1 from public.recovery_physical_entry_inputs
    where event_id=p_event and team_id=team_uuid) then
    raise exception using errcode='PT409',
      message='Tactics have already been committed.';
  end if;
  result := public.recovery_join_agent_event_physical_v1(
    p_user,p_event,p_riders,p_captain,p_orders,p_stake,p_team_style);
  insert into public.recovery_winter_agent_tactic_decisions(
    event_id,team_id,policy_version,reason,orders,stake)
  values(p_event,team_uuid,p_policy_version,p_reason,p_orders,p_stake);
  return result || jsonb_build_object(
    'agent_policy_version',p_policy_version,
    'agent_policy_reason',p_reason);
end $$;
