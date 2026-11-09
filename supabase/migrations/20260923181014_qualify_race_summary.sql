create or replace function public.recovery_finish_race(p_event uuid, p_snapshot jsonb, p_output jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_input jsonb; d jsonb; r jsonb; t jsonb; previous jsonb; summary jsonb; n integer; expected integer; updates jsonb;
begin
  perform pg_advisory_xact_lock(73192026);
  select c.summary into previous from public.recovery_race_commits c where event_id=p_event;
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

