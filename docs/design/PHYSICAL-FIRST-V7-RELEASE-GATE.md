# Experimental position engine V7: release gate

This is the short current-state checklist for `general-race-7`.
It is separate from guided races, historic recordings and the
production viewer. The long design ledger remains in
`PHYSICAL-FIRST-POSITION-MODEL-V1.md`.

| Check | Current evidence | State |
| --- | --- | --- |
| One recorded decision per rider per kilometre, paid contact, energy and line passage | The 72-case matrix of no-attack and selective-attack orders completes and replays on three seeds, both categories, three terrains and two chase orders. Another 12 repeated-attack cases complete and replay. Each has 14,400 decisions, 14,280 intermediate crossings and 120 finishes. | Passed for these 84 inputs |
| Motor-owned positions at a shared time | Start and each kilometre boundary are recorded. V7 adds all-rider quarter-second finale samples. Replay rejects a forged sample. | Passed at recorded times |
| Viewer transport | A replay-verified `pelotonia.viewer.v1` projection validates for the current 120-rider Motor Lab fixture in both categories and synthetic 30/150-rider cases. A separate game-snapshot bridge now accepts committed one-day entrants, orders, sporting stakes, names, bibs and team styles in both categories, generates V7 positions, and seals a versioned document. | Experimental contract passed; no live integration |
| Internal large field | A synthetic 160-rider, 120 km V7 sprint race completes and replays 19,200 decisions, 19,040 intermediate crossings, 160 finishes and 225 complete finale frames. The source group-clock probe refuses missing paid contact at km 120. | Position model passed; source comparison blocked |
| Sporting calibration | 24/36 same-seed cases differ in named front leader, all 36 in attack-choice detail. Maximum final reserve drift is 3.349; maximum old group-clock versus paid-wheel finish drift is 9.674 seconds. | Open: investigate and judge by physical evidence, never copy the old group clock as a wheel |
| Official finish | All 36 selective-attack cases expose unresolved model-clock ties. In a separate flat 120-rider no-attack fixture, both categories have 23 two-rider ties: each pair occupies the same recorded longitudinal distance in different lanes just before the line. These are model positions, not a serialization rounding error. No official placing or awards are produced. | Blocked |
| Full display fidelity | Before the final 300 metres, within-kilometre movement is visual interpolation. Metric lateral coordinates, canonical geography and actual helmets are absent from this Motor Lab fixture. | Open |
| Hosted release | An isolated branch build in `.next-motor-v7` succeeds with 51 generated pages. V7 is not wired to guided races or production, so this build is a regression check, not a V7 browser or GPU approval. | Blocked pending integration and authenticated browser checks |

The full 120-rider recording is much larger than its viewer
projection. Generate and replay it once, persist the versioned
viewer document, and serve that document on later page views.
Recomputing the race in a page request would make the shared
clock and viewer load depend on server execution time.

The exporter marks the fixture synthetic, keeps the full replayed
motor ledger as authority, uses recorded road IDs and event clocks,
and sends no official results. Finish evidence is separate and has
an explicit publication time. Viewer labels derived from recorded
road distances do not add group time gaps or individual positions.
The game-snapshot bridge uses a named, versioned abstract start
grid in the new simulation input; it does not backfill wheels in
historic races. Its document hash protects transport integrity,
while the retained V7 ledger and input hash remain the replay
authority. A read-only loader checks the saved snapshot and
entry rows before and after V7 simulation, refusing a changed
race. Persistence and a hosted viewer route are still missing.

Before considering the guided path or `tennedz.eu`, finish the
varied-order whole-race matrix, explain material source differences,
establish a physical finish classification policy for ties, provide
real visual identity and route data where required, then pass
focused tests, lint, an isolated build, authenticated browser and
WebGL checks for both categories and 30/150 riders. Verify the exact
deployment SHA, READY state, alias, page, JavaScript, runtime and
READY rollback. A failed gate leaves V7 experimental.
