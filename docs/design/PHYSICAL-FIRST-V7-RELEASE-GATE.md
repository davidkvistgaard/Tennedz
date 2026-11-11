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
| Internal large field | A synthetic 160-rider, 120 km V7 sprint race completes and replays 19,200 decisions, 19,040 intermediate crossings, 160 finishes and 225 complete finale frames. The source group-clock probe refuses missing paid contact at km 120. The current viewer contract accepts at most 150 riders, so this internal motor control is not a viewer transport control. | Position model passed; source comparison blocked |
| Mixed attack and sprint orders | A labelled synthetic 12-case matrix keeps the current team's attack stake and assigns sprint stakes to the 14 rival teams, across both categories, three terrains and two chase orders. Source and V7 replay all 12 with full rider coverage, one paid attack departure and 14 paid sprint choices per case; each has recorded sprint passes. | Passed for this selected stake variation; finish ties remain |
| Attempted attack without physical departure | A synthetic 120-rider game-starter-profile selective-attack control previously stopped at km 1 after a chosen attack could not separate. V7 now checks the actual paid runway even in a clear own lane, records `insufficient_paid_attack_runway` and keeps the rider with the bunch. Two seeds in each category now complete and replay 14,400 decisions and 120 finishes per race, with zero departures and zero ties. A focused 16-rider regression reproduces the refusal; 30 related position tests pass, including paid successful departures. After the change, 12 same-seed selective-attack Motor Lab cases and two different-seed repeated-attack mountain cases also complete with full decision, checkpoint, finish and finale-frame coverage. The 12 selective cases still show eight front-leader differences and unresolved finish ties in every case. | Passed for these controls; varied real rosters and official finish remain open |
| Mixed 150-rider transport stress | Two synthetic seeds per category, each 150 riders and 120 km with attack and sprint stakes, completed and replayed 18,000 decisions, 17,850 intermediate crossings and 150 finishes. Seed 1 recorded 16/17 paid contacts (men/women), 2,234/2,231 finale frames and 25,330,730/25,276,738 raw finale-projection bytes. V3 kept every finish milestone with 149 displayed finale frames and 3,266,708/3,263,925-byte complete viewer projections. Seed 2 recorded 307/16 contacts, 2,231/2,231 finale frames and 3,316,230/3,325,309-byte projections, with 153/154 displayed finale frames. The full motor records remain separate; seed 2 request plus race measured 50,341,845/49,363,156 JSON bytes. All four races still have 12/25/27/32 finish-tie groups. | Both synthetic categories and two seeds passed; official finish and hosted runtime open |
| Sporting calibration | 24/36 same-seed cases differ in named front leader. Every attack-choice detail mismatch in those 36 cases involves a rider the source still counts on another road after V7 has recorded that rider over the finish. No mismatch without this condition was found. In the flat men's case the first front-leader difference is a refused, unpayable pass at km 88. Maximum final reserve drift is 3.349; maximum old group-clock versus paid-wheel finish drift is 9.674 seconds. | Open: assess front work and finish by physical evidence, never copy the old group clock as a wheel |
| Official finish | All 36 selective-attack cases and all 36 new-seed repeated-attack cases expose unresolved model-clock ties. In a separate flat 120-rider no-attack fixture, both categories have 23 two-rider ties: each pair occupies the same recorded longitudinal distance in different lanes just before the line. A controlled 120 km, 120-rider strength probe on three seeds found 13, 0 and 28 tie groups with the fixture's identical rider ratings; after a small, explicitly synthetic per-rider rating variation, it found 0, 0 and 0. A second control uses actual game starter sporting profiles in synthetic 120-rider events, with sprint stakes for all teams. The first six runs had zero ties, but that fixture inadvertently retained a synthetic attacker's acceleration and positioning bonus. After removing those bonuses, the first two seeds in each category still had zero ties. These are not saved game rosters or a varied-order release matrix. Ties depend on input and seed, and none is silently ordered. No official placing or awards are produced. | Blocked pending real roster validation and a non-invented tie policy |
| Full display fidelity | Before the final 300 metres, within-kilometre movement is visual interpolation. Metric lateral coordinates, canonical geography and actual helmets are absent from this Motor Lab fixture. | Open |
| Local browser inspection | The development inspection page renders the 120-rider, 120 km synthetic fixture in WebGL for both categories; all 120 distinct midrace positions render. A separate authenticated local recording flow starts with no saved document, then runs the actual POST simulation and save for 16 men, 16 women, 120 men and 120 women on a 20 km committed-shape fixture. The published replays rendered in WebGL and displayed measured, unofficial finish crossings, which stayed visible across replay cycles. The women's unpublished replay showed no race feed or finish and its document endpoint returned 425. At time zero 119 of the 120-rider, 120 km fixture have recorded negative start-grid distances, which viewer 0.98.2 culls; at the final time all 120 recorded finish coordinates coincide, so the scene overlaps them. | Local flows passed; start and finish scene fidelity and hardware GPU benchmark open |
| Hosted release | The full local suite passes 1,008/1,008 after the own-lane attack-runway fix. Lint, an isolated branch build with 53 generated pages, and four authenticated local browser flows (16 men published, 16 women waiting, 120 men and women published) pass on the same code. A read-only check of the active Tennedz Supabase project on 2026-11-11 found one team, 16 riders, zero event-team entries, zero saved race snapshots, zero race commits, and no November 2026 V7 migrations. The local recording test uses a fixture database, not that hosted project. V7 is not wired to guided races or production. | Blocked pending a real saved race, hosted integration and release checks |

