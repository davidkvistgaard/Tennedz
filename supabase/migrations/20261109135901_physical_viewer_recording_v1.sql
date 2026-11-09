-- Experimental physical race evidence is immutable once recorded. The
-- official recovery cycle and its historic result tables remain separate.
create table public.recovery_physical_viewer_recordings (
  event_id uuid primary key references public.events(id),
  schema_version text not null
    check (schema_version = 'physical-viewer-recording-v1'),
  input_snapshot jsonb not null
    check (jsonb_typeof(input_snapshot) = 'object'),
  physical_entries jsonb not null
    check (jsonb_typeof(physical_entries) = 'array'),
  document jsonb not null
    check (jsonb_typeof(document) = 'object'),
  recorded_at timestamptz not null default clock_timestamp()
);
alter table public.recovery_physical_viewer_recordings
  enable row level security;
revoke all on public.recovery_physical_viewer_recordings
  from public, anon, authenticated;
grant all on public.recovery_physical_viewer_recordings
  to service_role;

create function public.recovery_save_physical_viewer_recording_v1(
  p_event uuid, p_snapshot jsonb, p_entries jsonb, p_document jsonb
) returns jsonb language plpgsql security invoker
set search_path = '' as $$
declare current_snapshot jsonb; current_entries jsonb;
  previous public.recovery_physical_viewer_recordings;
  saved public.recovery_physical_viewer_recordings;
  expected_seed text;
begin
  perform pg_advisory_xact_lock(73192026);
  select * into previous from public.recovery_physical_viewer_recordings
    where event_id=p_event;
  if found then
    if previous.input_snapshot is distinct from p_snapshot
      or previous.physical_entries is distinct from p_entries
      or previous.document is distinct from p_document then
      raise exception using errcode='PT409',
        message='The physical viewer recording is already committed.';
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
      message='The race changed while preparing viewer data.';
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
  if coalesce(p_document->>'schemaVersion','') not in (
      'motor-lab-viewer-document-v2',
      'motor-lab-viewer-document-v3')
    or p_document->'input'->>'eventId' is distinct from
      p_event::text
    or p_document->'input'->>'officialResults' is distinct from
      'false'
    or p_document->'coverage'->>'officialResults' is distinct from
      'false'
    or p_document->'source'->>'raceSeed' is distinct from
      expected_seed
    or p_document->>'raceId' is distinct from
      p_document->'feed'->>'raceId'
    or coalesce(p_document->>'sha256','') !~ '^[a-f0-9]{64}$'
    or p_document->'feed' ? 'results' then
    raise exception using errcode='PT400',
      message='Invalid or falsely official physical viewer document.';
  end if;
  insert into public.recovery_physical_viewer_recordings(
    event_id,schema_version,input_snapshot,physical_entries,document)
  values(p_event,'physical-viewer-recording-v1',
    p_snapshot,p_entries,p_document)
  returning * into saved;
  return jsonb_build_object('event_id',p_event,
    'sha256',saved.document->>'sha256',
    'recorded_at',saved.recorded_at,
    'already_recorded',false);
end $$;
revoke all on function
  public.recovery_save_physical_viewer_recording_v1(
    uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function
  public.recovery_save_physical_viewer_recording_v1(
    uuid,jsonb,jsonb,jsonb) to service_role;
