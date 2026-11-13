-- Run only in the isolated recovery test project. All synthetic rows roll back.
begin;
do $$
declare t uuid := gen_random_uuid(); r uuid; i integer; owner_id uuid; score numeric;
begin
 select user_id into owner_id from public.teams where user_id is not null limit 1;
 insert into public.teams(id,user_id,name) values(t,owner_id,'Rating transaction fixture');
 for i in 1..28 loop
  r := gen_random_uuid();
  insert into public.riders(id,name,gender,rating,sprint,flat,hills,mountain,cobbles,leadership,endurance,moral,luck,wind,form,timetrial)
  values(r,'Rating fixture',case when i<=20 then 'M' else 'F' end,case when i<=20 then i else 100 end,40,40,40,40,40,40,40,40,40,40,40,40);
  insert into public.team_riders(team_id,rider_id) values(t,r);
 end loop;
 select (x->>'rating')::numeric into score from jsonb_array_elements(public.recovery_rankings('M')->'teams') x where x->>'id'=t::text;
 if score is distinct from 200 then raise exception 'Male rating mismatch: %',score; end if;
 select (x->>'rating')::numeric into score from jsonb_array_elements(public.recovery_rankings('F')->'teams') x where x->>'id'=t::text;
 if score is distinct from 800 then raise exception 'Female rating mismatch: %',score; end if;
 update public.riders set form=100,fatigue=99 where id in(select rider_id from public.team_riders where team_id=t);
 select (x->>'rating')::numeric into score from jsonb_array_elements(public.recovery_rankings('M')->'teams') x where x->>'id'=t::text;
 if score is distinct from 200 then raise exception 'Fitness changed rating'; end if;
 if has_function_privilege('anon','public.recovery_rankings(text)','execute') or has_function_privilege('authenticated','public.recovery_rankings(text)','execute') then raise exception 'Client access exposed'; end if;
end $$;
rollback;
select 'PASS: gender separation, top 16, fitness independence and client permissions; fixtures rolled back' as result;
