-- Isolated test project only. Measures database queue overhead, not HTTP batch capacity.
begin;
do $$
declare
  source_event uuid;
  token uuid;
  job jsonb;
  processed integer := 0;
  began_at timestamptz := clock_timestamp();
  elapsed_ms numeric;
  race_day timestamptz := (date_trunc('week', now() at time zone 'UTC') + interval '9 days 12 hours') at time zone 'UTC';
begin
  select id into source_event from public.events where kind = 'one_day' limit 1;
  if source_event is null then raise exception 'A seeded one-day race is required'; end if;
  insert into public.events
    select (jsonb_populate_record(null::public.events, to_jsonb(e) ||
      jsonb_build_object('id', gen_random_uuid(), 'name', 'Autopilot queue load ' || n,
        'status', 'OPEN', 'deadline', clock_timestamp() + interval '1 hour',
        'scheduled_at', race_day, 'source_date', (race_day at time zone 'UTC')::date,
        'calendar_source', 'PELOTONIA', 'race_tier', 1, 'race_team_size', 8,
        'calendar_pair_id', null, 'entry_fee', 0))).*
    from public.events e cross join generate_series(1, 50) n where e.id = source_event;
  loop
    token := gen_random_uuid();
    job := public.recovery_autopilot_claim_job(token);
    exit when job is null;
    if not public.recovery_autopilot_advance_job((job->>'event_id')::uuid,
        token, null, 0, 0, true) then
      raise exception 'Queue claim could not be completed: %', job;
    end if;
    processed := processed + 1;
    if processed > 50 then raise exception 'Queue repeated an already complete job'; end if;
  end loop;
  if processed <> 50 then raise exception 'Expected 50 queue jobs, got %', processed; end if;
  elapsed_ms := extract(epoch from clock_timestamp() - began_at) * 1000;
  raise notice 'Queue database pass: 50 event claims and completions in % ms', round(elapsed_ms);
end $$;
rollback;
select 'PASS: 50 queue jobs completed once; fixtures rolled back' result;
