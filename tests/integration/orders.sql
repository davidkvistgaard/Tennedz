-- Isolated test project only. All fixture changes roll back.
begin;
do $$
declare source_event uuid; v_event uuid:=gen_random_uuid(); et public.event_teams; owner_id uuid; plan jsonb; before_coins integer; saved jsonb; snap jsonb;
begin
 select e.id into source_event from public.events e join public.event_teams x on x.event_id=e.id where e.kind='one_day' group by e.id having count(*)>=2 limit 1;
 if source_event is null then raise exception 'A seeded two-team race is required'; end if;
 insert into public.events select (jsonb_populate_record(null::public.events,to_jsonb(e)||jsonb_build_object('id',v_event,'name','Orders transaction test','status','OPEN','deadline',clock_timestamp()+interval '1 hour','entry_fee',7))).* from public.events e where e.id=source_event;
 for et in select * from public.event_teams where event_id=source_event loop
   select user_id,coins into owner_id,before_coins from public.teams where id=et.team_id;
   update public.riders set injury_until=null where id=any(et.selected_riders);
   select jsonb_build_object('version',1,'plan','captain','riders',jsonb_object_agg(id::text,jsonb_build_object('role',case when id=et.captain_id then 'captain' else 'helper' end,'effort','balanced'))) into plan from unnest(et.selected_riders) id;
   perform public.recovery_join_event_with_orders(owner_id,v_event,et.selected_riders,et.captain_id,plan);
   perform public.recovery_join_event_with_orders(owner_id,v_event,et.selected_riders,et.captain_id,plan);
   if (select coins from public.teams where id=et.team_id)<>before_coins-7 then raise exception 'Entry fee was not charged exactly once'; end if;
   select x.orders into saved from public.event_teams x where x.event_id=v_event and x.team_id=et.team_id;
   if saved is distinct from plan then raise exception 'Orders not persisted'; end if;
   begin
     perform public.recovery_join_event_with_orders(owner_id,v_event,et.selected_riders,et.captain_id,jsonb_set(plan,'{plan}','"cheat"'));
     raise exception 'Invalid orders accepted';
   exception when sqlstate 'PT400' then null; end;
 end loop;
 update public.events set deadline=clock_timestamp()-interval '1 second' where id=v_event;
 snap:=public.recovery_race_snapshot(v_event);
 if snap->'teams'->0->'entry'->'orders'->>'plan' is distinct from 'captain' then raise exception 'Snapshot lost orders'; end if;
 begin
   perform public.recovery_join_event_with_orders(owner_id,v_event,et.selected_riders,et.captain_id,plan);
   raise exception 'Late orders accepted';
 exception when sqlstate 'PT409' then null; end;
end $$;
rollback;
select 'PASS: orders persist, fee once, invalid input rejected, snapshot captures orders, deadline enforced; fixtures rolled back' result;
