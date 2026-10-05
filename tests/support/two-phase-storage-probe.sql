-- Run only against the allowlisted isolated Supabase project after the
-- opt_in_two_phase_race_storage migration. All DML rolls back in subtransactions.
do $probe$
declare
  v_event uuid;
  v_deadline timestamptz := clock_timestamp() + interval '1 day';
  v_constraint text;
  v_message text;
begin
  if to_regclass('public.recovery_division_reveals') is null
    or to_regclass('public.recovery_division_reveal_entries') is null then
    raise exception 'The private reveal tables are missing.';
  end if;
  if has_table_privilege('anon', 'public.recovery_division_reveals', 'SELECT')
    or has_table_privilege('authenticated', 'public.recovery_division_reveal_entries', 'SELECT')
    or has_function_privilege('anon', 'public.recovery_guard_unfinished_two_phase_commit()', 'EXECUTE')
    or not has_table_privilege('service_role', 'public.recovery_division_reveals', 'INSERT') then
    raise exception 'Reveal access grants are incorrect.';
  end if;

  select id into v_event from public.events
    where kind = 'one_day' and registration_deadline is null
    order by id limit 1;
  if v_event is null then raise exception 'No isolated legacy race is available.'; end if;

  begin
    update public.events set deadline = v_deadline,
      registration_deadline = v_deadline,
      tactics_deadline = v_deadline - interval '1 hour',
      scheduled_at = v_deadline + interval '2 days',
      calendar_source = 'PELOTONIA'
      where id = v_event;
    raise exception 'Invalid phase order was accepted.';
  exception when check_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint <> 'events_two_phase_deadlines_check' then raise; end if;
  end;

  begin
    update public.events set deadline = v_deadline,
      registration_deadline = v_deadline,
      tactics_deadline = v_deadline + interval '1 day',
      scheduled_at = v_deadline + interval '2 days',
      calendar_source = 'PELOTONIA'
      where id = v_event;
    insert into public.recovery_race_commits(event_id, input_snapshot, summary)
      values (v_event, '{}'::jsonb, '{}'::jsonb);
    raise exception 'An unfinished two-phase race was committed.';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'Two-phase race input is not yet available.' then raise; end if;
  end;

  if exists (select 1 from public.events
    where id = v_event and registration_deadline is not null) then
    raise exception 'The rollback-only probe changed the legacy race.';
  end if;

  select e.id into v_event from public.events e
    where e.kind = 'one_day' and e.registration_deadline is null
      and not exists (select 1 from public.recovery_race_commits c where c.event_id = e.id)
    order by e.id limit 1;
  if v_event is null then raise exception 'No uncommitted legacy race is available.'; end if;
  begin
    insert into public.recovery_race_commits(event_id, input_snapshot, summary)
      values (v_event, '{}'::jsonb, '{}'::jsonb);
    raise sqlstate 'PZ001' using message = 'Rollback successful legacy insert.';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists (select 1 from public.recovery_race_commits where event_id = v_event) then
    raise exception 'The rollback-only probe left a race commit.';
  end if;
end;
$probe$;
