# Motor Lab viewer release gate

Run `pnpm audit:viewer:release` from the Motor Lab worktree. It covers 72
complete paid 120 km races: two distinct seeds, both rider categories, three
route profiles, two chase orders and three attack orders. The command prints
versioned JSON for every case and exits unsuccessfully unless every case
finishes, every same-seed finish matches the guided source, and official
results are available. `node scripts/audit-motor-viewer-release.mjs --smoke`
runs one seed with a smaller 20-case matrix for diagnostics.

Baseline on `d9c25e592464852cec59624d5161da4d77d51ec2` (9 November
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

The largest observed discrepancy was 421.48 seconds. The complete exports
prove that the experimental physical race can pay and replay every rider to
the finish in this matrix. They do **not** establish that its chase timing,
attack outcome, official ranking or general race validity is ready for
guided races. The next motor work should address the full-chase difference
first, then the one-rider attack difference, and rerun both seeds. The viewer
still lacks individual lane and wheel positions, canonical geography and
official results. The production viewer cannot be approved from this audit.

The 120 km mountain, all-helpers chase has 50 riders finishing on paid rear
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

Local browser WebGL checks with the deliberately synthetic renderer fixture
showed all 30 or 150 rider rigs for both categories, 51 draw calls and no
renderer errors. Observed status samples after settling were 68 fps for 30
men, 81 fps for 30 women, 47 fps for 150 men and 39–47 fps for 150 women.
The 150-women missing-asset case still rendered at 47 fps and reported one
asset error. These snapshots establish actual WebGL rendering on this local
browser, not a device-wide performance guarantee. The fixture fabricates
spacing solely for load testing and is not Motor Lab position evidence.
