-- Optional, versioned physical race input. Existing entries and race runs are
-- untouched. A changed legacy lineup makes the copied lineup fail validation.
create table public.recovery_physical_entry_inputs (
  event_id uuid not null,
  team_id uuid not null,
  schema_version text not null
    check (schema_version = 'physical-entry-input-v1'),
  selected_riders uuid[] not null
    check (cardinality(selected_riders) = 8),
  captain_id uuid not null
    check (captain_id = any(selected_riders)),
  orders jsonb not null check (jsonb_typeof(orders) = 'object'),
  stake jsonb not null check (jsonb_typeof(stake) = 'object'),
  team_style jsonb not null
    check (jsonb_typeof(team_style) = 'object'),
  rider_numbers jsonb not null
    check (jsonb_typeof(rider_numbers) = 'object'),
  committed_at timestamptz not null default clock_timestamp(),
  primary key (event_id, team_id),
  foreign key (event_id, team_id)
    references public.event_teams(event_id, team_id) on delete cascade
);
alter table public.recovery_physical_entry_inputs
  enable row level security;
revoke all on public.recovery_physical_entry_inputs
  from public, anon, authenticated;
grant all on public.recovery_physical_entry_inputs to service_role;
create sequence public.recovery_physical_bib_numbers;
revoke all on sequence public.recovery_physical_bib_numbers
  from public, anon, authenticated;
grant usage on sequence public.recovery_physical_bib_numbers
  to service_role;

-- The existing entry RPC checks owner, deadline, injury, category, lineup
-- and fee under the cycle lock. Its call and this insert share a transaction.
create function public.recovery_join_event_physical_v1(
  p_user uuid, p_event uuid, p_riders uuid[], p_captain uuid,
  p_orders jsonb, p_stake jsonb, p_team_style jsonb
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare result jsonb; team_uuid uuid; bibs jsonb;
  previous public.recovery_physical_entry_inputs;
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
  result := public.recovery_join_event(
    p_user, p_event, p_riders, p_captain);
  team_uuid := (result->>'team_id')::uuid;
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
revoke all on function public.recovery_join_event_physical_v1(
  uuid, uuid, uuid[], uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.recovery_join_event_physical_v1(
  uuid, uuid, uuid[], uuid, jsonb, jsonb, jsonb)
  to service_role;
