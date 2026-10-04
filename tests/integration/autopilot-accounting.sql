-- Isolated test project only. An interrupted page must retain exact entry count.
begin;
do $$
declare
  source_event uuid;
  race_event uuid := gen_random_uuid();
  entrant public.event_teams;
  owner_id uuid;
  planned jsonb;
  token_one uuid := gen_random_uuid();
  token_two uuid := gen_random_uuid();
  token_three uuid := gen_random_uuid();
  outcome jsonb;
  race_day timestamptz := (date_trunc('week', now() at time zone 'UTC') + interval '9 days 12 hours') at time zone 'UTC';
begin
  select e.id into source_event from public.events e
    join public.event_teams et on et.event_id=e.id
    where e.kind='one_day' and cardinality(et.selected_riders)=8 limit 1;
  if source_event is null then raise exception 'A seeded eight-rider race is required'; end if;
  select * into entrant from public.event_teams where event_id=source_event limit 1;
  select user_id into owner_id from public.teams where id=entrant.team_id;
  update public.riders set injury_until=null where id=any(entrant.selected_riders);
  select jsonb_build_object('version',1,'plan','balanced','riders',
    jsonb_object_agg(id::text,jsonb_build_object('role',
      case when id=entrant.captain_id then 'captain' else 'free' end,
      'effort','balanced'))) into planned from unnest(entrant.selected_riders) id;
  insert into public.events
    select (jsonb_populate_record(null::public.events,to_jsonb(e)||
      jsonb_build_object('id',race_event,'name','Autopilot accounting test',
        'status','OPEN','deadline',clock_timestamp()+interval '1 hour',
        'scheduled_at',race_day,'source_date',(race_day at time zone 'UTC')::date,
        'calendar_source','PELOTONIA','race_tier',1,'race_team_size',8,
        'calendar_pair_id',null,'entry_fee',0))).*
    from public.events e where e.id=source_event;
  outcome:=public.recovery_autopilot_claim_job(token_one);
  if outcome->>'event_id' is distinct from race_event::text then
    raise exception 'Expected test job claim: %',outcome;
  end if;
  outcome:=public.recovery_autopilot_join_event(owner_id,race_event,
    entrant.selected_riders,entrant.captain_id,planned);
  if (outcome->>'entered')::boolean is distinct from true then
    raise exception 'First automatic entry failed: %',outcome;
  end if;
  if (select count(*) from public.recovery_autopilot_entries
      where event_id=race_event and team_id=entrant.team_id)<>1 then
    raise exception 'Automatic entry receipt missing';
  end if;
  -- Simulate a failed page after the successful join but before page advance.
  update public.recovery_autopilot_jobs set lease_until=now()-interval '1 second'
    where event_id=race_event;
  outcome:=public.recovery_autopilot_claim_job(token_two);
  if outcome->>'event_id' is distinct from race_event::text then
    raise exception 'Failed page was not reclaimed: %',outcome;
  end if;
  outcome:=public.recovery_autopilot_join_event(owner_id,race_event,
    entrant.selected_riders,entrant.captain_id,planned);
  if outcome->>'reason' is distinct from 'ENTRY_ALREADY_EXISTS' then
    raise exception 'Retry duplicated or lost the existing entry: %',outcome;
  end if;
  if not public.recovery_autopilot_advance_job(race_event,token_two,
      entrant.team_id,1,0,true) then
    raise exception 'Reclaimed page did not advance';
  end if;
  if (select entered_count from public.recovery_autopilot_jobs where event_id=race_event)<>1 then
    raise exception 'The completed-page counter lost a successful prior join';
  end if;
  update public.recovery_autopilot_jobs set updated_at=now()-interval '7 hours'
    where event_id=race_event;
  outcome:=public.recovery_autopilot_claim_job(token_three);
  if outcome->>'event_id' is distinct from race_event::text
    or not public.recovery_autopilot_advance_job(race_event,token_three,null,0,0,true) then
    raise exception 'Rescan did not complete';
  end if;
  if (select entered_count from public.recovery_autopilot_jobs where event_id=race_event)<>1 then
    raise exception 'Rescan counted an existing automatic entry twice';
  end if;
end $$;
rollback;
select 'PASS: interrupted page and rescan count one automatic entry exactly once' result;
