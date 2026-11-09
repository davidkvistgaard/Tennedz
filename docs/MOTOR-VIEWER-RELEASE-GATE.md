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
