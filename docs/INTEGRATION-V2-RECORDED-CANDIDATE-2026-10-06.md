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
existing viewer, alter rider state, or award ranking points. A future final
transaction must recheck the saved candidate and settle results and points
exactly once. Sporting balance and the full independent-manager end-to-end
path remain open. Production Supabase and deployment were untouched.
