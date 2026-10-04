# P02 — isolated calendar and autopilot database verification

The `pelotonia-recovery-auth-test` Supabase project is separate from production. Its migration history already contained the calendar, orders, ranking ledger, scheduled calendar creator and autopilot queue migrations. No production database or Vercel deployment was changed during this check.

## Verified on the isolated project

- `tests/integration/orders.sql`: saved orders, one entry fee, invalid input, snapshot capture and deadline enforcement pass inside a rolled-back transaction.
- `tests/integration/autopilot-entry.sql`: an existing manual entry and its orders are retained; a second same-gender race on the same UTC date is skipped. It passes with session time zones `Pacific/Auckland` and `America/Los_Angeles`; fixture changes roll back.
- `tests/integration/autopilot-queue.sql`: one lease holder, rejection of a wrong or stale token, expired-lease retry, completion and later rescan pass; fixture changes roll back.
- `tests/integration/autopilot-permissions.sql`: new service-only tables have RLS, client roles cannot read or insert into them, and client roles cannot execute the six new privileged RPCs.
- `tests/integration/autopilot-queue-capacity.sql`: 50 synthetic race jobs were claimed and completed once in a single database pass; fixture changes roll back. This measures database queue behavior only, not the throughput of the HTTP scheduler and per-team entry calls.
- Two concurrent database calls submitted manual and autopilot orders to one disposable race. The final state had one entry, one receipt and the manual `captain` plan. The disposable race and its entry/receipt were removed. Post-test counts returned to 11 events, 7 teams, 13 entries, 0 queue jobs and 0 P02 fixtures.

The first real autopilot entry check exposed `min(uuid)` in the SQL function, which PostgreSQL does not provide. The isolated project received the corrective `20261004173440_fix_autopilot_uuid_team_lookup` migration; the same migration is committed in this branch. The entry tests pass after the correction. The historical migration remains untouched so that migration history stays additive.

Supabase security advisors report RLS without policies for the service-only tables, consistent with the intentional client revocations. Performance advisors also flag unindexed foreign keys on the new default-lineup captain and ranking-award event columns. Those indexes should be considered before broad scale, alongside the existing database's other index findings. [RLS advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [foreign-key index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

## Still open in P02

- Replay the full migration chain against a fresh empty test database; the available test project already had the earlier migrations when this check began.
- Exercise the enabled cron HTTP route, service credentials and complete multi-page team batches against an isolated application deployment. A 50-event database queue pass cannot establish how many teams the 35-second request window processes.
- Measure concurrent manager/autopilot writes across repeated schedules and a larger team population, and verify deadline coverage and retry behavior under realistic latency. One concurrent fixture demonstrates the locking and manual-priority path but is not a load test.

Keep `PELOTONIA_AUTOPILOT_ENABLED` off until these remaining checks and the later product decisions about simultaneous races and rider availability are complete. No new official race or points award was created.
