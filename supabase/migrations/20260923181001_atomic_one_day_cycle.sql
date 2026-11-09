-- Additive migration. Apply to the isolated test project first. Production needs approval.
begin;
create table public.recovery_race_commits (
  event_id uuid primary key references public.events(id),
  input_snapshot jsonb not null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);
create table public.recovery_entry_receipts (
  event_id uuid not null references public.events(id),
  team_id uuid not null references public.teams(id),
  fee_paid integer not null check (fee_paid >= 0),
  primary key (event_id, team_id)
);
alter table public.recovery_race_commits enable row level security;
alter table public.recovery_entry_receipts enable row level security;
revoke all on public.recovery_race_commits, public.recovery_entry_receipts from public, anon, authenticated;
grant all on public.recovery_race_commits, public.recovery_entry_receipts to service_role;

-- All cycle writes share this transaction lock. A simulation itself holds no DB lock:
-- finalization compares the complete input snapshot again under the lock.
create function public.recovery_join_event(p_user uuid, p_event uuid, p_riders uuid[], p_captain uuid)
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
    on conflict(event_id,team_id) do update set selected_riders=excluded.selected_riders,captain_id=excluded.captain_id;
  return jsonb_build_object('ok',true,'event_id',e.id,'team_id',t.id);
end $$;

create function public.recovery_race_snapshot(p_event uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare e public.events; s public.stage_profiles; gd date; ts jsonb; previous jsonb;
begin
  perform pg_advisory_xact_lock(73192026);
  select summary into previous from public.recovery_race_commits where event_id=p_event;
  if found then return jsonb_build_object('finished',true,'summary',previous); end if;
  select * into e from public.events where id=p_event for update;
  if not found then raise exception using errcode='PT404', message='Løbet findes ikke.'; end if;
  if e.kind <> 'one_day' or e.status is distinct from 'OPEN' then
    raise exception using errcode='PT409', message='Løbet kan ikke afvikles som et nyt endagsløb.';
  end if;
  if e.deadline > clock_timestamp() then raise exception using errcode='PT409', message='Deadline er ikke nået.'; end if;
  if exists(select 1 from public.event_division_runs where event_id=p_event)
    or exists(select 1 from public.event_team_results where event_id=p_event)
    or exists(select 1 from public.event_rider_results where event_id=p_event)
    or exists(select 1 from public.event_runs where event_id=p_event)
    or exists(select 1 from public.event_stages where event_id=p_event) then
    raise exception using errcode='PT409', message='Eksisterende løbsdata kræver manuel afklaring; intet overskrives.';
  end if;
  select * into s from public.stage_profiles where id=e.stage_profile_id;
  if not found then raise exception using errcode='PT409', message='Løbet mangler en ruteprofil.'; end if;
  select game_date into gd from public.game_state where id=1;
  if gd is null then raise exception using errcode='PT409', message='Spilledato mangler.'; end if;
  select coalesce(jsonb_agg(x.bundle order by x.team_id),'[]'::jsonb) into ts from (
    select t.id team_id, jsonb_build_object('id',t.id,'name',t.name,'entry',to_jsonb(et),
      'riders',(select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb)
       from public.riders r where exists(select 1 from public.team_riders tr where tr.team_id=t.id and tr.rider_id=r.id))) bundle
    from public.event_teams et join public.teams t on t.id=et.team_id where et.event_id=p_event
  ) x;
  if jsonb_array_length(ts) < 2 then raise exception using errcode='PT409', message='Der skal være mindst to tilmeldte hold.'; end if;
  if jsonb_array_length(ts) > 400 then raise exception using errcode='PT409', message='Dette løb overstiger den afprøvede grænse på 400 hold.'; end if;
  return jsonb_build_object('event',to_jsonb(e),'stage',to_jsonb(s),'game_date',gd,'teams',ts);
end $$;

