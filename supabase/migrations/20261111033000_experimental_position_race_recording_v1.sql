-- Experimental V7 position races have their own immutable storage.
-- Historic group-clock recordings and official results remain separate.
create table public.recovery_position_race_recordings (
  event_id uuid primary key references public.events(id),
  schema_version text not null
    check (schema_version = 'physical-position-recording-v1'),
  input_snapshot jsonb not null
    check (jsonb_typeof(input_snapshot) = 'object'),
  physical_entries jsonb not null
    check (jsonb_typeof(physical_entries) = 'array'),
  document jsonb not null
    check (jsonb_typeof(document) = 'object'),
  archive_metadata jsonb not null
    check (jsonb_typeof(archive_metadata) = 'object'),
  archive_gzip bytea not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table public.recovery_position_race_recordings
  enable row level security;
revoke all on public.recovery_position_race_recordings
  from public, anon, authenticated;
grant all on public.recovery_position_race_recordings
  to service_role;

create function public.recovery_refuse_position_recording_mutation_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception using errcode='PT409',
    message='The position race recording is immutable.';
end $$;
create trigger recovery_position_recording_immutable_v1
before update or delete on public.recovery_position_race_recordings
for each row execute function
  public.recovery_refuse_position_recording_mutation_v1();
revoke all on function
  public.recovery_refuse_position_recording_mutation_v1()
  from public,anon,authenticated;

create function public.recovery_save_position_race_recording_v1(
  p_event uuid, p_snapshot jsonb, p_entries jsonb,
  p_document jsonb, p_archive_metadata jsonb,
  p_archive_base64 text
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare current_snapshot jsonb; current_entries jsonb;
  previous public.recovery_position_race_recordings;
  saved public.recovery_position_race_recordings;
  expected_seed text;
  archive_bytes bytea;
begin
  archive_bytes := decode(p_archive_base64,'base64');
  perform pg_advisory_xact_lock(73192027);
  select * into previous from public.recovery_position_race_recordings
    where event_id=p_event;
  if found then
    if previous.input_snapshot is distinct from p_snapshot
      or previous.physical_entries is distinct from p_entries
      or previous.document is distinct from p_document
      or previous.archive_metadata is distinct from p_archive_metadata
      or previous.archive_gzip is distinct from archive_bytes then
      raise exception using errcode='PT409',
        message='The position race recording is already committed.';
    end if;
    return jsonb_build_object('event_id',p_event,
      'sha256',previous.document->>'sha256',
      'recorded_at',previous.recorded_at,
      'already_recorded',true);
  end if;
  current_snapshot := public.recovery_race_snapshot(p_event);
  if current_snapshot is distinct from p_snapshot
    or current_snapshot->'event'->>'id' is distinct from
      p_event::text then
    raise exception using errcode='PT409',
      message='The race changed while preparing position data.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(i) - 'committed_at'
    order by i.team_id),'[]'::jsonb) into current_entries
    from public.recovery_physical_entry_inputs i
    where i.event_id=p_event;
  if jsonb_typeof(p_entries) is distinct from 'array'
    or current_entries is distinct from p_entries
    or jsonb_array_length(current_entries) is distinct from
      jsonb_array_length(current_snapshot->'teams') then
    raise exception using errcode='PT409',
      message='Physical team inputs changed or are incomplete.';
  end if;
  expected_seed := coalesce(nullif(
    current_snapshot->'event'->>'seed',''),
    p_event::text || ':recovery-one-day-3');
  if p_document->>'schemaVersion' is distinct from
      'motor-lab-game-position-viewer-document-v1'
    or p_document->'input'->>'eventId' is distinct from
      p_event::text
    or p_document->'input'->>'positionGridVersion' is distinct from
      'motor-lab-abstract-position-grid-1'
    or p_document->'input'->>'officialResults' is distinct from
      'false'
    or p_document->'coverage'->>'officialResults' is distinct from
      'false'
    or p_document->'coverage'->>'fixtureKind' is distinct from
      'committed_game_snapshot'
    or p_document->'source'->>'raceSeed' is distinct from
      expected_seed
    or p_document->>'raceId' is distinct from
      p_document->'feed'->>'raceId'
    or p_document->'feed'->>'synthetic' is distinct from
      'false'
    or coalesce(p_document->>'sha256','') !~ '^[a-f0-9]{64}$'
    or p_document->'feed' ? 'results'
    or (p_archive_metadata->>'version' is distinct from
        'motor-lab-game-position-race-archive-v1'
      and (p_archive_metadata->>'version' is distinct from
          'motor-lab-game-position-race-archive-v2'
        or p_archive_metadata->>'packing' is distinct from
          'contact-topology-index-v1'))
    or p_archive_metadata->>'encoding' is distinct from
      'gzip'
    or p_archive_metadata->>'eventId' is distinct from
      p_event::text
    or p_archive_metadata->>'viewerDocumentSha256' is distinct from
      p_document->>'sha256'
    or coalesce(p_archive_metadata->>'compressedSha256','')
      !~ '^[a-f0-9]{64}$'
    or coalesce(p_archive_metadata->>'uncompressedSha256','')
      !~ '^[a-f0-9]{64}$'
    or p_archive_metadata->>'compressedBytes' is distinct from
      octet_length(archive_bytes)::text then
    raise exception using errcode='PT400',
      message='Invalid or falsely official position recording.';
  end if;
  insert into public.recovery_position_race_recordings(
    event_id,schema_version,input_snapshot,physical_entries,
    document,archive_metadata,archive_gzip)
  values(p_event,'physical-position-recording-v1',
    p_snapshot,p_entries,p_document,p_archive_metadata,archive_bytes)
  returning * into saved;
  return jsonb_build_object('event_id',p_event,
    'sha256',saved.document->>'sha256',
    'recorded_at',saved.recorded_at,
    'already_recorded',false);
end $$;
revoke all on function
  public.recovery_save_position_race_recording_v1(
    uuid,jsonb,jsonb,jsonb,jsonb,text)
  from public,anon,authenticated;
grant execute on function
  public.recovery_save_position_race_recording_v1(
    uuid,jsonb,jsonb,jsonb,jsonb,text)
  to service_role;

-- A clock poll must never transfer the full viewer document or motor archive.
create function public.recovery_position_viewer_broadcast_source_v1(
  p_event uuid
) returns jsonb language sql security invoker
set search_path = '' as $$
  select jsonb_build_object(
    'recorded_at',r.recorded_at,
    'race_id',r.document->>'raceId',
    'duration',r.document->'feed'->'duration',
    'events',coalesce(r.document->'feed'->'events','[]'::jsonb))
  from public.recovery_position_race_recordings r
  where r.event_id=p_event;
$$;
revoke all on function
  public.recovery_position_viewer_broadcast_source_v1(uuid)
  from public,anon,authenticated;
grant execute on function
  public.recovery_position_viewer_broadcast_source_v1(uuid)
  to service_role;
