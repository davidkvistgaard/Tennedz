# Experimental position engine V7: release gate

This is the short current-state checklist for `general-race-7`.
It is separate from guided races, historic recordings and the
production viewer. The long design ledger remains in
`PHYSICAL-FIRST-POSITION-MODEL-V1.md`.

| Check | Current evidence | State |
| --- | --- | --- |
| One recorded decision per rider per kilometre, paid contact, energy and line passage | The 72-case matrix of no-attack and selective-attack orders completes and replays on three seeds, both categories, three terrains and two chase orders. Another 12 repeated-attack cases on the original seed and 36 repeated-attack cases on three new seeds complete and replay. Each has 14,400 decisions, 14,280 intermediate crossings and 120 finishes. The new 36 also have complete finale frames and no peloton-membership mismatch. | Passed for these 120 inputs |
| Motor-owned positions at a shared time | Start and each kilometre boundary are recorded. V7 adds all-rider quarter-second finale samples. Replay rejects a forged sample. | Passed at recorded times |
| Viewer transport | A replay-verified `pelotonia.viewer.v1` projection validates for the current 120-rider Motor Lab fixture in both categories and synthetic 30/150-rider cases. The new V3 adapter bounds the display feed using only recorded finale frames, including the first recorded sample at or after every rider's finish clock; V1/V2 exports remain readable. The game-snapshot bridge accepts committed one-day entrants, orders, sporting stakes, names, bibs and team styles in both categories, generates V7 positions, and seals a versioned document. A 120-rider, 120 km game-shaped fixture covers all 14,400 rider-kilometres, 120 finishes and every rider in each frame. An immutable experimental recording schema and admin-only, flag-gated recording and clock routes have local SQL and authenticated browser tests. | Experimental local integration passed; live database and hosted runtime unverified |
| Internal large field | A synthetic 160-rider, 120 km V7 sprint race completes and replays 19,200 decisions, 19,040 intermediate crossings, 160 finishes and 225 complete finale frames. The source group-clock probe refuses missing paid contact at km 120. | Position model passed; source comparison blocked |
| Mixed attack and sprint orders | A labelled synthetic 12-case matrix keeps the current team's attack stake and assigns sprint stakes to the 14 rival teams, across both categories, three terrains and two chase orders. Source and V7 replay all 12 with full rider coverage, one paid attack departure and 14 paid sprint choices per case; each has recorded sprint passes. | Passed for this selected stake variation; finish ties remain |
| Mixed 150-rider transport stress | Two synthetic seeds per category, each 150 riders and 120 km with attack and sprint stakes, completed and replayed 18,000 decisions, 17,850 intermediate crossings and 150 finishes. Seed 1 recorded 16/17 paid contacts (men/women), 2,234/2,231 finale frames and 25,330,730/25,276,738 raw finale-projection bytes. V3 kept every finish milestone with 149 displayed finale frames and 3,266,708/3,263,925-byte complete viewer projections. Seed 2 recorded 307/16 contacts, 2,231/2,231 finale frames and 3,316,230/3,325,309-byte projections, with 153/154 displayed finale frames. The full motor records remain separate; seed 2 request plus race measured 50,341,845/49,363,156 JSON bytes. All four races still have 12/25/27/32 finish-tie groups. | Both synthetic categories and two seeds passed; official finish and hosted runtime open |
| Sporting calibration | 24/36 same-seed cases differ in named front leader. Every attack-choice detail mismatch in those 36 cases involves a rider the source still counts on another road after V7 has recorded that rider over the finish. No mismatch without this condition was found. In the flat men's case the first front-leader difference is a refused, unpayable pass at km 88. Maximum final reserve drift is 3.349; maximum old group-clock versus paid-wheel finish drift is 9.674 seconds. | Open: assess front work and finish by physical evidence, never copy the old group clock as a wheel |
| Official finish | All 36 selective-attack cases and all 36 new-seed repeated-attack cases expose unresolved model-clock ties. In a separate flat 120-rider no-attack fixture, both categories have 23 two-rider ties: each pair occupies the same recorded longitudinal distance in different lanes just before the line. A controlled 120 km, 120-rider strength probe on three seeds found 13, 0 and 28 tie groups with the fixture's identical rider ratings; after a small, explicitly synthetic per-rider rating variation, it found 0, 0 and 0. A second control uses the actual game starter sporting profiles in synthetic 120-rider events, with sprint stakes for all teams: three seeds in each category completed and replayed 14,400 decisions and 120 finishes per race, with zero ties in all six. This is not a saved game roster or a varied-order release matrix. Ties depend on input and seed, and none is silently ordered. No official placing or awards are produced. | Blocked pending real roster validation and a non-invented tie policy |
| Full display fidelity | Before the final 300 metres, within-kilometre movement is visual interpolation. Metric lateral coordinates, canonical geography and actual helmets are absent from this Motor Lab fixture. | Open |
| Local browser inspection | The development inspection page renders the 120-rider, 120 km synthetic fixture in WebGL for both categories; all 120 distinct midrace positions render. A separate authenticated local recording flow starts with no saved document, then runs the actual POST simulation and save for 16 men, 16 women, 120 men and 120 women on a 20 km committed-shape fixture. The published replays rendered in WebGL and displayed measured, unofficial finish crossings, which stayed visible across replay cycles. The women's unpublished replay showed no race feed or finish and its document endpoint returned 425. At time zero 119 of the 120-rider, 120 km fixture have recorded negative start-grid distances, which viewer 0.98.2 culls; at the final time all 120 recorded finish coordinates coincide, so the scene overlaps them. | Local flows passed; start and finish scene fidelity and hardware GPU benchmark open |
| Hosted release | An isolated branch build succeeds with 53 generated pages including the flag-gated recording, clock and viewer routes. The local recording test uses a fixture database, not the hosted Supabase project. The migration has not been applied to production. V7 is not wired to guided races or production. | Blocked pending hosted integration and release checks |

