-- Run only on the isolated test project after persist_point_division_reveal.
-- The deliberate PZ001 error rolls back every test write in its subtransaction.
do $probe$
declare
  v_event uuid;
  v_team uuid;
  v_rider uuid;
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
  v_first jsonb;
  v_again jsonb;
  v_message text;
  v_bad_groups integer;
  v_unbalanced integer;
  v_forty_five jsonb;
begin
  if has_function_privilege('anon',
      'public.recovery_commit_division_reveal(uuid)', 'EXECUTE')
    or has_table_privilege('authenticated',
      'public.recovery_division_reveal_entries', 'SELECT')
    or has_table_privilege('service_role',
      'public.recovery_division_reveals', 'DELETE') then
    raise exception 'Reveal grants are too broad.';
  end if;

  select e.id into v_event from public.events e
    where e.kind = 'one_day' and e.status = 'OPEN'
      and e.registration_deadline is null
      and not exists(select 1 from public.recovery_race_commits c
        where c.event_id = e.id)
      and (select count(*) from public.event_teams et
        where et.event_id = e.id) = 2
    order by e.id limit 1;
  if v_event is null then raise exception 'No suitable isolated test event.'; end if;

  begin
    perform public.recovery_commit_division_reveal(v_event);
    raise exception 'Legacy event was unexpectedly revealed.';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'This race does not use a division reveal.' then raise; end if;
  end;

  begin
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA'
      where id = v_event;
    begin
      perform public.recovery_commit_division_reveal(v_event);
      raise exception 'Reveal passed without a completed autopilot scan.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'The autopilot entry scan is incomplete.' then raise; end if;
    end;

    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    select et.team_id, et.selected_riders[1] into v_team, v_rider
      from public.event_teams et where et.event_id = v_event
      order by et.team_id limit 1;
    insert into public.recovery_ranking_awards
      (award_key, rider_id, team_id, event_id, season_year, gender,
       calendar_source, event_format, race_tier, result_type, result_place,
       points, points_policy_version, awarded_at)
    values
      ('reveal-probe-before-' || v_event, v_rider, v_team, v_event,
       extract(year from clock_timestamp() at time zone 'UTC')::integer,
       'M', 'PELOTONIA', 'ONE_DAY', 1, 'ONE_DAY', 1, 41, 'probe',
       v_registration - interval '1 minute'),
      ('reveal-probe-after-' || v_event, v_rider, v_team, v_event,
       extract(year from clock_timestamp() at time zone 'UTC')::integer,
       'M', 'PELOTONIA', 'ONE_DAY', 1, 'ONE_DAY', 2, 91, 'probe',
       v_registration + interval '1 minute');

    v_first := public.recovery_commit_division_reveal(v_event);
    if v_first->>'alreadyRevealed' <> 'false'
      or jsonb_array_length(v_first->'assignments') <> 2
      or v_first->'assignments'->0->>'teamId' <> v_team::text
      or v_first->'assignments'->0->>'earnedPointsAtLock' <> '41'
      or v_first->'assignments'->1->>'earnedPointsAtLock' <> '0'
      or v_first->'assignments'->0->>'divisionIndex' <> '1'
      or v_first->'assignments'->1->>'divisionIndex' <> '1' then
      raise exception 'Locked points or division assignment was incorrect: %', v_first;
    end if;
    v_again := public.recovery_commit_division_reveal(v_event);
    if v_again is distinct from
      jsonb_set(v_first, '{alreadyRevealed}', 'true'::jsonb) then
      raise exception 'Repeated reveal did not return the stored assignment.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback reveal probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.recovery_division_reveals r
      where r.event_id = v_event)
    or exists(select 1 from public.recovery_autopilot_jobs j
      where j.event_id = v_event)
    or exists(select 1 from public.events e
      where e.id = v_event and e.registration_deadline is not null) then
    raise exception 'Reveal probe left persistent changes.';
  end if;

  -- Exercise the same integer division formula for every supported pool size.
  with cases as (
    select n, (n + 19) / 20 divisions,
      n / ((n + 19) / 20) base_size,
      n % ((n + 19) / 20) extra
    from generate_series(2, 400) n
  ), assignment as (
    select c.n, c.divisions,
      case when rank <= (c.base_size + 1) * c.extra
        then (rank + c.base_size) / (c.base_size + 1)
        else c.extra +
          (rank - (c.base_size + 1) * c.extra + c.base_size - 1) / c.base_size
      end division_index
    from cases c cross join lateral generate_series(1, c.n) r(rank)
  ), sizes as (
    select n, max(divisions) divisions, division_index, count(*) size
    from assignment group by n, division_index
  )
  select
    (select count(*) from sizes
      where size < 2 or size > 20 or division_index < 1
        or division_index > divisions),
    (select count(*) from (
      select n from sizes group by n
      having max(size) - min(size) > 1 or count(*) <> max(divisions)
    ) invalid),
    (select jsonb_agg(size order by division_index)
      from sizes where n = 45)
    into v_bad_groups, v_unbalanced, v_forty_five;
  if v_bad_groups <> 0 or v_unbalanced <> 0
    or v_forty_five <> '[15, 15, 15]'::jsonb then
    raise exception 'Division size formula failed: %, %, %',
      v_bad_groups, v_unbalanced, v_forty_five;
  end if;
end;
$probe$;
