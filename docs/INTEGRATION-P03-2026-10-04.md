# P03 — first isolated 45-team race chain

This is a repeatable test of the **existing one-deadline one-day flow**, not the planned two-phase registration and tactics system. It uses only the allowlisted Supabase project `nxhvaoonnvmvohqaxfdx`, a local production build and disposable accounts. No production database, deployment or live race was changed.

## Verified

- `tests/support/p02-isolated-teams.mjs seed 45` created 45 separately owned teams. `tests/support/p03-multidivision.mjs seed` attached eight distinct male riders to each team and submitted 45 entries through `recovery_join_event_with_orders` with a captain and valid default orders. The isolated database recorded 45 entry-fee receipts, one per team.
- A local production server with game writes enabled **only for the test project** ran the race through `/api/admin/run-event` after the entry deadline. The API returned three divisions of 15 teams. `/api/event/results` returned 15 team and 120 rider results per division. `/api/event-run` returned three persisted replays, each containing exactly the riders and teams in its own result. A second admin call reported `already_finished:true`.
- The database independently confirmed 45 entries, 45 receipts, three division runs, 45 team results, 360 rider results and one race commit. The fixture event and its results, receipts and replay, all 360 added riders, and all 45 added accounts and teams were removed. Counts returned to 11 events, seven teams, 13 historical entries, five historical division runs/commits and zero P03 riders or temporary accounts. Local fixture ledgers were removed.
- The unit simulation additionally checks deterministic output, balanced 15/15/15 grouping for 45 entrants, no duplicated riders or teams, and replay rosters matching the separate division results.

The `seed`, `run`, `cleanup` sequence in `tests/support/p03-multidivision.mjs` requires `PELOTONIA_P03_TEST_CONFIG` to point to an ignored, isolated-project config. `run` also requires `PELOTONIA_P03_AUTH_FIXTURE` for the existing isolated administrator and a local production server at `localhost:3100` with `RECOVERY_ALLOW_GAME_WRITES=true`. Always run the P03 cleanup before the P02 team cleanup. The scripts reject a non-allowlisted Supabase URL and refuse to clean a differently named event. They never read production credentials.

## Still required for P03 and later milestones

- Exercise the registration/calendar and order UI in a focused browser run with multiple real test accounts. This probe used real database entry RPCs and the admin/results/replay HTTP APIs, but did not click through 45 player sessions.
- Verify point-ledger awards after result finalization; the current race updates the older team/rider rating fields, while the new signed sporting-points ledger is not connected yet.
- Implement and test the separate registration deadline, division reveal and later tactics deadline, then replace ability seeding with a frozen earned-points snapshot. That belongs to the later matchmaking milestone; this probe intentionally exercises the current flow.
