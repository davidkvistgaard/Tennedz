-- Isolated test database only. Apply as a temporary migration before running
-- claim-void-boundary-real.mjs, then apply claim-void-boundary-teardown.sql.
create function public.recovery_test_hold_boundary_20261005() returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(73192026);
  perform pg_catalog.pg_sleep(3);
end;
$$;
revoke all on function public.recovery_test_hold_boundary_20261005()
  from public, anon, authenticated;
grant execute on function public.recovery_test_hold_boundary_20261005() to service_role;