The full 120-rider recording is much larger than its viewer
projection. A 120-rider/120 km V7 fixture measured 14,175,640
JSON bytes for the motor ledger and 1,706,991 gzip bytes. The
versioned archive envelope checks its compressed and uncompressed
hashes, event ID, viewer-document hash and full motor replay after
decompression, with a bounded output size. A separate, immutable
experimental table can store that archive and the versioned viewer
document. Its local PGlite tests cover privacy, immutability,
current-entry checks, base64-to-bytea storage and the small clock
response. The hosted database and runtime remain unverified. Generate
and replay a race once, persist the archive and separate versioned
viewer document, and serve only the document on later page views.
The recording route rereads the committed snapshot and entries after
simulation to reject a changed race. A local 120-rider recording exposed
a closed idle mock-database connection during that final verification;
the route retries a failed read once. The save itself is never retried.
Recomputing the race in a page request would make the shared
clock and viewer load depend on server execution time.

The exporter marks the fixture synthetic, keeps the full replayed
motor ledger as authority, uses recorded road IDs and event clocks,
and sends no official results. Finish evidence is separate and has
an explicit publication time. Viewer labels derived from recorded
road distances do not add group time gaps or individual positions.
The V3 viewer transport samples recorded finale frames under a
3,500,000-byte feed budget and refuses a complete document over
4,200,000 bytes. It always includes the first recorded
frame at or after every finish crossing, plus start and final frames;
optional samples are reduced if needed. Its coverage identifies the
number of recorded and displayed finale frames and marks sampling
explicitly. Between displayed frames, the viewer interpolates;
the separate finish evidence keeps exact motor clocks. A recorded
quarter-second frame can be up to one sampling interval after an
exact crossing. No display sample is a new motor position. If the
mandatory frames alone exceed the budget, export refuses rather than
silently dropping a finish milestone. Historic V1/V2 adapter behavior
and document verification remain available.
The game-snapshot bridge uses a named, versioned abstract start
grid in the new simulation input; it does not backfill wheels in
historic races. Its document hash protects transport integrity.
The separate race-bundle API retains the full V7 input and ledger,
replays them, and checks that they reproduce the sealed viewer
projection, including after a JSON round trip. The experimental
recording endpoint persists both through the versioned save function;
the protected viewer request uses only the saved projection. A
read-only loader checks the saved snapshot and
entry rows before and after V7 simulation, refusing a changed
race. Where an event has no stored seed or locked weather, the
bridge uses the current official engine's deterministic fallback
and records that provenance in the sealed document. The new viewer
route and database migration have only local verification. The
recording endpoint has not been measured on a hosted full-size race.

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
