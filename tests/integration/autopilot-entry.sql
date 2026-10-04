-- Isolated test project only. All fixture changes roll back.
begin;
set local time zone 'Pacific/Auckland';
do $$
declare
  source_event uuid;
  first_event uuid := gen_random_uuid();
  second_event uuid := gen_random_uuid();
  entrant public.event_teams;
  owner_id uuid;
  planned jsonb;
  saved jsonb;
  outcome jsonb;
  race_day timestamptz := (date_trunc('week', now() at time zone 'UTC') + interval '9 days 12 hours') at time zone 'UTC';
begin
  select e.id into source_event from public.events e
    join public.event_teams et on et.event_id = e.id
    where e.kind = 'one_day' and cardinality(et.selected_riders) = 8
    limit 1;
  if source_event is null then raise exception 'A seeded eight-rider race is required'; end if;
  select * into entrant from public.event_teams where event_id = source_event limit 1;
  select user_id into owner_id from public.teams where id = entrant.team_id;
  update public.riders set injury_until = null where id = any(entrant.selected_riders);
  select jsonb_build_object('version', 1, 'plan', 'captain', 'riders',
    jsonb_object_agg(id::text, jsonb_build_object(
      'role', case when id = entrant.captain_id then 'captain' else 'helper' end,
      'effort', 'balanced'))) into planned
    from unnest(entrant.selected_riders) id;

  insert into public.events
    select (jsonb_populate_record(null::public.events, to_jsonb(e) ||
      jsonb_build_object('id', first_event, 'name', 'Autopilot manual priority test',
        'status', 'OPEN', 'deadline', clock_timestamp() + interval '4 days',
        'scheduled_at', race_day, 'source_date', (race_day at time zone 'UTC')::date,
        'calendar_source', 'PELOTONIA', 'race_tier', 1, 'race_team_size', 8,
        'calendar_pair_id', null, 'entry_fee', 0))).*
    from public.events e where e.id = source_event;
  insert into public.events
    select (jsonb_populate_record(null::public.events, to_jsonb(e) ||
      jsonb_build_object('id', second_event, 'name', 'Autopilot same-day priority test',
        'status', 'OPEN', 'deadline', clock_timestamp() + interval '4 days',
        'scheduled_at', race_day + interval '1 hour',
        'source_date', (race_day at time zone 'UTC')::date,
        'calendar_source', 'PELOTONIA', 'race_tier', 1, 'race_team_size', 8,
        'calendar_pair_id', null, 'entry_fee', 0))).*
    from public.events e where e.id = source_event;

  perform public.recovery_join_event_with_orders(
    owner_id, first_event, entrant.selected_riders, entrant.captain_id, planned);
  select orders into saved from public.event_teams
    where event_id = first_event and team_id = entrant.team_id;
  outcome := public.recovery_autopilot_join_event(
    owner_id, first_event, entrant.selected_riders, entrant.captain_id, planned);
  if outcome->>'reason' is distinct from 'ENTRY_ALREADY_EXISTS'
    or (outcome->>'entered')::boolean is distinct from false then
    raise exception 'Autopilot did not preserve the manual entry: %', outcome;
  end if;
  if (select orders from public.event_teams where event_id = first_event
      and team_id = entrant.team_id) is distinct from saved then
    raise exception 'Autopilot changed saved manual orders';
  end if;

  outcome := public.recovery_autopilot_join_event(
    owner_id, second_event, entrant.selected_riders, entrant.captain_id, planned);
  if outcome->>'reason' is distinct from 'SIMULTANEOUS_EVENT_PRIORITY_UNRESOLVED'
    or (outcome->>'entered')::boolean is distinct from false then
    raise exception 'Autopilot ignored a same-day conflict: %', outcome;
  end if;
  if exists (select 1 from public.event_teams where event_id = second_event
      and team_id = entrant.team_id) then
    raise exception 'Autopilot created a conflicting entry';
  end if;
end $$;
rollback;
select 'PASS: manual orders and same-day priority retained; fixtures rolled back' result;
