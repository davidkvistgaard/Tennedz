-- Isolated test project only. All fixture changes roll back.
begin;
do $$
declare
  source_event uuid;
  race_event uuid := gen_random_uuid();
  token_one uuid := gen_random_uuid();
  token_two uuid := gen_random_uuid();
  cursor_team uuid;
  claim jsonb;
  race_day timestamptz := (date_trunc('week', now() at time zone 'UTC') + interval '9 days 12 hours') at time zone 'UTC';
begin
  select id into source_event from public.events where kind = 'one_day' limit 1;
  if source_event is null then raise exception 'A seeded one-day race is required'; end if;
  select id into cursor_team from public.teams order by id limit 1;
  if cursor_team is null then raise exception 'A seeded team is required'; end if;
  insert into public.events
    select (jsonb_populate_record(null::public.events, to_jsonb(e) ||
      jsonb_build_object('id', race_event, 'name', 'Autopilot queue test',
        'status', 'OPEN', 'deadline', clock_timestamp() + interval '1 hour',
        'scheduled_at', race_day, 'source_date', (race_day at time zone 'UTC')::date,
        'calendar_source', 'PELOTONIA', 'race_tier', 1, 'race_team_size', 8,
        'calendar_pair_id', null, 'entry_fee', 0))).*
    from public.events e where e.id = source_event;

  claim := public.recovery_autopilot_claim_job(token_one);
  if claim->>'event_id' is distinct from race_event::text then
    raise exception 'Expected test event claim, got %', claim;
  end if;
  if public.recovery_autopilot_claim_job(token_two) is not null then
    raise exception 'A second worker claimed a leased job';
  end if;
  if public.recovery_autopilot_advance_job(race_event, token_two, null, 0, 0, true) then
    raise exception 'A worker without the lease advanced the job';
  end if;
  update public.recovery_autopilot_jobs set lease_until = now() - interval '1 second'
    where event_id = race_event;
  claim := public.recovery_autopilot_claim_job(token_two);
  if claim->>'event_id' is distinct from race_event::text then
    raise exception 'Expired lease was not retried: %', claim;
  end if;
  if public.recovery_autopilot_advance_job(race_event, token_one, null, 0, 0, true) then
    raise exception 'Expired worker advanced a reclaimed job';
  end if;
  if not public.recovery_autopilot_advance_job(race_event, token_two, cursor_team, 5, 0, true) then
    raise exception 'Lease holder could not complete the job';
  end if;
  if (select status from public.recovery_autopilot_jobs where event_id = race_event)
    is distinct from 'COMPLETE' or (select processed_count from public.recovery_autopilot_jobs
    where event_id = race_event) <> 5 then
    raise exception 'Queue completion was not saved';
  end if;
  update public.recovery_autopilot_jobs
    set updated_at = now() - interval '7 hours' where event_id = race_event;
  claim := public.recovery_autopilot_claim_job(token_one);
  if claim->>'event_id' is distinct from race_event::text
    or claim->>'cursor_team_id' is not null then
    raise exception 'Completed job was not revisited: %', claim;
  end if;
  if (select processed_count from public.recovery_autopilot_jobs
    where event_id = race_event) <> 0 then
    raise exception 'A new scan retained the previous pass count';
  end if;
  if not public.recovery_autopilot_advance_job(race_event, token_one, null, 0, 0, true) then
    raise exception 'Revisited job could not complete';
  end if;
end $$;
rollback;
select 'PASS: lease, expired retry, stale token, completion and rescan; fixtures rolled back' result;
