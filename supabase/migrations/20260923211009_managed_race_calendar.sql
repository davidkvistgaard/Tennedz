-- Additive, service-only calendar administration. Existing races are untouched.
create table public.race_calendar_requests (
  id uuid primary key,
  created_by uuid not null references auth.users(id),
  definition jsonb not null,
  event_ids uuid[] not null,
  stage_id uuid not null references public.stage_profiles(id),
  created_at timestamptz not null default now()
);
alter table public.race_calendar_requests enable row level security;
revoke all on public.race_calendar_requests from public, anon, authenticated;
grant select, insert on public.race_calendar_requests to service_role;

create function public.recovery_create_race_day(p_request uuid,p_user uuid,p_definition jsonb)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare
  previous public.race_calendar_requests%rowtype;
  stage_data jsonb:=p_definition->'stage';
  deadline_at timestamptz:=(p_definition->>'deadline')::timestamptz;
  new_stage uuid; event_id uuid; event_ids uuid[]:='{}';
  gender_code text; genders text[];
begin
  if p_request is null or p_user is null or p_definition is null then
    raise sqlstate 'PT400' using message='Oprettelsen mangler oplysninger.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
  select * into previous from public.race_calendar_requests where id=p_request;
  if found then
    if previous.created_by<>p_user or previous.definition<>p_definition then
      raise sqlstate 'PT409' using message='Denne oprettelse er allerede brugt med andre oplysninger.';
    end if;
    return jsonb_build_object('ok',true,'already_created',true,'event_ids',previous.event_ids);
  end if;
  if coalesce(length(trim(p_definition->>'name')),0) not between 3 and 90
    or coalesce(p_definition->>'gender','') not in ('M','F','BOTH')
    or deadline_at is null or deadline_at<clock_timestamp()+interval '14 minutes'
    or deadline_at>clock_timestamp()+interval '90 days'
    or coalesce(stage_data->>'id','') not in ('coast','hills','mountains','cobbles')
    or coalesce((stage_data->>'distance_km')::integer,0) not between 20 and 400
    or jsonb_typeof(stage_data->'profile_points') is distinct from 'array'
    or jsonb_array_length(stage_data->'profile_points') not between 2 and 1000
    or jsonb_typeof(stage_data->'keypoints') is distinct from 'array'
    or jsonb_typeof(stage_data->'tags') is distinct from 'array' then
    raise sqlstate 'PT400' using message='Ugyldig rute, kategori eller deadline.';
  end if;
  insert into public.stage_profiles(name,country_code,distance_km,profile_points,keypoints,tags)
  values(stage_data->>'name',stage_data->>'country_code',(stage_data->>'distance_km')::integer,
    stage_data->'profile_points',stage_data->'keypoints',array(select jsonb_array_elements_text(stage_data->'tags')))
  returning id into new_stage;
  genders:=case when p_definition->>'gender'='BOTH' then array['M','F'] else array[p_definition->>'gender'] end;
  foreach gender_code in array genders loop
    insert into public.events(name,kind,gender,country_code,stage_profile_id,deadline,entry_fee,prize_pool,rake_percent,status,seed)
    values(trim(p_definition->>'name')||case when gender_code='M' then ' · Mænd' else ' · Kvinder' end,
      'one_day',gender_code,stage_data->>'country_code',new_stage,deadline_at,0,0,0,'OPEN',gen_random_uuid()::text)
    returning id into event_id;
    event_ids:=array_append(event_ids,event_id);
  end loop;
  insert into public.race_calendar_requests(id,created_by,definition,event_ids,stage_id)
  values(p_request,p_user,p_definition,event_ids,new_stage);
  return jsonb_build_object('ok',true,'already_created',false,'event_ids',event_ids);
end;
$$;
revoke all on function public.recovery_create_race_day(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.recovery_create_race_day(uuid,uuid,jsonb) to service_role;
