-- Run only against the isolated test project after persist_two_phase_tactics_lock.
-- The deliberate PZ001 error rolls back all fixture writes.
do $probe$
declare
  v_event uuid;
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
  v_first jsonb;
  v_again jsonb;
  v_message text;
begin
  if has_function_privilege('anon',
      'public.recovery_commit_tactics_lock(uuid)', 'EXECUTE')
    or has_table_privilege('authenticated',
      'public.recovery_tactics_commits', 'SELECT') then
    raise exception 'Private tactics lock is exposed.';
  end if;
  select e.id into v_event from public.events e
    where e.kind = 'one_day' and e.status = 'OPEN'
      and e.registration_deadline is null
      and not exists(select 1 from public.recovery_race_commits c
        where c.event_id = e.id)
      and (select count(*) from public.event_teams et
        where et.event_id = e.id) = 2
    order by e.id limit 1;
  if v_event is null then raise exception 'No isolated two-team event.'; end if;

  begin
    perform public.recovery_commit_tactics_lock(v_event);
    raise exception 'Legacy race was locked as two-phase.';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'This race does not use a tactics lock.' then raise; end if;
  end;

  begin
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA'
      where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    begin
      perform public.recovery_commit_tactics_lock(v_event);
      raise exception 'Tactics locked before the deadline.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The tactics lock is outside its phase.' then raise; end if;
    end;
    perform public.recovery_commit_division_reveal(v_event);
    update public.event_teams et set orders = jsonb_build_object(
      'version', 1, 'plan', 'balanced', 'riders',
      (select jsonb_object_agg(rider_id::text,
        jsonb_build_object('role', case when rider_id = et.captain_id
          then 'captain' else 'free' end, 'effort', 'balanced'))
        from unnest(et.selected_riders) rider_id))
      where et.event_id = v_event;
    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;

    v_first := public.recovery_commit_tactics_lock(v_event);
    if v_first->>'alreadyLocked' <> 'false'
      or jsonb_array_length(v_first->'inputSnapshot'->'teams') <> 2
      or jsonb_array_length(
        v_first->'inputSnapshot'->'locked_division_reveal'->'assignments') <> 2
      or exists(select 1 from jsonb_array_elements(
        v_first->'inputSnapshot'->'teams') t where t->'entry'->'orders' is null) then
      raise exception 'The final input or saved reveal is incomplete.';
    end if;
    update public.event_teams set orders = null where event_id = v_event;
    v_again := public.recovery_commit_tactics_lock(v_event);
    if v_again is distinct from
      jsonb_set(v_first, '{alreadyLocked}', 'true'::jsonb) then
      raise exception 'Retry changed the locked race input.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback tactics lock probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.recovery_tactics_commits c
      where c.event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals r
      where r.event_id = v_event)
    or exists(select 1 from public.events e
      where e.id = v_event and e.registration_deadline is not null)
    or exists(select 1 from public.recovery_autopilot_jobs j
      where j.event_id = v_event) then
    raise exception 'Tactics lock probe left persistent changes.';
  end if;
end;
$probe$;
