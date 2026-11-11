# Experimental position engine V7: release gate

This is the short current-state checklist for `general-race-7`.
It is separate from guided races, historic recordings and the
production viewer. The long design ledger remains in
`PHYSICAL-FIRST-POSITION-MODEL-V1.md`.

| Check | Current evidence | State |
| --- | --- | --- |
| One recorded decision per rider per kilometre, paid contact, energy and line passage | The 72-case matrix of no-attack and selective-attack orders completes and replays on three seeds, both categories, three terrains and two chase orders. Another 12 repeated-attack cases on the original seed and 36 repeated-attack cases on three new seeds complete and replay. Each has 14,400 decisions, 14,280 intermediate crossings and 120 finishes. The new 36 also have complete finale frames and no peloton-membership mismatch. | Passed for these 120 inputs |
| Motor-owned positions at a shared time | Start and each kilometre boundary are recorded. V7 adds all-rider quarter-second finale samples. Replay rejects a forged sample. | Passed at recorded times |
| Viewer transport | A replay-verified `pelotonia.viewer.v1` projection validates for the current 120-rider Motor Lab fixture in both categories and synthetic 30/150-rider cases. A separate game-snapshot bridge accepts committed one-day entrants, orders, sporting stakes, names, bibs and team styles in both categories, generates V7 positions, and seals a versioned document. A 120-rider, 120 km game-shaped fixture covers all 14,400 rider-kilometres, 120 finishes and every rider in each frame. | Experimental contract passed; no live integration |
| Internal large field | A synthetic 160-rider, 120 km V7 sprint race completes and replays 19,200 decisions, 19,040 intermediate crossings, 160 finishes and 225 complete finale frames. The source group-clock probe refuses missing paid contact at km 120. | Position model passed; source comparison blocked |
| Mixed attack and sprint orders | A labelled synthetic 12-case matrix keeps the current team's attack stake and assigns sprint stakes to the 14 rival teams, across both categories, three terrains and two chase orders. Source and V7 replay all 12 with full rider coverage, one paid attack departure and 14 paid sprint choices per case; each has recorded sprint passes. | Passed for this selected stake variation; finish ties remain |
| Sporting calibration | 24/36 same-seed cases differ in named front leader. Every attack-choice detail mismatch in those 36 cases involves a rider the source still counts on another road after V7 has recorded that rider over the finish. No mismatch without this condition was found. In the flat men's case the first front-leader difference is a refused, unpayable pass at km 88. Maximum final reserve drift is 3.349; maximum old group-clock versus paid-wheel finish drift is 9.674 seconds. | Open: assess front work and finish by physical evidence, never copy the old group clock as a wheel |
| Official finish | All 36 selective-attack cases and all 36 new-seed repeated-attack cases expose unresolved model-clock ties. In a separate flat 120-rider no-attack fixture, both categories have 23 two-rider ties: each pair occupies the same recorded longitudinal distance in different lanes just before the line. These are model positions, not a serialization rounding error. No official placing or awards are produced. | Blocked |
| Full display fidelity | Before the final 300 metres, within-kilometre movement is visual interpolation. Metric lateral coordinates, canonical geography and actual helmets are absent from this Motor Lab fixture. | Open |
| Local browser inspection | A development-only, flag-gated V7 page renders the 120-rider, 120 km synthetic fixture in WebGL for both categories. At midrace all 120 distinct longitudinal positions render. At time zero 119 riders have recorded negative start-grid distances, which viewer 0.98.2 culls; at the final time all 120 recorded finish coordinates coincide, so the scene overlaps them. The page states both limits and reveals only recorded events at the inspected clock. | Partial; start and finish scene fidelity open, no GPU benchmark |
| Hosted release | An isolated branch build succeeds with 51 generated pages after the V7 inspection page was added. V7 is not wired to guided races or production, so this build is a regression check, not a hosted or authenticated browser approval. | Blocked pending integration and release checks |

The full 120-rider recording is much larger than its viewer
projection. A 120-rider/120 km V7 fixture measured 14,175,640
JSON bytes for the motor ledger and 1,706,991 gzip bytes. The
versioned archive envelope checks its compressed and uncompressed
hashes, event ID, viewer-document hash and full motor replay after
decompression, with a bounded output size. This is a tested local
storage format, not a database or hosted recording yet. Generate
and replay a race once, persist the archive and separate versioned
viewer document, and serve only the document on later page views.
Recomputing the race in a page request would make the shared
clock and viewer load depend on server execution time.

The exporter marks the fixture synthetic, keeps the full replayed
motor ledger as authority, uses recorded road IDs and event clocks,
and sends no official results. Finish evidence is separate and has
an explicit publication time. Viewer labels derived from recorded
road distances do not add group time gaps or individual positions.
The game-snapshot bridge uses a named, versioned abstract start
grid in the new simulation input; it does not backfill wheels in
historic races. Its document hash protects transport integrity.
The separate race-bundle API retains the full V7 input and ledger,
replays them, and checks that they reproduce the sealed viewer
projection, including after a JSON round trip. Both must still be
persisted before a later page view
can use them as replay authority. A
read-only loader checks the saved snapshot and
entry rows before and after V7 simulation, refusing a changed
race. Where an event has no stored seed or locked weather, the
bridge uses the current official engine's deterministic fallback
and records that provenance in the sealed document. Persistence
and a hosted viewer route are still missing.

The development inspection route is intentionally unavailable in
production. It shows the current package's inability to render
negative start-grid distance, and its single finish coordinate for
every rider after crossing. These are display limits, not missing
motor start positions or a reason to invent a new start or finish
order. The motor records lane indices, but no metric lane width;
the adapter therefore does not present lane index as a measured
lateral coordinate. The scene and HUD must not claim an official
result from overlapping finish geometry.

Before considering the guided path or `tennedz.eu`, finish the
varied-order whole-race matrix, explain material source differences,
establish a physical finish classification policy for ties, provide
real visual identity and route data where required, then pass
focused tests, lint, an isolated build, authenticated browser and
WebGL checks for both categories and 30/150 riders. Verify the exact
deployment SHA, READY state, alias, page, JavaScript, runtime and
READY rollback. A failed gate leaves V7 experimental.
