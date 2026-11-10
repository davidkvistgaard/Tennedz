# Motor Lab viewer release gate

Run `pnpm audit:viewer:release` from the Motor Lab worktree. It covers 72
complete paid 120 km races: two distinct seeds, both rider categories, three
route profiles, two chase orders and three attack orders. The command prints
versioned JSON for every case and exits unsuccessfully unless every case
finishes, every same-seed finish matches the guided source, each rider has
an independently resolved finish, and official results are available.
`node scripts/audit-motor-viewer-release.mjs --smoke`
runs one seed with a smaller 20-case matrix for diagnostics.

The current `motor-viewer-release-audit-2` run on 9 November 2026
completed all 72 races and paid all 8,640 rider finishes. Of those,
8,592 riders had a shared exact finish clock and no recorded order within
their group. Every race had at least one unresolved tie. Twenty-four
no-attack races matched the old source finish clocks; all 48 attack races
disagreed. No race had official results. Thus a matching group clock alone
cannot authorize placement or the existing place-based points. The 20-case
smoke run likewise had 2,392 unresolved riders out of 2,400. These counts
come from the motor recorder's exact clock groups, carried through the
versioned viewer adapter. The audit explicitly refuses guided-race
readiness while any such group remains unresolved.

Historical baseline on `d9c25e592464852cec59624d5161da4d77d51ec2` (9 November
2026): **72/72 complete exports, 12/72 calibrated, 60/72 with a same-seed
finish discrepancy, 0/72 with official results**. Both seeds generated
different document hashes and durations. The release gate is red.

| Chase / attack | Cases | Fully calibrated | Finish mismatches per race |
| --- | ---: | ---: | ---: |
| Selective / none | 12 | 12 | 0 |
| Selective / selective | 12 | 0 | 1 |
| Selective / repeated | 12 | 0 | 1 |
| All helpers / none | 12 | 0 | 20–50 |
| All helpers / selective | 12 | 0 | 21–51 |
| All helpers / repeated | 12 | 0 | 21–51 |

In that historical baseline, the largest observed discrepancy was 421.48
seconds. The complete exports
prove that the experimental physical race can pay and replay every rider to
the finish in this matrix. They do **not** establish that its chase timing,
attack outcome, official ranking or general race validity is ready for
guided races. A subsequent versioned leader plan resolved the full-chase
clock differences in the no-attack cases. The remaining source comparison
differs in every attack case; finish order is independently unresolved in
every case. The viewer
still lacks individual lane and wheel positions, canonical geography and
official results. The production viewer cannot be approved from this audit.

In the historical baseline, the 120 km mountain, all-helpers chase had 50 riders finishing on paid rear
roads and 50 same-seed finish discrepancies. The selective chase has no
rear-road finishers and no discrepancy. This points to the physical treatment
of dropped workers as the dominant difference from the guided source. It is
not a reason to erase the paid rear groups or force their times to match a
historical gap claim.

The current official one-day pipeline (`recovery-one-day-3`) still calls
`simulateStage` and stores a version 1 group replay. Its entry snapshot
contains selected riders and a captain, but no submitted tactical timeline.
It cannot yet run the physical Motor Lab decisions from the user's actual
orders. Migrating that pipeline and providing official results remains a
separate release blocker.

The newer, still opt-in positional contracts have separate diagnostics:
`pnpm audit:motor:rotation:diagnose` and
`pnpm audit:motor:attack:diagnose`. The staged-start rotation contract
completed 24/24 no-attack 120 km races with an individually paid finish
for every rider and 24 paid front passes. The one-attack contract completed
48/48 attack-order races with one paid departure and every finish crossing.
All 48 had the same final road count and peloton membership as the older
paid source, while their exact clocks still differed.
These are new motor-owned wheel positions, not positions retrofitted to
the historical recording. The first 48-case attack audit found up to
39.5 seconds of solo finish-clock difference and 1.7 seconds of peloton
front-clock difference against the older paid source. Its completed
races still have no official places, sprint, awarded points, or verified
catch and dropped-worker movement. The position model remains separate
from guided races and the production viewer; successful distance coverage
does not clear the release gate.

Local browser WebGL checks with the deliberately synthetic renderer fixture
showed all 30 or 150 rider rigs for both categories, 51 draw calls and no
renderer errors. Observed status samples after settling were 68 fps for 30
men, 81 fps for 30 women, 47 fps for 150 men and 39–47 fps for 150 women.
The 150-women missing-asset case still rendered at 47 fps and reported one
asset error. These snapshots establish actual WebGL rendering on this local
browser, not a device-wide performance guarantee. The fixture fabricates
spacing solely for load testing and is not Motor Lab position evidence.
