# P01 — calendar and engine integration

The calendar/autopilot/rankings branch and the Motor Lab branch are combined on `codex/p01-calendar-engine-integration`. This is an isolated source integration, not a production release. The existing one-day race remains the official runner; Motor Lab and Race Lab remain separate laboratories.

## Conflict decisions

- Kept the current Motor Lab replay, v2 kilometre engine, atlas baseline, logo and team design. Older copies of those files from the calendar branch did not replace them. World data beyond the existing baseline is still handled under P21.
- Brought in the guarded calendar creator, default squads, autopilot queue and endpoints, ranked points ledger migration, scheduled race cards and pre-race orders. New SQL is present as files only; no migration or cron was enabled against a database.
- The old one-day runner now reads validated saved orders through its existing snapshot and applies their first tactical effects. The signup-to-result browser journey still exercises that runner, including a saved order, the deadline lock, replay and results.
- Preserved the existing ability rating RPC as a separate ranking view. The new sporting points view reads the ledger; ability ratings are never presented as earned race points.
- Preserved the `result_place` column in the pending ledger migration. The other checkout has an uncommitted correction for that same column; this integration does not alter that checkout.
- Added navigation to default teams while retaining Motor Lab, Staff and the vector brand mark.

## Local verification

- 273 unit tests pass.
- Repository ESLint and a clean Next.js production build pass.
- All 46 isolated browser tests pass in two shards, including mobile and desktop signup → lineup/orders → lock → replay → result, Motor Lab, atlas, calendar, rankings, auth and write-gate checks. Browser tests use a local protocol fixture, not a Supabase database.
- `git diff --check` passes after resolution.

## What P01 does not prove

The pending SQL migrations have not been applied to an isolated database. They must be verified in order, together with database permissions, concurrent entries, cron leases, retries and real capacity under P02. A clean build and browser fixture cannot prove SQL behavior. No new official race is scheduled, no sporting points are awarded, and no production or preview deployment is part of this integration.
