-- Physical entry calls the existing join RPC for ownership, eligibility,
-- deadline and fee checks. That RPC clears legacy orders on every upsert.
-- Preserve a prior order only when the lineup and captain are unchanged, so
-- an old-engine rollback still has the manager's original tactical input.
create or replace function public.recovery_join_event_physical_v1(
  p_user uuid, p_event uuid, p_riders uuid[], p_captain uuid,
  p_orders jsonb, p_stake jsonb, p_team_style jsonb
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare result jsonb; team_uuid uuid; bibs jsonb;
  previous public.recovery_physical_entry_inputs;
  legacy public.event_teams; had_legacy boolean;
begin
  if jsonb_typeof(p_orders) is distinct from 'object'
    or jsonb_typeof(p_stake) is distinct from 'object'
    or jsonb_typeof(p_team_style) is distinct from 'object'
    or p_orders->>'captainId' is distinct from p_captain::text
    or jsonb_typeof(p_orders->'baseline') is distinct from 'object'
    or not ((p_orders->'baseline') ?&
      array['effort','attack','chase','frontWork'])
    or jsonb_typeof(p_orders->'helperIds') is distinct from 'array'
    or p_orders->>'roadCaptainId' is null
    or coalesce(p_stake->>'sportingGoal','') not in
      ('sprint_finish', 'summit_attack', 'break_stage', 'none')
    or p_stake->>'sportingCaptainId' is null
    or not exists(select 1 from unnest(p_riders) rider_id
      where rider_id::text = p_stake->>'sportingCaptainId') then
    raise exception using errcode='PT400',
      message='The physical race entry needs complete committed inputs.';
  end if;
  perform pg_advisory_xact_lock(73192026);
  select id into team_uuid from public.teams where user_id=p_user;
  select * into legacy from public.event_teams
    where event_id=p_event and team_id=team_uuid;
  had_legacy := found;
  result := public.recovery_join_event(
    p_user, p_event, p_riders, p_captain);
  team_uuid := (result->>'team_id')::uuid;
  if had_legacy and legacy.team_id=team_uuid
    and legacy.selected_riders=p_riders
    and legacy.captain_id=p_captain
    and legacy.orders is not null then
    update public.event_teams set orders=legacy.orders
      where event_id=p_event and team_id=team_uuid;
  end if;
  if p_team_style->>'id' is distinct from team_uuid::text then
    raise exception using errcode='PT400',
      message='The committed team style must match the entry.';
  end if;
  select * into previous from public.recovery_physical_entry_inputs
    where event_id=p_event and team_id=team_uuid;
  if found and previous.selected_riders=p_riders
    and previous.captain_id=p_captain then
    bibs := previous.rider_numbers;
  else
    select jsonb_object_agg(rider_id::text,
      nextval('public.recovery_physical_bib_numbers'::regclass))
      into bibs from unnest(p_riders) rider_id;
  end if;
  insert into public.recovery_physical_entry_inputs(
    event_id, team_id, schema_version, selected_riders, captain_id,
    orders, stake, team_style, rider_numbers)
  values(p_event, team_uuid, 'physical-entry-input-v1',
    p_riders, p_captain, p_orders, p_stake,
    p_team_style, bibs)
  on conflict(event_id, team_id) do update set
    selected_riders=excluded.selected_riders,
    captain_id=excluded.captain_id,
    orders=excluded.orders, stake=excluded.stake,
    team_style=excluded.team_style,
    rider_numbers=excluded.rider_numbers,
    committed_at=clock_timestamp();
  return result || jsonb_build_object(
    'physical_input_version', 'physical-entry-input-v1',
    'rider_numbers', bibs);
end $$;
