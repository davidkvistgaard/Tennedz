-- Preview-only v2 candidate write. A three-division 45-team recording can be
-- larger than 11 MB and exceeded the default PostgREST statement timeout in
-- the isolated test project. Keep the larger budget on this function alone.
-- Production deployment still requires explicit approval and end-to-end proof.
begin;
alter function public.recovery_save_v2_recorded_candidate(uuid,jsonb)
  set statement_timeout = '30s';
commit;
