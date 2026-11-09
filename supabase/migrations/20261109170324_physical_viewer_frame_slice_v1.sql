-- Stream only paid checkpoints already reached by the shared recording clock.
-- The database enforces the time bound even if a caller requests the finish.
create function public.recovery_physical_viewer_frame_slice_v1(
  p_event uuid, p_after double precision, p_elapsed double precision
) returns jsonb language sql volatile security invoker
set search_path = '' as $$
  with recording as (
    select r.document, r.recorded_at,
      (r.document->'feed'->>'duration')::double precision as duration
    from public.recovery_physical_viewer_recordings r
    where r.event_id=p_event
  ), clock as (
    select document, duration,
      ceil(extract(epoch from recorded_at)*1000+
        duration*1000/60)::double precision as publication_ms,
      extract(epoch from clock_timestamp())*1000 as now_ms
    from recording
  ), cycle as (
    select document, duration,
      case when now_ms<publication_ms then 0::double precision
      else least(duration,greatest(0::double precision,
        (now_ms-publication_ms-
          floor((now_ms-publication_ms)/
            (ceil(duration/60)*1000+15000))*
            (ceil(duration/60)*1000+15000))*60/1000)) end
        as server_elapsed
    from clock
  ), slice as (
    select cycle.document, cycle.duration, reached.frames
    from cycle
    cross join lateral (
      select coalesce(jsonb_agg(f.frame order by f.ordinality),
        '[]'::jsonb) as frames
      from jsonb_array_elements(
        coalesce(cycle.document->'feed'->'frames','[]'::jsonb))
        with ordinality as f(frame,ordinality)
      where (f.frame->>'time')::double precision>p_after
        and (f.frame->>'time')::double precision<=
          least(p_elapsed,cycle.server_elapsed)
    ) reached
  )
  select jsonb_build_object(
    'raceId',document->>'raceId',
    'sha256',document->>'sha256',
    'frames',frames,
    'availableThrough',coalesce((frames->-1->>'time')::double precision,
      p_after))
  from slice
  where p_after>=0 and p_after<=duration
    and p_elapsed>=0 and p_elapsed<=duration
    and p_after<=p_elapsed;
$$;
revoke all on function
  public.recovery_physical_viewer_frame_slice_v1(
    uuid,double precision,double precision)
  from public,anon,authenticated;
grant execute on function
  public.recovery_physical_viewer_frame_slice_v1(
    uuid,double precision,double precision)
  to service_role;
