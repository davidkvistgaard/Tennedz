-- Award calendar points inside the existing atomic race commit. Historic,
-- unclassified races retain their legacy rating/result behavior only.
begin;

create function public.recovery_one_day_sporting_points(
  p_tier smallint, p_place integer, p_multiplier numeric)
returns integer language plpgsql immutable security invoker set search_path = '' as $$
declare winner numeric; percentage numeric;
begin
  if p_tier is null or p_tier not between 1 and 6 or p_place is null or p_place < 1
    or p_multiplier is null or p_multiplier <= 0 or p_multiplier > 1 then
    raise exception using errcode='22023', message='Invalid one-day points input.';
  end if;
  if p_place > 20 then return 0; end if;
  winner := (array[60,125,250,400,650,1000]::numeric[])[p_tier];
  percentage := (array[100,75,60,50,42,36,31,27,23,20,17,14,12,10,8,7,6,5,4,3]::numeric[])[p_place];
  -- First round the published tier curve, then apply the recorded division weight.
  return round(round(winner*percentage/100)*p_multiplier)::integer;
end $$;
revoke all on function public.recovery_one_day_sporting_points(smallint,integer,numeric)
  from public, anon, authenticated;
grant execute on function public.recovery_one_day_sporting_points(smallint,integer,numeric)
  to service_role;

create function public.recovery_award_one_day_commit()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare race record;
begin
  select e.kind,e.gender,e.calendar_source,e.race_tier,e.scheduled_at
    into race from public.events e where e.id=new.event_id;
  if not found then raise exception 'Committed race event is missing.'; end if;
  if race.kind <> 'one_day' or race.scheduled_at is null then return new; end if;
  if race.gender is null or race.gender not in ('M','F')
    or race.calendar_source is null or race.calendar_source not in ('UCI','PELOTONIA')
    or race.race_tier is null or race.race_tier not between 1 and 6 then
    raise exception 'Scheduled one-day race lacks valid award metadata.';
  end if;

  insert into public.recovery_ranking_awards (
    award_key,rider_id,team_id,event_id,season_year,gender,calendar_source,
    event_format,race_tier,result_type,result_place,points,points_policy_version)
  select 'one_day:' || new.event_id::text || ':' || result.rider_id::text,
    result.rider_id,result.team_id,new.event_id,
    extract(year from race.scheduled_at at time zone 'UTC')::integer,
    race.gender,race.calendar_source,'ONE_DAY',race.race_tier,'ONE_DAY',
    result.position,award.points,'v0.1'
  from public.event_rider_results result
  cross join lateral (
    select public.recovery_one_day_sporting_points(
      race.race_tier,result.position,result.multiplier) as points
  ) award
  where result.event_id=new.event_id and award.points>0;
  return new;
end $$;
revoke all on function public.recovery_award_one_day_commit()
  from public, anon, authenticated;

create trigger recovery_award_one_day_on_commit
after insert on public.recovery_race_commits
for each row execute function public.recovery_award_one_day_commit();

commit;
