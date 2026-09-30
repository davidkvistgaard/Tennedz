-- Enrich the established idempotent race-day creation in the same transaction.
-- Legacy callers can continue using recovery_create_race_day unchanged.
begin;
create function public.recovery_create_scheduled_race_day(
  p_request uuid,p_user uuid,p_definition jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_schedule timestamptz; v_source_date date; v_source text;
  v_tier integer; v_result jsonb; v_ids uuid[];
begin
  begin
    v_schedule:=(p_definition->>'scheduled_at')::timestamptz;
    v_source_date:=(p_definition->>'source_date')::date;
    v_tier:=(p_definition->>'race_tier')::integer;
  exception when others then
    raise sqlstate 'PT400' using message='Invalid scheduled race details.';
  end;
  v_source:=p_definition->>'calendar_source';
  if v_schedule is null or coalesce(v_source,'') not in ('UCI','PELOTONIA')
    or v_tier is null or v_tier not between 1 and 6
    or extract(isodow from v_schedule at time zone 'UTC') not in (3,7)
    or v_schedule<=coalesce((p_definition->>'deadline')::timestamptz,'infinity'::timestamptz)
    or v_schedule>clock_timestamp()+interval '90 days' then
    raise sqlstate 'PT400' using message='Invalid scheduled race details.';
  end if;
  if v_source='UCI' and (v_source_date is null
    or coalesce(p_definition->>'source_url','') !~ '^https?://'
    or date_trunc('week',v_source_date::timestamp)<>
      date_trunc('week',v_schedule at time zone 'UTC')) then
    raise sqlstate 'PT400' using message='UCI source week and metadata are required.';
  end if;
  v_result:=public.recovery_create_race_day(p_request,p_user,p_definition);
  v_ids:=array(select jsonb_array_elements_text(v_result->'event_ids')::uuid);
  update public.events e set
    calendar_source=v_source,race_tier=v_tier,race_team_size=8,
    scheduled_at=v_schedule,source_date=v_source_date,
    source_url=nullif(p_definition->>'source_url',''),
    calendar_pair_id=case when p_definition->>'gender'='BOTH' then p_request else null end,
    name=trim(p_definition->>'name')||
      case when e.gender='M' then ' · Men' else ' · Women' end
  where e.id=any(v_ids);
  if (select count(*) from public.events e where e.id=any(v_ids))<>cardinality(v_ids) then
    raise sqlstate 'PT409' using message='Created races could not be reconciled.';
  end if;
  return v_result||jsonb_build_object('scheduled_at',v_schedule,
    'calendar_source',v_source,'race_tier',v_tier);
end;
$$;
revoke all on function public.recovery_create_scheduled_race_day(uuid,uuid,jsonb)
  from public,anon,authenticated;
grant execute on function public.recovery_create_scheduled_race_day(uuid,uuid,jsonb)
  to service_role;
commit;
