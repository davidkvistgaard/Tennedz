-- Run only against the isolated test project after two_phase_tactics_edit.
-- The PZ001 subtransaction rolls back every fixture mutation.
do $probe$
declare
  v_event uuid;
  v_team uuid;
  v_user uuid;
  v_riders uuid[];
  v_changed_riders uuid[];
  v_new_rider uuid;
  v_foreign_user uuid;
  v_old_captain uuid;
  v_new_captain uuid;
  v_coins integer;
  v_orders jsonb;
  v_message text;
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
begin
  if has_function_privilege('anon',
    'public.recovery_edit_revealed_tactics(uuid,uuid,uuid[],uuid,jsonb)',
    'EXECUTE') then
    raise exception 'Tactics edit RPC is exposed to anonymous users.';
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
  select et.team_id, t.user_id, et.selected_riders, et.captain_id, t.coins
    into v_team, v_user, v_riders, v_old_captain, v_coins
    from public.event_teams et join public.teams t on t.id = et.team_id
    where et.event_id = v_event order by et.team_id limit 1;
  v_new_captain := v_riders[2];
  select r.id into v_new_rider
    from public.team_riders tr join public.riders r on r.id = tr.rider_id
    where tr.team_id = v_team and r.gender = 'M'
      and not (r.id = any(v_riders))
      and (r.injury_until is null or r.injury_until <=
        (select game_date from public.game_state where id = 1))
    order by r.id limit 1;
  if v_new_rider is null then raise exception 'No alternate fit rider.'; end if;
  v_changed_riders := array_replace(v_riders, v_riders[8], v_new_rider);
  select t.user_id into v_foreign_user from public.teams t
    where not exists(select 1 from public.event_teams et
      where et.event_id = v_event and et.team_id = t.id)
    and t.user_id is not null order by t.id limit 1;
  if v_foreign_user is null then raise exception 'No non-entrant team.'; end if;
  select jsonb_build_object('version', 1, 'plan', 'captain',
    'riders', jsonb_object_agg(rider_id::text,
      jsonb_build_object('role', case when rider_id = v_new_captain
        then 'captain' else 'helper' end, 'effort', 'balanced')))
    into v_orders from unnest(v_changed_riders) rider_id;

  begin
    perform public.recovery_edit_revealed_tactics(
      v_user, v_event, v_riders, v_new_captain, v_orders);
    raise exception 'Legacy race permitted a two-phase tactics edit.';
  exception when sqlstate 'PT409' then
    get stacked diagnostics v_message = message_text;
    if v_message <> 'This team is outside the tactics preparation phase.'
      then raise; end if;
  end;

  begin
    update public.events set
      deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA'
      where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    begin
      perform public.recovery_edit_revealed_tactics(
        v_user, v_event, v_riders, v_new_captain, v_orders);
      raise exception 'Tactics edit passed before division reveal.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'This team is outside the tactics preparation phase.'
        then raise; end if;
    end;

    perform public.recovery_commit_division_reveal(v_event);
    begin
      perform public.recovery_edit_revealed_tactics(
        v_foreign_user, v_event, v_changed_riders, v_new_captain, v_orders);
      raise exception 'A non-entrant edited tactics.';
    exception when sqlstate 'PT409' then null;
    end;
    begin
      perform public.recovery_edit_revealed_tactics(
        v_user, v_event, v_changed_riders, v_new_captain,
        jsonb_set(v_orders, '{plan}', '"cheat"'::jsonb));
      raise exception 'Invalid orders were accepted.';
    exception when sqlstate 'PT400' then null;
    end;
    perform public.recovery_edit_revealed_tactics(
      v_user, v_event, v_changed_riders, v_new_captain, v_orders);
    if not exists(select 1 from public.event_teams et
      where et.event_id = v_event and et.team_id = v_team
        and et.captain_id = v_new_captain and et.orders = v_orders
        and et.selected_riders = v_changed_riders)
      or (select t.coins from public.teams t where t.id = v_team)
        is distinct from v_coins then
      raise exception 'Tactics edit did not save or changed team coins.';
    end if;

    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;
    begin
      perform public.recovery_edit_revealed_tactics(
        v_user, v_event, v_riders, v_old_captain, v_orders);
      raise exception 'Tactics edit passed after tactics close.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'This team is outside the tactics preparation phase.'
        then raise; end if;
    end;
    raise sqlstate 'PZ001' using message = 'Rollback tactics probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.recovery_division_reveals r
      where r.event_id = v_event)
    or exists(select 1 from public.events e
      where e.id = v_event and e.registration_deadline is not null)
    or exists(select 1 from public.recovery_autopilot_jobs j
      where j.event_id = v_event)
    or not exists(select 1 from public.event_teams et
      where et.event_id = v_event and et.team_id = v_team
        and et.captain_id = v_old_captain) then
    raise exception 'Tactics probe left persistent changes.';
  end if;
end;
$probe$;
