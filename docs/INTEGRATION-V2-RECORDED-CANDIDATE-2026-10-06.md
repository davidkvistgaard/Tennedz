# Isolated v2 recorded candidate

The private `recovery_v2_recorded_candidates` table stores one versioned
recording/result/award contract per event, keyed to the separate immutable v2
tactics lock. `recovery_save_v2_recorded_candidate` accepts only the service
role, checks race identity, tier, saved division reveal and eligible phase,
then rejects a changed retry. It returns metadata without the private JSON.
The server first recalculates and validates the contract against the saved
manager lock, including its weather, orders and exact simulation output.
The `PELOTONIA_V2_RECORDING_ENABLED` flag defaults to false.

The migration was applied only to isolated Supabase project
`nxhvaoonnvmvohqaxfdx`. The rollback-only
`tests/support/v2-recorded-candidate-probe.sql` checked private grants,
wrong-tier rejection, exact retry, changed-retry rejection and absence of
legacy result and ranking writes; zero candidate rows remained afterward.
A local production build and browser fixture used two entered managers and
an outsider: the first manager recorded once, the second saw the same receipt,
the outsider was rejected, and neither manager received rival orders or the
contract in the API response. The fixture's database is simulated; this is
not a joined browser-to-isolated-Supabase proof.

The stored JSON is provisional. It does not finish the event, populate the
existing live viewer, alter rider state, or award ranking points. A separate
flagged `/team/v2-race/[event_id]` page can read the candidate through an
authenticated API. The API validates the full stored contract, selects the
manager's saved division, and removes rivals' orders, skills and energy from
its browser payload. The page identifies the replay and points as provisional
and keeps the team selector on the manager's team. A 45-team unit check covers
division filtering and redaction; the local two-manager browser fixture covers
the private page and outsider rejection. The pre-existing synthetic viewer
passed its desktop and 390 px mobile browser probe after this change. The
private page was also visually checked at desktop and 390 px mobile widths.

The isolated project now has an atomic v2 one-day settlement migration. A
separately gated `/api/event/v2-recording/settle` route accepts an entered
manager, reloads and independently re-simulates the saved candidate from the
immutable tactics lock, then asks the database to recheck the stored contract,
revealed divisions, entered riders, schedule and exact points under its lock.
The response contains only the settlement receipt. The private viewer checks
the settlement marker, event status and awarded rows before replacing
"projected" points with final ranking points. `PELOTONIA_V2_SETTLEMENT_ENABLED`
defaults to false and has not been enabled for the preview deployment.

A rollback-only SQL probe in isolated Supabase showed one 16-rider synthetic
settlement, an exact idempotent retry and rejection of changed points and
schedule without partial writes. A local browser protocol fixture exercised
two managers in separate divisions, final viewer state on desktop and 390 px
mobile, retry and outsider rejection, with the settlement flag both on and off.
The browser fixture simulates the database. A real motor-generated recording
has **not yet** been finally settled through the HTTP route in isolated
Supabase. Sporting balance, automatic scheduled finalisation and the full
independent-manager end-to-end path remain open. Production Supabase and
deployment were untouched.
