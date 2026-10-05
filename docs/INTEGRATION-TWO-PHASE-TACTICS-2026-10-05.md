# Isolated tactics preparation edit

Opted-in two-phase races now have a separate service-only `recovery_edit_revealed_tactics` RPC and `/api/event/tactics` route. The RPC shares the entry/reveal transaction lock and permits only a manager's **existing** entry after its division reveal and before the tactics deadline. It validates eight distinct owned, category-matching, fit riders, a selected captain, and all eight orders. It updates the existing entry without making another receipt or charging coins. Legacy one-deadline races continue through their unchanged join route.

The first migration, `20261005065214_two_phase_tactics_edit.sql`, was followed by `20261005065700_fix_two_phase_team_lookup.sql` after the isolated probe exposed a PostgreSQL `min(uuid)` error. The repair replaces that lookup with a count and a single ID selection. Both migrations were applied **only** to isolated project `nxhvaoonnvmvohqaxfdx`.

`tests/support/two-phase-tactics-probe.sql` passed there with rollback-only writes. It checked legacy and pre-reveal rejection; non-entrant and invalid-order rejection; saving a changed rider, captain and orders without changing team coins; and rejection after tactics close. It left the test event, entry and reveal tables unchanged.

The new route is not linked from the game UI. No opt-in events exist in production, and the existing two-phase result guard still blocks race commits. Next work is a persisted final tactics lock and a participant view of their division and public opponents. Production Supabase was not changed.
