-- Finish a recorded physical race without fabricating official rankings,
-- awards or points. The recording is immutable and was validated by the
-- preceding save RPC. All other race types keep their existing finalizer.
create function public.recovery_finalize_position_race_v1(
  p_event uuid,p_sha256 text
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare r public.recovery_position_race_recordings;
  current_snapshot jsonb; current_entries jsonb;
  previous jsonb; summary jsonb; riders integer;
begin
  perform pg_advisory_xact_lock(73192026);
  select c.summary into previous from public.recovery_race_commits c
    where c.event_id=p_event;
  if found then
    if previous->>'engine_version' is distinct from
        'physical-first-position-general-race-8'
      or previous->>'recording_sha256' is distinct from p_sha256 then
      raise exception using errcode='PT409',
        message='A different race is already committed.';
    end if;
    return previous || '{"already_finished":true}'::jsonb;
  end if;
  select * into r from public.recovery_position_race_recordings
    where event_id=p_event;
  if not found then
    raise exception using errcode='PT404',
      message='The physical race has no saved recording.';
  end if;
  if r.schema_version is distinct from
      'physical-position-recording-v1'
    or r.document->>'sha256' is distinct from p_sha256
    or r.archive_metadata->>'viewerDocumentSha256' is distinct
      from p_sha256
    or r.document->'input'->>'officialResults' is distinct from
      'false'
    or r.document->'source'->>'version' is distinct from
      'physical-first-position-general-race-8'
    or r.document->'feed' ? 'results'
    or r.document->>'raceId' is distinct from
      p_event::text || ':position-preview' then
    raise exception using errcode='PT409',
      message='The saved physical race is not eligible for finalization.';
  end if;
  current_snapshot := public.recovery_race_snapshot(p_event);
  if current_snapshot is distinct from r.input_snapshot then
    raise exception using errcode='PT409',
      message='The race inputs changed after position recording.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(i) - 'committed_at'
    order by i.team_id),'[]'::jsonb) into current_entries
    from public.recovery_physical_entry_inputs i
    where i.event_id=p_event;
  if current_entries is distinct from r.physical_entries
    or jsonb_array_length(current_entries) is distinct from
      jsonb_array_length(current_snapshot->'teams') then
    raise exception using errcode='PT409',
      message='A team changed its physical race orders.';
  end if;
  riders := jsonb_array_length(r.document->'feed'->'riders');
  if riders is null or riders<16 or riders<>8*
      jsonb_array_length(current_snapshot->'teams')
    or (r.document->'coverage'->>'paidRiderKilometres')::integer
      is distinct from riders*
        (r.document->'source'->>'validatedKm')::integer then
    raise exception using errcode='PT409',
      message='The physical race is missing paid rider kilometres.';
  end if;
  summary := jsonb_build_object(
    'ok',true,'event_id',p_event,'riders',riders,
    'engine_version','physical-first-position-general-race-8',
    'recording_sha256',p_sha256,
    'recorded_at',r.recorded_at,
    'viewer_kind','position','official_results',false,
    'total_divisions',0,'already_finished',false);
  update public.events set status='FINISHED',
    seed=r.document->'source'->>'raceSeed',
    engine_version='physical-first-position-general-race-8'
    where id=p_event;
  insert into public.recovery_race_commits(
    event_id,input_snapshot,summary)
    values(p_event,r.input_snapshot,summary);
  return summary;
end $$;
revoke all on function
  public.recovery_finalize_position_race_v1(uuid,text)
  from public,anon,authenticated;
grant execute on function
  public.recovery_finalize_position_race_v1(uuid,text)
  to service_role;
