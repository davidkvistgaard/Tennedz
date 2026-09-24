-- Additive, nullable orders. Apply to isolated test project before production approval.
begin;
alter table public.event_teams add column orders jsonb;
create or replace function public.recovery_join_event(p_user uuid, p_event uuid, p_riders uuid[], p_captain uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.events; t public.teams; gd date; n integer; fee integer; prior boolean;
begin
  perform pg_advisory_xact_lock(73192026);
  select count(*) into n from public.teams where user_id=p_user;
  if n <> 1 then raise exception using errcode='PT409', message='Holdtilknytningen er ikke entydig.'; end if;
  select * into t from public.teams where user_id=p_user for update;
  select * into e from public.events where id=p_event for update;
  if not found then raise exception using errcode='PT404', message='Løbet findes ikke.'; end if;
  if e.kind <> 'one_day' then raise exception using errcode='PT409', message='Kun endagsløb er åbnet.'; end if;
  if e.status is distinct from 'OPEN' or e.deadline <= clock_timestamp() then
    raise exception using errcode='PT409', message='Tilmeldingsfristen er passeret, eller løbet er lukket.';
  end if;
  if p_riders is null or cardinality(p_riders) <> 8 or p_captain is null or not (p_captain=any(p_riders))
    or (select count(distinct x) from unnest(p_riders) x) <> 8 then
    raise exception using errcode='PT400', message='Vælg otte forskellige ryttere og en kaptajn blandt dem.';
  end if;
  select game_date into gd from public.game_state where id=1;
  if gd is null then raise exception using errcode='PT409', message='Spilledato mangler.'; end if;
  select count(distinct r.id) into n from public.riders r join public.team_riders tr on tr.rider_id=r.id
    where tr.team_id=t.id and r.id=any(p_riders)
      and (e.gender is null or r.gender=e.gender) and (r.injury_until is null or r.injury_until <= gd);
  if n <> 8 then raise exception using errcode='PT400', message='Rytterne skal tilhøre dit hold, passe til løbets køn og være skadesfri.'; end if;
  fee := coalesce(e.entry_fee,0);
  if fee < 0 then raise exception using errcode='PT409', message='Ugyldigt startgebyr.'; end if;
  select exists(select 1 from public.event_teams where event_id=e.id and team_id=t.id) into prior;
  if not exists(select 1 from public.recovery_entry_receipts where event_id=e.id and team_id=t.id) then
    if prior and fee > 0 then raise exception using errcode='PT409', message='Det tidligere startgebyr skal afklares af administratoren.'; end if;
    if coalesce(t.coins,0) < fee then raise exception using errcode='PT409', message='Dit hold har ikke nok coins til startgebyret.'; end if;
    update public.teams set coins=coalesce(coins,0)-fee where id=t.id;
    insert into public.recovery_entry_receipts values(e.id,t.id,fee);
  end if;
  insert into public.event_teams(event_id,team_id,selected_riders,captain_id)
    values(e.id,t.id,p_riders,p_captain)
    on conflict(event_id,team_id) do update set selected_riders=excluded.selected_riders,captain_id=excluded.captain_id,orders=null;
  return jsonb_build_object('ok',true,'event_id',e.id,'team_id',t.id);
end $$;


create function public.recovery_join_event_with_orders(p_user uuid,p_event uuid,p_riders uuid[],p_captain uuid,p_orders jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; item record;
begin
  if p_orders is null or jsonb_typeof(p_orders) is distinct from 'object'
    or p_orders->'version' is distinct from '1'::jsonb
    or coalesce(p_orders->>'plan','') not in ('balanced','captain','breakaway','conserve')
    or jsonb_typeof(p_orders->'riders') is distinct from 'object' then
    raise exception using errcode='PT400',message='Invalid race orders.';
  end if;
  if (select count(*) from jsonb_object_keys(p_orders)) <> 3
    or (select count(*) from jsonb_object_keys(p_orders->'riders')) <> 8 then
    raise exception using errcode='PT400',message='Invalid race orders.';
  end if;
  for item in select * from jsonb_each(p_orders->'riders') loop
    if not coalesce(item.key=any(p_riders::text[]),false) or jsonb_typeof(item.value) is distinct from 'object' then
      raise exception using errcode='PT400',message='Invalid race orders.';
    end if;
    if (select count(*) from jsonb_object_keys(item.value)) <> 2
      or coalesce(item.value->>'effort','') not in ('careful','balanced','aggressive')
      or (item.key=p_captain::text and item.value->>'role' is distinct from 'captain')
      or (item.key<>p_captain::text and coalesce(item.value->>'role','') not in ('free','helper','attacker')) then
      raise exception using errcode='PT400',message='Invalid race orders.';
    end if;
  end loop;
  -- Existing function locks, validates ownership/gender/injury/deadline and charges at most once.
  -- This wrapper and the orders update share that transaction. Any failure rolls everything back.
  result := public.recovery_join_event(p_user,p_event,p_riders,p_captain);
  update public.event_teams set orders=p_orders where event_id=p_event and team_id=(result->>'team_id')::uuid;
  return result;
end $$;
revoke all on function public.recovery_join_event_with_orders(uuid,uuid,uuid[],uuid,jsonb) from public,anon,authenticated;
grant execute on function public.recovery_join_event_with_orders(uuid,uuid,uuid[],uuid,jsonb) to service_role;
-- Snapshot already includes to_jsonb(event_teams): orders are captured and checked on finalization.
commit;