create function public.recovery_finish_race(p_event uuid, p_snapshot jsonb, p_output jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_input jsonb; d jsonb; r jsonb; t jsonb; previous jsonb; summary jsonb; n integer; expected integer; updates jsonb;
begin
  perform pg_advisory_xact_lock(73192026);
  select summary into previous from public.recovery_race_commits where event_id=p_event;
  if found then return previous || '{"already_finished":true}'::jsonb; end if;
  current_input := public.recovery_race_snapshot(p_event);
  if current_input is distinct from p_snapshot then raise exception using errcode='PT409', message='Løbsgrundlaget ændrede sig. Prøv igen.'; end if;
  expected := jsonb_array_length(p_snapshot->'teams');
  if jsonb_typeof(p_output->'divisions') is distinct from 'array' or jsonb_array_length(p_output->'divisions') < 1 then
    raise exception using errcode='PT400', message='Resultatet mangler divisioner.';
  end if;
  for d in select value from jsonb_array_elements(p_output->'divisions') loop
    if jsonb_array_length(d->'teams') < 2 or jsonb_array_length(d->'teams') > 20
       or jsonb_array_length(d->'results') <> 8*jsonb_array_length(d->'teams') then
      raise exception using errcode='PT400', message='Ufuldstændigt divisionsresultat.';
    end if;
    insert into public.event_division_runs(event_id,division_index,seed,engine_version,stage_snapshot,feed,results)
      values(p_event,(d->>'index')::integer,d->>'seed',p_output->>'engine_version',p_output->'stage',d->'feed',d->'results');
    for t in select value from jsonb_array_elements(d->'teams') loop
      if not exists(select 1 from jsonb_array_elements(p_snapshot->'teams') x where x->>'id'=t->>'team_id')
        or (t->>'points')::integer < 0 or (t->>'points')::integer > 100 then
        raise exception using errcode='PT400', message='Ugyldigt holdresultat.';
      end if;
      insert into public.event_divisions(event_id,team_id,division_index,total_divisions,team_rating)
        values(p_event,(t->>'team_id')::uuid,(d->>'index')::integer,jsonb_array_length(p_output->'divisions'),(t->>'seed_power')::numeric);
      insert into public.event_team_results(event_id,team_id,captain_id,division_index,total_divisions,position,time_sec,points,multiplier)
        values(p_event,(t->>'team_id')::uuid,(t->>'captain_id')::uuid,(d->>'index')::integer,jsonb_array_length(p_output->'divisions'),
          (t->>'position')::integer,(t->>'time_sec')::numeric,(t->>'points')::integer,(d->>'multiplier')::numeric);
      update public.teams set rating=rating+(t->>'points')::integer where id=(t->>'team_id')::uuid;
    end loop;
    for r in select value from jsonb_array_elements(d->'results') loop
      if not exists(select 1 from jsonb_array_elements(p_snapshot->'teams') x
        where x->>'id'=r->>'team_id' and (x->'entry'->'selected_riders') ? (r->>'rider_id'))
        or (r->>'points')::integer < 0 or (r->>'points')::integer > 100
        or (r->>'time_sec')::numeric <= 0 then
        raise exception using errcode='PT400', message='Ugyldigt rytterresultat.';
      end if;
      insert into public.event_rider_results(event_id,rider_id,team_id,division_index,total_divisions,position,time_sec,points,multiplier)
        values(p_event,(r->>'rider_id')::uuid,(r->>'team_id')::uuid,(d->>'index')::integer,jsonb_array_length(p_output->'divisions'),
          (r->>'position')::integer,(r->>'time_sec')::numeric,(r->>'points')::integer,(d->>'multiplier')::numeric);
      updates := r->'after';
      if (updates->>'fatigue')::integer not between 0 and 100 or (updates->>'form')::integer not between 0 and 100 then
        raise exception using errcode='PT400', message='Ugyldig rytteropdatering.';
      end if;
      update public.riders set rating=rating+(r->>'points')::integer,
        fatigue=(updates->>'fatigue')::integer,form=(updates->>'form')::integer,
        injury_until=(updates->>'injury_until')::date,last_raced_on=(p_snapshot->>'game_date')::date
        where id=(r->>'rider_id')::uuid;
    end loop;
  end loop;
  select count(*) into n from public.event_team_results where event_id=p_event;
  if n <> expected then raise exception using errcode='PT400', message='Der mangler hold i resultatet.'; end if;
  select count(*) into n from public.event_rider_results where event_id=p_event;
  if n <> 8*expected then raise exception using errcode='PT400', message='Der mangler ryttere i resultatet.'; end if;
  update public.events set status='FINISHED',seed=p_output->>'seed',engine_version=p_output->>'engine_version',
    weather_locked=p_output->'weather',weather_locked_at=now(),weather_source=p_output->'weather'->>'source' where id=p_event;
  summary := jsonb_build_object('ok',true,'event_id',p_event,'total_divisions',jsonb_array_length(p_output->'divisions'),
    'riders',n,'engine_version',p_output->>'engine_version','already_finished',false);
  insert into public.recovery_race_commits(event_id,input_snapshot,summary) values(p_event,p_snapshot,summary);
  return summary;
end $$;
revoke all on function public.recovery_join_event(uuid,uuid,uuid[],uuid), public.recovery_race_snapshot(uuid), public.recovery_finish_race(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.recovery_join_event(uuid,uuid,uuid[],uuid), public.recovery_race_snapshot(uuid), public.recovery_finish_race(uuid,jsonb,jsonb) to service_role;
commit;
