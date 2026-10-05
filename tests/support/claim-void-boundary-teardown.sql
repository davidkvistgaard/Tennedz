-- Isolated test database only. Remove the temporary lock holder after the probe.
drop function if exists public.recovery_test_hold_boundary_20261005();
