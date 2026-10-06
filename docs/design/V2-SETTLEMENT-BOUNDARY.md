# V2 one-day settlement boundary

Status: design for the isolated preview path. No final v2 result or point write exists yet.

The current preview stores one immutable tactics lock and one versioned recording candidate, split into a header and one row per division. `loadV2SettlementReadiness` reads those rows, resimulates the race from the saved lock, validates the recording, results and awards, derives ledger-shaped point rows, and rejects an occupied or premature event. Its HTTP reads are not atomic. The isolated 45-manager probe reached three recorded divisions, 45 private viewers and 60 projected point rows, with zero persisted awards.

## Why the legacy finish transaction is not a v2 shortcut

`recovery_finish_race` expects the old `teams`/`results` payload and replay version 1. Its transaction changes team and rider ratings, form, fatigue and injury state, then inserts `recovery_race_commits`. The two-phase guard requires that commit's input snapshot to equal the **legacy** tactics lock. The ranking trigger then derives points from legacy rider-result rows. The v2 recording is version 2 and has its own captain times, rider placings and award contract; it does not yet define a persistent post-race form/fatigue/injury update. Converting it to the old payload would silently invent sporting effects and risk awarding points twice.

## Proposed isolated transaction

1. Keep the existing candidate as the canonical v2 replay and result. Add one `recovery_v2_settlements` row keyed by event ID as the final marker, linked to the candidate. Do not copy version 2 replay into the version 1 `event_division_runs.replay` column or insert a legacy race commit.
2. The server performs the read-only preflight and sends the exact expected ledger rows and candidate identity to a service-role-only RPC. The RPC takes the existing advisory lock and locks the event row, then rereads the v2 tactics lock, saved candidate header and every division row in the **same transaction**. It rejects a changed candidate, missing division, premature deadline, non-`OPEN` event, mismatched gender/tier/reveal, any legacy result/commit or existing ranking award, and an incomplete ledger. Candidate storage currently grants service-role `SELECT` and `INSERT`, not `UPDATE` or `DELETE`; preserve that immutability.
3. The RPC compares each proposed award to the saved division's award array, including event, team, rider, placing, tier, multiplier-derived points, policy version and unique award key. It checks the saved divisions cover the reveal exactly once and that rider results cover each eight-rider lineup. The server's engine recomputation remains necessary: SQL can verify the frozen contract and exact awards, but cannot validate v2 physics.
4. Insert all positive `recovery_ranking_awards` rows, change the event to `FINISHED`, and insert the v2 settlement marker in one transaction. On a retry, return the prior summary only if its candidate identity and award set still match; any conflicting legacy or v2 state requires manual review. A failed check rolls back every write.
5. Make the private v2 viewer and calendar/history/results readers treat the settlement marker as the final state and read the existing division recording/result contract. The provisional banner must disappear only after the marker exists. The existing v1 viewer, results and historical races keep their present path.

The transaction must make an explicit sporting decision about rider form, fatigue, injury and team/rider **legacy ratings** before activation. The v2 trace currently provides race energy, not the durable post-race values expected by the legacy finish function. For a first isolated settlement proof, leave those legacy fields unchanged and award only the exact v2 sporting points; document that rule in the UI before players can enter a v2 race. Do not infer updates from the old engine.

## Acceptance checks before activation

- Fresh isolated database migration and rollback test; no production migration or live data change.
- Two independent managers and a 45-manager/three-division race: registration, reveal, locked plans, recorded viewer, final viewer, result/history and exactly 16/60 point awards respectively.
- Concurrent settlement calls produce one marker and one award set; repeated calls return the same result. A stale lock/candidate, altered point, missing division, foreign rider, premature event, legacy row or prior award fails without partial writes.
- Ranked totals equal the new ledger rows; men and women remain separate. Existing legacy race/point tests, lint, clean build and focused browser checks still pass.
- Measure the 45-manager recording and settlement paths under the intended preview runtime. A local provisional save took 28.7 seconds before, and 25.0 seconds after, removing a redundant simulation; this is not a deployment capacity guarantee.
