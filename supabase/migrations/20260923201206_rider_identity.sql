-- Additive, backward-compatible identity storage. No existing game data rewritten.
alter table public.riders
  add column if not exists middle_name text,
  add column if not exists name_tradition text,
  add column if not exists identity_version integer,
  add column if not exists appearance jsonb,
  add column if not exists portrait_path text;
alter table public.riders add constraint rider_appearance_v1 check (
  appearance is null or (
    jsonb_typeof(appearance)='object' and
    appearance->>'version' is not distinct from '1' and
    jsonb_typeof(appearance->'seed') is not distinct from 'string' and
    length(appearance->>'seed') between 1 and 200 and
    octet_length(appearance::text) < 8192
  )
);
-- Ignore the random seed: two identical trait combinations may not be saved.
create unique index riders_appearance_traits_unique on public.riders
  ((pg_catalog.md5((appearance - 'seed')::text))) where appearance is not null;
comment on column public.riders.appearance is 'Versioned cosmetic identity; never used by the game simulation. Seed excluded from uniqueness check.';
comment on column public.riders.portrait_path is 'Optional reviewed local PNG/WebP portrait, under /portraits/. No automatic paid AI generation.';

-- Server-only, transactional onboarding. No existing team or rider is modified.
create or replace function public.recovery_create_starter_team(p_user uuid, p_name text, p_riders jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_team uuid; v_count integer; v_rider uuid; v_row jsonb; v_skill text;
  v_day date; v_age integer; v_name text;
begin
  if p_user is null then raise exception 'Missing authenticated user' using errcode='22023'; end if;
  -- Serializes this creation path per verified user, including simultaneous requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('starter-team:' || p_user::text,0));
  select count(*) into v_count from public.teams where user_id=p_user;
  if v_count > 1 then raise exception 'Conflicting team ownership'; end if;
  if v_count = 1 then
    select id into v_team from public.teams where user_id=p_user;
    return jsonb_build_object('team_id',v_team,'created',false);
  end if;
  v_name := btrim(p_name);
  if v_name is null or char_length(v_name) not between 3 and 40 or v_name ~ '[[:cntrl:]<>]' then
    raise exception 'Invalid team name' using errcode='22023';
  end if;
  if p_riders is null or jsonb_typeof(p_riders) <> 'array' or jsonb_array_length(p_riders) <> 16 then
    raise exception 'Exactly sixteen riders required' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements(p_riders) x where x->>'gender'='M') <> 8
    or (select count(*) from jsonb_array_elements(p_riders) x where x->>'gender'='F') <> 8
    or (select count(distinct x->>'name') from jsonb_array_elements(p_riders) x) <> 16 then
    raise exception 'Eight riders per category and unique names required' using errcode='22023';
  end if;
  select game_date into v_day from public.game_state where id=1;
  if v_day is null then raise exception 'Game calendar unavailable' using errcode='22023'; end if;
  insert into public.teams(user_id,name,budget,coins,gems,rating,has_claimed_starter_pack)
    values(p_user,v_name,1000000,100000,0,0,true) returning id into v_team;
  for v_row in select value from jsonb_array_elements(p_riders) loop
    v_age := (v_row->>'age')::integer;
    if v_age is null or v_age not between 22 and 25 then raise exception 'Invalid starting age' using errcode='22023'; end if;
    foreach v_skill in array array['sprint','flat','hills','mountain','cobbles','timetrial','endurance','strength','wind'] loop
      if (v_row->>v_skill) is null or (v_row->>v_skill)::integer not between 20 and 50
        or (v_row->>(v_skill||'_cap')) is null
        or (v_row->>(v_skill||'_cap'))::integer not between (v_row->>v_skill)::integer and 90 then
        raise exception 'Invalid starter skills' using errcode='22023';
      end if;
    end loop;
    insert into public.riders(name,first_name,last_name,display_name,nationality,gender,age,birth_date,
      middle_name,name_tradition,identity_version,appearance,
      sprint,flat,hills,mountain,cobbles,timetrial,endurance,strength,wind,leadership,moral,luck,form,fatigue,rating,
      sprint_cap,flat_cap,hills_cap,mountain_cap,cobbles_cap,timetrial_cap,endurance_cap,strength_cap,wind_cap)
    values(v_row->>'name',v_row->>'first_name',v_row->>'last_name',v_row->>'name',v_row->>'nationality',v_row->>'gender',v_age,v_day-v_age*90,
      v_row->>'middle_name',v_row->>'name_tradition',(v_row->>'identity_version')::integer,v_row->'appearance',
      (v_row->>'sprint')::integer,(v_row->>'flat')::integer,(v_row->>'hills')::integer,(v_row->>'mountain')::integer,
      (v_row->>'cobbles')::integer,(v_row->>'timetrial')::integer,(v_row->>'endurance')::integer,(v_row->>'strength')::integer,(v_row->>'wind')::integer,
      35,50,35,40,0,0,
      (v_row->>'sprint_cap')::integer,(v_row->>'flat_cap')::integer,(v_row->>'hills_cap')::integer,(v_row->>'mountain_cap')::integer,
      (v_row->>'cobbles_cap')::integer,(v_row->>'timetrial_cap')::integer,(v_row->>'endurance_cap')::integer,(v_row->>'strength_cap')::integer,(v_row->>'wind_cap')::integer)
      returning id into v_rider;
    insert into public.team_riders(team_id,rider_id) values(v_team,v_rider);
  end loop;
  return jsonb_build_object('team_id',v_team,'created',true);
end;
$$;
revoke all on function public.recovery_create_starter_team(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.recovery_create_starter_team(uuid,text,jsonb) to service_role;
