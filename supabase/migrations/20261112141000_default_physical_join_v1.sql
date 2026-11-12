-- A manager can explicitly enter with a default before the deadline.
-- The existing join RPC still handles owner, fee, roster and deadline.
create function public.recovery_join_default_event_physical_v1(
  p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,
  p_orders jsonb,p_stake jsonb,p_team_style jsonb,
  p_lineup_source text,p_tactics_source text
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare team_uuid uuid; previous public.event_teams; result jsonb;
begin
  if p_lineup_source not in
      ('entered','manager_default','game_ai')
    or p_tactics_source not in
      ('manager_default','game_ai') then
    raise exception using errcode='PT400',
      message='Unknown default race plan source.';
  end if;
  perform pg_advisory_xact_lock(73192026);
  select id into team_uuid from public.teams where user_id=p_user;
  if team_uuid is null then
    raise exception using errcode='PT403',
      message='The manager has no team.';
  end if;
  if exists(select 1 from public.recovery_physical_entry_inputs
    where event_id=p_event and team_id=team_uuid) then
    raise exception using errcode='PT409',
      message='This team already saved race tactics.';
  end if;
  select * into previous from public.event_teams
    where event_id=p_event and team_id=team_uuid;
  if found and cardinality(previous.selected_riders)=8
    and previous.captain_id is not null and
    (previous.selected_riders is distinct from p_riders or
      previous.captain_id is distinct from p_captain or
      p_lineup_source is distinct from 'entered') then
    raise exception using errcode='PT409',
      message='The manager lineup changed before default commitment.';
  end if;
  result := public.recovery_join_event_physical_v1(
    p_user,p_event,p_riders,p_captain,p_orders,p_stake,p_team_style);
  insert into public.recovery_default_physical_entry_audit_v1(
    event_id,team_id,policy_version,lineup_source,tactics_source)
  values(p_event,team_uuid,'default-physical-entry-v1',
    p_lineup_source,p_tactics_source);
  return result || jsonb_build_object(
    'default_policy_version','default-physical-entry-v1',
    'lineup_source',p_lineup_source,
    'tactics_source',p_tactics_source);
end $$;
revoke all on function
  public.recovery_join_default_event_physical_v1(
    uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb,text,text)
  from public,anon,authenticated;
grant execute on function
  public.recovery_join_default_event_physical_v1(
    uuid,uuid,uuid[],uuid,jsonb,jsonb,jsonb,text,text)
  to service_role;
