# Isolated tactics preparation edit

Opted-in two-phase races now have a separate service-only `recovery_edit_revealed_tactics` RPC and `/api/event/tactics` route. The RPC shares the entry/reveal transaction lock and permits only a manager's **existing** entry after its division reveal and before the tactics deadline. It validates eight distinct owned, category-matching, fit riders, a selected captain, and all eight orders. It updates the existing entry without making another receipt or charging coins. Legacy one-deadline races continue through their unchanged join route.

The first migration, `20261005065214_two_phase_tactics_edit.sql`, was followed by `20261005065700_fix_two_phase_team_lookup.sql` after the isolated probe exposed a PostgreSQL `min(uuid)` error. The repair replaces that lookup with a count and a single ID selection. Both migrations were applied **only** to isolated project `nxhvaoonnvmvohqaxfdx`.

`tests/support/two-phase-tactics-probe.sql` passed there with rollback-only writes. It checked legacy and pre-reveal rejection; non-entrant and invalid-order rejection; saving a changed rider, captain and orders without changing team coins; and rejection after tactics close. It left the test event, entry and reveal tables unchanged.

`tests/support/two-phase-distinct-managers-probe.sql` also passed in the isolated database. It used two separately owned existing rosters in one disposable event. Manager A's attempt to save manager B's riders was rejected without changing either entry; both managers then saved different plans to their own entries. The event, reveal and edits were rolled back together. This verifies the database ownership boundary, not separate authenticated browser sessions.

The preview race setup now links to the tactics route after the saved division reveal. A later isolated 45-team run committed actual simulator output after the final tactics lock. A full browser journey with independently authenticated managers and realistic tactical balance remains open. Production Supabase was not changed.
