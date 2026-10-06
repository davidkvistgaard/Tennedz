-- Isolated database only. PZ001 rolls back every event, reveal, draft and lock.
do $probe$
declare
  v_event uuid;
  v_first public.event_teams;
  v_second public.event_teams;
  v_first_user uuid;
  v_second_user uuid;
  v_first_orders jsonb;
  v_second_orders jsonb;
  v_locked jsonb;
  v_repeat jsonb;
  v_weather jsonb := jsonb_build_object('source', 'LOCKED_SIM',
    'temp_c', 18, 'wind_kph', 5, 'precipitation_mm', 0,
    'country_code', 'DK', 'condition', 'Clear');
  v_registration timestamptz := clock_timestamp() - interval '1 hour';
begin
  if has_function_privilege('anon',
      'public.recovery_commit_v2_tactics_lock(uuid,jsonb)', 'EXECUTE')
    or has_function_privilege('authenticated',
      'public.recovery_commit_v2_tactics_lock(uuid,jsonb)', 'EXECUTE')
    or has_table_privilege('anon', 'public.recovery_v2_tactics_commits', 'SELECT')
    or has_table_privilege('authenticated',
      'public.recovery_v2_tactics_commits', 'SELECT') then
    raise exception 'V2 lock permissions are not private.';
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
  select * into v_first from public.event_teams et
    where et.event_id = v_event order by et.team_id limit 1;
  select * into v_second from public.event_teams et
    where et.event_id = v_event and et.team_id <> v_first.team_id;
  select t.user_id into v_first_user from public.teams t
    where t.id = v_first.team_id;
  select t.user_id into v_second_user from public.teams t
    where t.id = v_second.team_id;
  if v_first_user is null or v_second_user is null
    or v_first_user = v_second_user then
    raise exception 'The fixture needs two independent managers.';
  end if;
  v_first_orders := jsonb_build_object('version', 2,
    'captainId', v_first.captain_id::text,
    'roadCaptainId', v_first.captain_id::text,
    'helperIds', jsonb_build_array(v_first.selected_riders[2]::text),
    'baseline', jsonb_build_object('effort', 'steady'),
    'phases', '[]'::jsonb);
  v_second_orders := jsonb_build_object('version', 2,
    'captainId', v_second.captain_id::text,
    'roadCaptainId', v_second.captain_id::text,
    'helperIds', '[]'::jsonb,
    'baseline', jsonb_build_object('effort', 'hard'),
    'phases', '[]'::jsonb);

  begin
    update public.events set deadline = v_registration,
      registration_deadline = v_registration,
      tactics_deadline = clock_timestamp() + interval '1 hour',
      scheduled_at = clock_timestamp() + interval '2 hours',
      calendar_source = 'PELOTONIA' where id = v_event;
    insert into public.recovery_autopilot_jobs(event_id, status)
      values(v_event, 'COMPLETE');
    perform public.recovery_commit_division_reveal(v_event);
    begin
      perform public.recovery_commit_v2_tactics_lock(v_event, v_weather);
      raise exception 'V2 lock passed before tactics close.';
    exception when sqlstate 'PT409' then null;
    end;
    perform public.recovery_save_v2_tactics_draft(
      v_first_user, v_event, v_first_orders);
    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;
    begin
      perform public.recovery_commit_v2_tactics_lock(v_event, v_weather);
      raise exception 'V2 lock accepted an incomplete field.';
    exception when sqlstate 'PT409' then null;
    end;
    update public.events set tactics_deadline = clock_timestamp() + interval '1 hour'
      where id = v_event;
    perform public.recovery_save_v2_tactics_draft(
      v_second_user, v_event, v_second_orders);
    update public.events set tactics_deadline = clock_timestamp() - interval '1 minute'
      where id = v_event;
    begin
      perform public.recovery_commit_v2_tactics_lock(v_event, null);
      raise exception 'V2 lock accepted missing weather.';
    exception when sqlstate 'PT400' then null;
    end;
    v_locked := public.recovery_commit_v2_tactics_lock(v_event, v_weather);
    if v_locked->>'alreadyLocked' <> 'false'
      or v_locked->'inputSnapshot'->'v2_input_version' <> '1'::jsonb
      or v_locked->'inputSnapshot'->'v2_orders_by_team_id'
        ->v_first.team_id::text <> v_first_orders
      or v_locked->'inputSnapshot'->'v2_orders_by_team_id'
        ->v_second.team_id::text <> v_second_orders
      or v_locked->'inputSnapshot'->'event'->'weather_locked' <> v_weather
      or jsonb_array_length(v_locked->'inputSnapshot'
        ->'locked_division_reveal'->'assignments') <> 2 then
      raise exception 'The v2 lock omitted manager orders or saved reveal.';
    end if;
    update public.recovery_v2_tactics_drafts
      set orders = jsonb_set(orders, '{baseline,effort}', '"conserve"'::jsonb)
      where event_id = v_event and team_id = v_first.team_id;
    v_repeat := public.recovery_commit_v2_tactics_lock(v_event, v_weather);
    if v_repeat->>'alreadyLocked' <> 'true'
      or v_repeat->'inputSnapshot' is distinct from v_locked->'inputSnapshot'
      or exists(select 1 from public.recovery_race_commits c
        where c.event_id = v_event) then
      raise exception 'The v2 lock changed on retry or finished a legacy race.';
    end if;
    raise sqlstate 'PZ001' using message = 'Rollback v2 tactics lock probe.';
  exception when sqlstate 'PZ001' then null;
  end;
  if exists(select 1 from public.recovery_v2_tactics_commits c
      where c.event_id = v_event)
    or exists(select 1 from public.recovery_v2_tactics_drafts d
      where d.event_id = v_event)
    or exists(select 1 from public.recovery_division_reveals r
      where r.event_id = v_event)
    or exists(select 1 from public.events e
      where e.id = v_event and e.registration_deadline is not null)
    or exists(select 1 from public.recovery_autopilot_jobs j
      where j.event_id = v_event) then
    raise exception 'V2 tactics lock probe left persistent changes.';
  end if;
end;
$probe$;
