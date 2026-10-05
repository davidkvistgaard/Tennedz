# Recorded replay roster matches its division results

Migration `20261005104848_verify_two_phase_replay_rosters.sql` adds a commit-time check for opted-in two-phase races. Every saved replay must contain exactly the riders and team IDs in that division's result rows, once each. A foreign team or duplicate rider rejects the entire race finish transaction, including rankings and rating changes. Legacy one-deadline races keep their existing commit path.

The migration was applied **only** to isolated Supabase project `nxhvaoonnvmvohqaxfdx`. The rollback-only `tests/support/two-phase-finish-probe.sql` rejected both a foreign team and duplicate replay rider, verified that rejected attempts left no result rows, then committed a correct 16-rider replay and confirmed idempotent retry. The 45-team probe still committed three synthetic 120-rider replays with 45 team results, 360 rider results and 60 ranking awards in its rollback transaction. Follow-up counts found zero two-phase events, reveals and tactics locks. Security and performance advisors showed the previously known private-table RLS and legacy index notices; the new trigger introduces no table or foreign key.

The 45-team probe also replaced one division's recorded rider with a rider from another division. The finish transaction rejected the mismatched replay and left no result or point rows; its subsequent correct three-division finish still passed.

This verifies the database boundary for recorded rosters. It does not substitute for a full two-phase run with 45 separately authenticated managers, real JavaScript output written to the database, or sports-balance review. Production data and deployment were untouched.
