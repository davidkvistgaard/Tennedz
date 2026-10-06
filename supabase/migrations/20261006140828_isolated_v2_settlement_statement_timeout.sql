-- Preview-only v2 final write. A saved 45-team contract timed out after
-- nearly 30 seconds with no partial awards. Keep the extended budget on this
-- function alone, below the server's 60-second HTTP timeout.
begin;
alter function public.recovery_settle_v2_one_day(uuid,jsonb,jsonb)
  set statement_timeout = '45s';
commit;