The full 120-rider recording is much larger than its viewer
projection. A flat 120-rider/120 km V7 fixture measured 14,175,640
JSON bytes for the motor ledger and 1,706,991 gzip bytes in the V1
archive. A synthetic game-shaped, mountainous 120-rider run with game
starter sporting profiles generated 45,140 contact observations and
204,989,027 raw bundle JSON bytes. This exceeds V1's 64 MiB bound.
The lossless V2 archive packs repeated contact topology by rider index,
removes duplicate top-level contact and checkpoint arrays, then restores
the exact V7 bundle before full replay verification. That same run used
64,517,108 JSON bytes before gzip and 5,429,942 after. The corresponding
synthetic women's case replayed 45,128 contact observations with
205,056,349 raw bundle bytes, 64,634,992 compact JSON bytes and
5,408,400 gzip bytes.
JSON normalizes a cosmetic starter appearance value of `-0` to `0`;
the archive check compares all recorded fields under that JSON rule.
These are two synthetic cases, not a hosted workload guarantee. An
18-team, 144-rider men's mountainous starter-profile control then
completed and replayed all 17,280 decisions and 144 finish crossings.
Its 45,522 contact observations occupied 246,001,511 raw bundle JSON
bytes, 78,407,470 compact archive JSON bytes and 6,416,291 gzip bytes.
The V2 uncompressed bound is now 96 MiB to fit that measured complete
team field while still rejecting larger archive content. Nineteen
complete eight-rider teams would contain 152 riders and exceed the
current 150-rider viewer contract; this is a transport limit, not a
new game entry rule. The 144-rider local create, encode, decode and
replay check took 163,863 ms and reached about 2.75 GB peak RSS. The
experimental route has a 180-second duration, but the local check
contains extra decode and replay work while the route performs database
work. Its hosted memory and runtime have not been measured. The matching
18-team women's control also replayed 17,280 decisions, 144 finishes
and 45,644 contact observations. Its compact JSON was 78,179,955 bytes and gzip was
6,396,461 bytes; complete local create, encode, decode and replay took
173,004 ms and about 2.75 GB peak RSS. Create plus encode measured
122,564 ms for women; that local phase time excludes hosted database
work and cannot clear the route gate. The
archive envelope checks compressed and uncompressed hashes, event ID,
viewer-document hash and full motor replay after decompression. V1
archives remain readable. A separate, immutable
experimental table can store that archive and the versioned viewer
document. Its local PGlite tests cover privacy, immutability,
current-entry checks, base64-to-bytea storage and the small clock
response. The hosted database and runtime remain unverified. Generate
and replay a race once, persist the archive and separate versioned
viewer document, and serve only the document on later page views.
The recording route uses V2 for new experimental recordings and rereads
the committed snapshot and entries after
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
