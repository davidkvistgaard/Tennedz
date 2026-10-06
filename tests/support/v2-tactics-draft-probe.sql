-- Run only against the isolated recovery test project. The PZ001
-- subtransaction rolls back the calendar, reveal, and draft mutations.
do $probe$
declare
  v_event uuid;
  v_team uuid;
  v_user uuid;
  v_foreign_user uuid;
  v_riders uuid[];
  v_captain uuid;
  v_coins integer;
  v_orders jsonb;
  v_message text;
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
begin
  if has_function_privilege('anon',
      'public.recovery_save_v2_tactics_draft(uuid,uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_save_v2_tactics_draft(uuid,uuid,jsonb)', 'EXECUTE')
    or not has_function_privilege('service_role',
      'public.recovery_save_v2_tactics_draft(uuid,uuid,jsonb)', 'EXECUTE')
    or has_table_privilege('anon', 'public.recovery_v2_tactics_drafts', 'SELECT')
    or has_table_privilege('authenticated',
      'public.recovery_v2_tactics_drafts', 'SELECT') then
    raise exception 'V2 draft permissions are not private.';
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
    into v_team, v_user, v_riders, v_captain, v_coins
    from public.event_teams et join public.teams t on t.id = et.team_id
    where et.event_id = v_event order by et.team_id limit 1;
  select t.user_id into v_foreign_user from public.teams t
    where not exists(select 1 from public.event_teams et
      where et.event_id = v_event and et.team_id = t.id)
      and t.user_id is not null
      and (select count(*) from public.teams owned
        where owned.user_id = t.user_id) = 1
    order by t.id limit 1;
  if v_foreign_user is null then raise exception 'No non-entrant team.'; end if;
  v_orders := jsonb_build_object('version', 2,
    'captainId', v_captain::text, 'roadCaptainId', v_captain::text,
    'helperIds', jsonb_build_array(v_riders[2]::text),
    'baseline', jsonb_build_object('effort', 'steady'),
    'phases', '[]'::jsonb);

  begin
    perform public.recovery_save_v2_tactics_draft(v_user, v_event, v_orders);
    raise exception 'Draft saved before registration closed.';
  exception when sqlstate 'PT409' then null;
  end;

  begin
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA' where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    begin
      perform public.recovery_save_v2_tactics_draft(v_user, v_event, v_orders);
      raise exception 'Draft saved before reveal.';
    exception when sqlstate 'PT403' then null;
    end;
    perform public.recovery_commit_division_reveal(v_event);

    begin
      perform public.recovery_save_v2_tactics_draft(
        v_foreign_user, v_event, v_orders);
      raise exception 'A non-entrant saved a draft.';
    exception when sqlstate 'PT403' then null;
    end;
    begin
      perform public.recovery_save_v2_tactics_draft(
        v_user, v_event,
        jsonb_set(v_orders, '{captainId}', to_jsonb(v_riders[2]::text)));
      raise exception 'Invalid captain was accepted.';
    exception when sqlstate 'PT400' then null;
    end;
    begin
      perform public.recovery_save_v2_tactics_draft(
        v_user, v_event,
        jsonb_set(v_orders, '{helperIds}',
          jsonb_build_array(v_riders[2]::text, v_riders[2]::text)));
      raise exception 'Duplicate helper was accepted.';
    exception when sqlstate 'PT400' then null;
    end;
    perform public.recovery_save_v2_tactics_draft(v_user, v_event, v_orders);
    perform public.recovery_save_v2_tactics_draft(v_user, v_event, v_orders);
    if (select count(*) from public.recovery_v2_tactics_drafts d
        where d.event_id = v_event and d.team_id = v_team) <> 1
      or not exists(select 1 from public.recovery_v2_tactics_drafts d
        where d.event_id = v_event and d.team_id = v_team
          and d.selected_riders = v_riders
          and d.captain_id = v_captain and d.orders = v_orders)
      or (select t.coins from public.teams t where t.id = v_team)
        is distinct from v_coins then
      raise exception 'Draft was not saved once, or changed team coins.';
    end if;

    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;
    begin
      perform public.recovery_save_v2_tactics_draft(v_user, v_event, v_orders);
      raise exception 'Draft saved after tactics close.';
    exception when sqlstate 'PT409' then
      get stacked diagnostics v_message = message_text;
      if v_message <> 'This race is outside tactics preparation.' then raise; end if;
    end;
    raise sqlstate 'PZ001' using message = 'Rollback v2 draft probe.';
  exception when sqlstate 'PZ001' then null;
  end;

  if exists(select 1 from public.recovery_v2_tactics_drafts d
      where d.event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals r
      where r.event_id = v_event)
    or exists(select 1 from public.events e
      where e.id = v_event and e.registration_deadline is not null)
    or exists(select 1 from public.recovery_autopilot_jobs j
      where j.event_id = v_event) then
    raise exception 'V2 draft probe left persistent changes.';
  end if;
end;
$probe$;
