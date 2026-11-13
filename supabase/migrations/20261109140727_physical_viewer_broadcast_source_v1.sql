-- Clock polls must not transfer the full paid recording each time.
create function public.recovery_physical_viewer_broadcast_source_v1(
  p_event uuid
) returns jsonb language sql security invoker
set search_path = '' as $$
  select jsonb_build_object(
    'recorded_at',r.recorded_at,
    'race_id',r.document->>'raceId',
    'duration',r.document->'feed'->'duration',
    'events',coalesce(r.document->'feed'->'events','[]'::jsonb))
  from public.recovery_physical_viewer_recordings r
  where r.event_id=p_event;
$$;
revoke all on function
  public.recovery_physical_viewer_broadcast_source_v1(uuid)
  from public,anon,authenticated;
grant execute on function
  public.recovery_physical_viewer_broadcast_source_v1(uuid)
  to service_role;
