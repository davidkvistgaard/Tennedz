begin;

-- Service-only opt-in. The existing scheduled creator and legacy races remain unchanged.
create function public.recovery_create_two_phase_race_day(
  p_request uuid,p_user uuid,p_definition jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  v_registration timestamptz;
  v_tactics timestamptz;
  v_schedule timestamptz;
  v_next_scan timestamptz;
  v_result jsonb;
  v_ids uuid[];
begin
  begin
    v_registration:=(p_definition->>'deadline')::timestamptz;
    v_tactics:=(p_definition->>'tactics_deadline')::timestamptz;
    v_schedule:=(p_definition->>'scheduled_at')::timestamptz;
  exception when others then
    raise sqlstate 'PT400' using message='Invalid two-phase race deadlines.';
  end;
  if v_registration is null or v_tactics is null or v_schedule is null then
    raise sqlstate 'PT400' using message='Two-phase race deadlines are required.';
  end if;
  v_next_scan:=(pg_catalog.date_trunc('day',v_registration at time zone 'UTC')
    + interval '2 hours') at time zone 'UTC';
  if v_next_scan<=v_registration then v_next_scan:=v_next_scan+interval '1 day'; end if;
  if v_tactics<=v_next_scan+interval '70 minutes' or v_tactics>=v_schedule then
    raise sqlstate 'PT400' using message='Tactics deadline must allow a division reveal before race day.';
  end if;

  -- The safe creator guarantees a scan before registration closes. Its request
  -- record checks idempotent retries against the full definition.
  v_result:=public.recovery_create_scheduled_race_day_safe(
    p_request,p_user,p_definition);
  v_ids:=array(select jsonb_array_elements_text(v_result->'event_ids')::uuid);
  update public.events e set registration_deadline=v_registration,
    tactics_deadline=v_tactics where e.id=any(v_ids);
  if (select count(*) from public.events e where e.id=any(v_ids)
      and e.registration_deadline=v_registration and e.tactics_deadline=v_tactics)
      <>cardinality(v_ids) then
    raise sqlstate 'PT409' using message='Two-phase races could not be reconciled.';
  end if;
  return v_result||jsonb_build_object('registration_deadline',v_registration,
    'tactics_deadline',v_tactics);
end;
$$;
revoke all on function public.recovery_create_two_phase_race_day(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.recovery_create_two_phase_race_day(uuid,uuid,jsonb)
  to service_role;

commit;
