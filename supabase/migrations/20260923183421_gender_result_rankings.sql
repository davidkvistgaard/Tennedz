begin;
create function public.recovery_rankings(p_gender text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare teams_json jsonb; riders_json jsonb;
begin
 if p_gender is null or p_gender not in ('M','F') then
  raise exception using errcode='PT400',message='Vælg mænd eller kvinder.';
 end if;
 with membership as (
  select distinct tr.team_id,r.id,greatest(coalesce(r.rating,0),0) rating
  from public.team_riders tr join public.riders r on r.id=tr.rider_id where r.gender=p_gender
 ), ranked as (
  select *,row_number() over(partition by team_id order by rating desc,id) rn from membership
 ), totals as (
  select team_id,sum(rating) rating from ranked where rn<=16 group by team_id
 ), leaders as (
  select t.id,t.name,coalesce(s.rating,0) rating from public.teams t left join totals s on s.team_id=t.id
  order by rating desc,t.id limit 50
 ) select coalesce(jsonb_agg(to_jsonb(l) order by l.rating desc,l.id),'[]'::jsonb) into teams_json from leaders l;
 select coalesce(jsonb_agg(to_jsonb(l) order by l.rating desc,l.id),'[]'::jsonb) into riders_json from (
  select id,name,greatest(coalesce(rating,0),0) rating from public.riders where gender=p_gender
  order by rating desc,id limit 50
 ) l;
 return jsonb_build_object('ok',true,'gender',p_gender,'teams',teams_json,'riders',riders_json);
end $$;
revoke all on function public.recovery_rankings(text) from public,anon,authenticated;
grant execute on function public.recovery_rankings(text) to service_role;
commit;
