# Motor-owned position model, first contract

The player authorized a new versioned position simulation from the start
of future races. Existing group-clock recordings remain unchanged. Their
shared kilometre checkpoint does not establish individual wheels or a
finish order, and the viewer must not backfill one.

`physical-first-position-start-1` requires its version marker to have been
committed with the race; historic inputs without it are refused. It accepts
a committed race input and an
explicit abstract grid (`laneCount`, `wheelSpacingM`, `laneStaggerM`). It
uses the existing first-kilometre paid leader plan, recorded positioning
skill and race seed to create one unique start slot per rider. The selected
first front worker occupies the first slot. The complete input, including
the grid and seed, is hashed in canonical key order; replay rejects changed
positions. These lanes are motor model coordinates, not atlas geography.

`physical-first-position-road-1` presently advances only one connected
road with the same named leader, no attack, drop or contact. Each rider
travels exactly 1,000 metres at the road's paid speed, retains their
relative slot and carries the energy and quiet-kilometre state from that
rider's paid decision. Replay rejects a changed position, energy or leader.
It records each rider's passage of a kilometre line only when that rider's
start and end positions straddle the line during a paid road interval. The
crossing clock is interpolated from the recorded road speed. On a 2 km
steady road the front worker crosses kilometre 1 in the first interval;
the riders behind cross it later, during the second interval. These
checkpoint passages are model data, not official race results.
The separate old group checkpoint may mark the front at kilometre N while
followers are still behind it in this positional model. It must not be
treated as all riders' individual crossing distance or finish time.

This is an opt-in research contract. It does not produce complete finish
crossings, official places or awards. Before it can drive the viewer or game cycle, the
motor must pay and replay leader rotations and passing, attacks, early
drops and physical contact, sprint motion and every rider's actual passage
through the finish. Full 30/150/160-rider and both-category race coverage,
same-seed calibration and hosted checks remain release requirements.

`physical-first-position-trace-1` first replays the complete existing paid
race from committed input. It then advances the separate positional
contract for each supported kilometre, records every supported checkpoint
passage, and reports the first unsupported kilometre. Only a known missing
movement contract can produce an unsupported report; unexpected energy or
position disagreement throws. Its `raceValidatedKm` and
`completedThroughKm` are deliberately separate. A fully paid race may have
only one kilometre of physically supported positions. Likewise,
`finishCrossingCoverage` counts actual individual crossings at the final
distance: a 3 km connected-road example has 1/16, since the other riders
are still behind the line when the front road clock ends. No official
classification may be inferred from that partial finish.

`physical-first-position-finish-tail-1` can settle that partial line only
after every kilometre has a supported, unchanged connected road. The
field continues at its last paid road speed for the remaining distance
between the last wheel and the finish. Every rider pays the additional
terrain-priced distance, including the front worker riding beyond the
line to keep the field sheltered until the last wheel crosses. Individual
crossing clocks are calculated from each recorded pre-tail position.
Replay rejects altered times or charges. In isolated 16- and 160-rider
tests all wheels reach the line, but the contract deliberately preserves
their previous order: no paid sprint or overtaking has happened, so these
are neither official placements nor a validated stage result. A leader
change, drop, attack or contact still prevents this settlement until its
position movement is implemented and replayed.

A focused 120 km, 160-rider flat fixture with one ordered front worker
now completes all 19,200 rider-kilometres in both the paid race replay
and the separate positional trace. Every rider passes kilometre 119 and
the paid finish tail covers 160/160 crossings. This fixture proves
whole-route continuity only for its connected-road conditions. It does
not replace the 72-case, both-category release calibration, nor does it
establish sprint results or performance in the viewer.

`pnpm audit:motor:positions` uses the same committed 120 km Motor Lab
input generator as the experimental viewer exporter. It fails closed until
every scenario has full positional coverage, every rider crosses the
finish and official results exist. The shorter diagnostic command is
`node scripts/audit-motor-position-coverage.mjs --smoke`. On the current
seed its four cases all replay the paid race through 120 km. In mountain
selective chase without attacks, both men and women have 24 km of
position coverage (2,880/14,400 rider-kilometres), then the named leader
changes from `you-0` to `you-2` at km 25 without a paid passing move. In
flat all-helper chase with selective attacks, both categories have 19 km
of position coverage (2,280/14,400 rider-kilometres), then an attack
launch changes road membership at km 20 without a paid positional
departure. All four currently have 0/120 individual finish crossings in
the positional trace, and none has official results. These are precise
missing movement contracts, not crashes or missing kilometres in the
existing group-clock race.

`physical-first-position-rotation-km-1` is a separate successor step. A
replacement front worker must pass in a clear lane at a faster payable
speed, and the step records crossing time, roles, energy and refusal.
The focused rotation tests pass, including replay and forged-payment
refusal. `scripts/audit-position-rotation-v1.mjs` compares this independent
model against the actual paid race at every kilometre. In the 72-case
matrix the independent model continued to 120 km in all 72 races, but
**zero** remained aligned with the paid source throughout: 24 first
diverged at a front-worker/clock change and 48 at a separate attack-road
membership change. There were no paid front passes in the matrix and no
official results. Independent distance coverage is therefore not
viewer-ready race coverage; the release gate remains red.

The opt-in `physical-first-position-start-2` uses the same committed
orders, rider strengths, seed and grid to stage the payable reserve front
worker in the first row at the outside edge. When an actual committed
attack order and sporting goal identify an attacker, the start contract
also stages that rider near the front. This is a start decision,
not a retrofit to historic recordings. Its input hash and deterministic
replay cover the staging. `physical-first-position-rotation-km-2` then
uses the existing charged passing physics on that grid; a selected
worker still remains behind if the pass cannot be paid or reached. The
new connected-road recorder refuses every attack order until a paid
positional departure exists, and its finish tail charges the continued
road movement until the last wheel crosses. It does not award places.

In a 120 km, 120-rider mountain fixture with no attacks, this successor
records 14,400 rider-kilometre decisions, one paid passing event at km 25,
120/120 individual finish crossings, a replayable energy ledger and no
official results. The old group-clock source changed leader at km 25
without a passing interval; the successor's physical pass makes the
checkpoint clock about 0.02 seconds later. That discrepancy is retained
and measured rather than overwritten. Attack departures, dropped riders,
contact, competitive sprint order and whole-race calibration remain
release blockers.

`physical-first-position-attack-departure-km-1` accepts an attack choice
only when its rider has a clear lane, can pay the initiation and road
work, and actually passes the measured bunch front before the kilometre
ends. It records the passing time and distance, solo energy and each
crossed kilometre line. `physical-first-position-solo-km-1` advances that
new road on the same authoritative clock, paying the distance travelled;
the rider stops at the real finish line even if the bunch has kilometres
left. A solo rider whose lead disappears requires a separate paid contact
contract and causes a fail-closed stop. The whole-race successor currently
supports at most one attack and refuses any additional attempted launch.
The 48-case matrix (two seeds, both categories, three terrain profiles,
two chase orders, selective and repeated attack orders) reached 120 km
in every case. Each had one paid departure and 120/120 finish crossings.
All 48 had the same final road count and peloton membership as the older
paid source, but this does not establish agreement at every kilometre.
The solo finish clock differed from the older paid group-clock source by
as much as 39.5 seconds, and the peloton front by up to 1.7 seconds, so
neither calibration nor official results are established. The recorder
rejects any second attempted departure or unpriced contact; these
scenarios did not exercise those missing paths.

The separate `physical-first-position-early-climb-audit-1` fixes a
160-rider, 20-team mountain input with an explicitly committed named front
worker. The older paid race records 66 first-kilometre start drops. The
new position step stops at kilometre 1 with `Rotation kilometre loses first
shelter.` Its speed projection is labelled **unpaid diagnostic**: it omits
energy and collision settlement and cannot become a viewer recording.
This fixture exposes a missing movement contract, not a reason to apply
the old source's instantaneous drop membership to new wheel positions.

`physical-first-position-rear-tail-drop-km-1` is the first narrow contact
contract: one weak last wheel in the first kilometre pays sheltered travel
until the measured gap reaches two wheel spacings, then pays solo travel.
It records contact time, location, both priced distances and energy, and
replay rejects altered data. It refuses a simultaneous front pass or any
case without measurable contact loss. It does not claim to solve the
160-rider fixture: interior riders still need paid sliding through the
pack, detached riders need their own subsequent roads, and rear groups
may form only after their actual positions establish contact. No official
finish or viewer export is derived from this isolated contract.

An additional experimental `physical-first-position-fixed-lane-convoy-km-1`
advances every rider from a committed start grid, kilometre by kilometre.
The front worker sets one shared race clock. Every other rider has a
strength and order-dependent preferred speed, but cannot ride through the
wheel immediately ahead in the same lane. A rider near a wheel ahead pays
sheltered distance; the first wheel of each detached component pays leader
distance. Quarter-second paid movement samples record every change in the
measured contact components. The component records and per-rider energy
and distance replay exactly; no old group time sets these positions.
The fixed-lane rule deliberately forbids lane changes, attacks and front
rotations, so its output is an **experimental trace**, not an assertion of
realistic overtaking or a completed race result. The 160-rider
named-worker fixture records all 19,200 rider-kilometre decisions over
120 km and five paid contact-topology changes. It matches the older
source's front clock exactly and its peloton membership and road count
at 118/120 kilometre boundaries. At the first boundary it has four
components of 114, 20, 15 and 11 riders, while the old source has 66
immediate start drops. Their membership differs in the first two
kilometres. At the final boundary both have six roads, including a
94-rider peloton, but the new model's last rider still has about 3 km
to travel when the front crosses. The two initial drop counts are not
silently substituted for one another.

`physical-first-position-fixed-lane-finish-1` continues each unfinished
rider on the actual remaining kilometre segments. A rider stops at the
real line; no one rides an invented post-finish route to tow teammates.
Each quarter-second interval pays its measured distance with the role
implied by current contact; the route and team order are selected at the
rider's own distance. The 160-rider fixture covers 160/160 replayable
individual crossings. The largest difference from the older source's
**group clock** is 129.7 seconds, and only one individual clock matches
exactly. The older clock does not contain wheel order, so neither these
differences nor the new deterministic crossing order establish a
calibrated official result. Lane changes, a competitive sprint, more
seeds and distinct rider profiles remain to be validated before any
viewer feed. The same audit also completed for a separately committed
women's field; the synthetic playtest generator assigns identical skill
numbers to its men's and women's rosters, so this checks category
isolation and replay, not a second physical calibration.

`physical-first-position-hybrid-policy-1` selects the existing paid
rotation when every wheel remains connected and all riders can hold its
shelter. A measured shelter loss selects the fixed-lane convoy instead.
An attack order still refuses: the policy has no attack departure path,
and an unpayable front change cannot silently take effect. The versioned
whole-race recorder stores each chosen step, every rider decision,
checkpoint crossings, contact events and an individually paid finish;
whole-recording replay rejects changes. Its viewer-ready and
official-results fields remain false.

The 24-case no-attack, two-seed matrix (men and women, flat/rolling/
mountain, selective/all chase) completed 24/24 120 km traces and
120/120 finish crossings per race. It agreed with the older source on
peloton membership at every kilometre. The maximum front-clock
difference was 1.69536 seconds. The largest individual finish-clock
difference from an older group clock was 9.16 seconds; that older source
does not record individual finish order. **All 2,880 kilometres selected the
rotation path and none selected the fixed-lane path**, because these
standard 120-rider inputs did not lose shelter. The separate 160-rider
named-worker mountain fixture selected fixed-lane movement for all
120 kilometres and completed 160/160 paid crossings. This is evidence
for two paths separately, not yet a mixed drop-and-rotation race.

`physical-first-position-mixed-front-pass-km-1` covers a narrower mixed
case: a connected peloton makes the established, priced passing move
while already detached rear roads continue on its two measured clock
segments. Every rear rider pays actual distance and the step refuses any
new contact topology it cannot account for. A committed future named
worker can be staged near the front from the start; staging is recorded
in the start input hash and does not guarantee a later pass. A proposed
worker who cannot make the paid move receives an explicit refusal.

In a 160-rider mountain variant, a committed order at the allowed 25 km
marker requests a new front worker from kilometre 26. The older source
switches immediately. The new position race records 42 refused passes,
then one payable pass at kilometre 68 with the six existing contact
components kept intact. It completes 19,200 rider-kilometres and
160/160 individual paid crossings for the separately committed men's
and women's fixtures. The maximum peloton-front clock difference from
the older source is 13.45 seconds, and the maximum individual finish
difference from old group clocks is about 129 seconds. These differences
are retained as evidence that the new positional timing still needs
calibration; the output has no official classification. The synthetic
roster uses identical numerical skills for the two gender labels.
Repeating the men's variant with a second committed seed also completed
120/120 kilometres, 160/160 paid crossings and whole-recording replay;
it exercised the same one paid pass after 42 refusals. This seed check
does not add a distinct rider-strength profile.

A deliberately synthetic front-worker ability sensitivity check exposed
a missing movement contract. Reducing the current worker's three terrain
abilities by five points changes the older source's first-kilometre
start drops from 66 to 46. The established rotation calculation rejects
the proposed pass at kilometre 43 because its uniform shelter check says
a second wheel would drop. The replacement is in a clear outside lane
only 0.24 m behind the front. The opt-in
`physical-first-position-pass-contact-km-1` now quotes the payable pass,
then moves and charges every wheel in quarter-second steps on one clock.
It records any measured contact changes instead of inferring them from
the older shelter check. In this exact fixture, **no new contact change
occurs during the pass**. Both category-labelled 120 km variants complete
19,200 decisions, 160/160 paid crossings and whole-recording replay.
The new contract has not yet been demonstrated on a pass that actually
splits contact in the same kilometre.

At a ten-point reduction, the model explicitly refuses an unpayable
earlier pass, then records one paid pass at kilometre 43 and completes
120 km with 160/160 crossings. Increasing the current worker's abilities
by five points also completes, but the older source and position model
disagree on peloton membership throughout that race. These synthetic
variants are diagnostic inputs, not canonical rider profiles, a broad
profile calibration, or permission to infer official results.

The separate one-attack recorder was checked against synthetic changes
to its already selected attacker's terrain abilities, without adding a
route or a team order. A five-point reduction still completes the
four-case two-category smoke set. A seven-point reduction exposes a
second attempted departure at kilometre 10 in both mountain fixtures;
a ten-point reduction exposes second attempts at kilometre 10 in the
mountains and kilometre 40 on flat roads. The recorder refuses these
orders because it has only one paid solo-road slot. None of these
fixtures demonstrates a caught solo rider; that contact contract remains
missing.

`physical-first-position-multi-solo-race-1` extends the isolated position
recorder to carry several paid solo roads on one peloton clock. A second
attack is only a recorded solo road after the named rider passes the
measured front in a clear lane and pays for the move. If a selected
attacker lacks that lane, the attempt is recorded as a refusal and the
rider stays in the peloton. Solo-to-solo contact still fails closed.
Finishers stop at their own paid crossing times: sharing the finish
coordinate after finishing is not evidence of simultaneous contact.
The small synthetic two-team, three-kilometre test has two paid
departures, distinct solo crossings, complete finish coverage and exact
whole-recording replay. This proves the movement path, not whole-race
calibration for multiple successful attacks.
The unmodified 48-case, two-seed, two-category attack matrix also
completes 48/48 races and every finish crossing on this recorder, with
one paid departure per race and no refusal. It matches the older
source's final road membership in those cases; no scenario in that
matrix needs a second successful attack.

On the ten-point weaker-attacker 120 km smoke set, the new recorder
completes all four races with one paid departure and one refused later
attempt on each flat race or three on each mountain race. The older
source sends `you-5` into the forward road as well as `you-7`; the
position model keeps `you-5` in the peloton because its passing lane
is blocked. This is an explicit source disagreement, not a scripted
model catch-up. A paid positioning or lane-change decision and a
measured caught-break contact remain release blockers.
At the rejected flat-road window, `you-5` is 25.24 m from the front
with ten wheels ahead in its lane; in the mountain case it is 35 m back
with fourteen ahead. These are long positioning moves, not a missing
fractional timing adjustment. A separate two-solo mechanics variant
confirms that the recorder refuses a genuine mid-road solo catch while
allowing riders to cross the same finish coordinate at different times.
A separate four-kilometre synthetic hill fixture makes the peloton catch
a paid solo in kilometre 3. The recorder currently refuses that contact;
this is a reproducible release blocker, not a completed catch model.

An isolated successor step,
`physical-first-position-shared-road-km-1`, now advances the existing
solo and every bunch wheel on the same quarter-second clock for that
fixture. It records the first measured solo-to-peloton contact during
kilometre 3, including observed time and wheel distances. The rider
then falls through the bunch and ends in a recorded rear component,
while every rider pays distance and energy. The same state advances
through kilometre 4 and the existing positional finish tail pays all
16 crossings; a forged contact distance fails replay. This is a
synthetic mechanics proof, not yet the 120 km attack recorder. The
shared step currently keeps fixed lanes, refuses a bunch leader blocked
in its lane, and does not execute a new attack or front-worker change
while a solo is being caught. It therefore cannot yet replace the
whole-race recorder or support guided races.
`physical-first-position-single-catch-race-1` composes the paid departure,
shared road, observed catch, rear continuation and finish settlement into
a complete four-kilometre recording. It verifies one crossing per rider
per kilometre, 16 paid finish crossings and exact whole-recording replay.
It explicitly refuses a second attack or a changed front worker. This
does not establish a 120 km caught-break race or multi-attack race, and
therefore remains an isolated experimental contract.
The same 16-rider contract now completes a separate synthetic 120 km
route with alternating flat and hill stretches. Each rider's speed and
energy cost use the segment under that rider's wheel, including when a
rear group is behind the peloton by more than a kilometre. The finish
continuation records the rear riders' remaining kilometre crossings;
all 1,920 rider-kilometre crossings and 16 finish crossings validate and
the whole recording replays. This route and roster are deliberately
synthetic and do not calibrate real sporting outcomes. Later team attacks,
changed front workers and variable lateral passing remain unsupported.
An additional 160-rider, 30 km synthetic catch with an explicit one-time
attack order completes 4,800 rider-kilometre crossings and 160 paid finish
crossings with whole-recording replay. Its first-time computation plus
replay took about 33 seconds on the development machine. This expands
the field-size check; it is not a whole 120 km calibration at that size.
The same 160-rider fixture also completed a full 120 km stress run with
19,200 rider-kilometre crossings, 160 paid finish crossings and exact
whole-recording replay. Computation plus replay took about 124 seconds.
Its hill profile and one-time attack order are synthetic; the result
does not settle comparison with the old motor or sporting plausibility.
The same-seed source comparison exposes a serious fixed-lane artefact:
in the 160-rider 120 km hill fixture, the old motor ends with 159 in the
peloton and one solo, while the position model puts 120 in the front
component and 40 in a rear component. The weak caught solo blocks one
entire lane; 39 other riders remain trapped behind it. The peloton-front
clock differs by only about 0.21 seconds at the finish, so clock agreement
does not validate road membership. The model needs a measured, paid way
for following riders to pass or change lanes around the caught rider.

`physical-first-position-shared-road-km-2` adds an opt-in named front
surge on the same clock. It verifies the actual front-worker plan,
requires a clear passing lane and payable surge, changes the leader only
after the measured wheel passes, and records the observed pass time,
distance and surge cost. `physical-first-position-single-catch-race-2`
composes this with the catch and rear-road continuation. A four-kilometre
fixture and a 160-rider, 30 km fixture with a committed worker order
at kilometre 25 each record one paid late pass, one caught solo, complete
finish coverage and whole-recording replay. The v1 contracts stay
separate. Passing is still limited to a clear lane; a blocked worker
does not teleport forward. Further attacks, simultaneous pass/contact
stress cases and whole-distance same-seed calibration remain open.
The 160-rider front-pass variant also completed the full 120 km route:
19,200 rider-kilometre crossings, 160 paid finish crossings, one caught
solo, one paid front pass and exact whole-recording replay. Computation
plus replay took about 104 seconds. This is a synthetic hill course with
one-time attack and a later named worker order; it still needs comparison
against source races and varied route/order combinations.

`physical-first-position-shared-road-km-3` is an isolated successor
with an explicit `positionPassingCorridorCount: 1` motor input. The
position-model configuration hash binds that choice to the recording.
Following riders may enter an outside corridor only when the nearest
same-lane wheel ahead is the already caught rider. The move is recorded
with a clock, distance and rider IDs; movement in the corridor pays the
exposed leader cost. A rider returns to the original lane only after
passing that rider by at least one wheel spacing and finding an open
wheel slot. The return is also recorded. The race-3 recorder keeps
the earlier race variants unchanged and replays every recorded move.
The number of lanes is a synthetic fixture assumption, not canonical
course geometry, so this branch cannot be applied to an actual route
without a route-width source.

On the same synthetic 160-rider hill seed, race-3 completed 30 and
120 km with one paid catch, one paid later front-worker pass, 160
finish crossings and 78 recorded corridor entry/return events. The
120 km run had 19,200 rider-kilometre crossings and took about 96
seconds to compute. Peloton membership matches the old source on
118 of 120 kilometre checkpoints, including the finish. The two
disagreements are at the caught-solo transition. The maximum front
clock difference is about 0.21 seconds. A fixed-lane predecessor
mistake initially stopped passing after three wheels; choosing the
nearest wheel and recording the return eliminated the false 40-rider
rear group in this one seed. Source agreement is a diagnostic, not
ground truth: the old source still labels its caught rider separately
at the two transition checkpoints. Other seeds, profiles, orders,
multiple attacks and official results still require calibration.
The same-seed alternating flat/hill variant completed at 16 and
160 riders for 120 km: 16-rider peloton membership aligned at all
120 checkpoints, while 160-rider membership aligned at 118 of 120.
Both finished with the same peloton membership as the old source,
one paid catch and one paid later front pass. Maximum front clock
differences were under 0.25 seconds. The fixture is still synthetic;
these runs vary profile and field size, not rider roster, tactical
choices or route width.

The shared step now caches a rider's terrain/role speed for its own
kilometre invocation; reserve changes only after the step is settled.
Three complete fixture recording SHA-256 hashes (16 riders at 4 and
120 km, and 160 riders at 30 km) stayed identical before and after
the cache. On the same machine, the 160-rider 120 km race-3 compute
fell from about 96 to 24 seconds, and compute plus exact replay from
about 146 to 42 seconds. This is a runtime improvement, not a change
to rider decisions or race outcomes.

`node scripts/audit-position-unified-72-v1.mjs` reuses one existing
opt-in positional recorder for the 72-case synthetic 120 km matrix:
two categories, three terrain families, two chase orders, three
attack orders and two seeds. All 72 have complete per-active-rider
decisions, one crossing per rider and kilometre, exact recording
replay and the same peloton membership at the finish as the old
source. There are zero official results. The shared fixture roster
does not exercise the separate early-climb drop case, and one
successful attack is the recorder's limit. The old group's finish
clock is not an individual finish order. This audit demonstrates
that one pre-existing recorder already covers the connected and
one-solo matrix; it does not make the motor release-ready.

`physical-first-position-solo-km-2` corrects a separate locality
error in the opt-in one-solo branch. A solo rider ahead of the field
now rides each terrain segment under that rider's own wheel during
the shared clock interval. The recorder stores the segment, speed,
distance and energy payment for each leg. The successor
`physical-first-position-one-attack-race-2` uses those legs and
replays the complete route; v1 is unchanged, with a byte-for-byte
recording comparison on an existing 120 km mountain case. In all
48 synthetic attack scenarios, v2 completes 120 km, every rider
finishes, and the source's final road membership aligns. Maximum
solo finish clock disagreement falls from about 39.5 to 33.2
seconds. The remaining clock disagreement needs explanation; no
official result or viewer-ready position claim follows from this.

The following opt-in solo-km-3 and one-attack-race-3 versions also
charge the lone rider as the exposed road leader. The prior solo
versions charged the cheaper `solo` energy role, while the source
physical road step charges `leader`. The record keeps the solo road
role and writes `energyRole: leader` on each paid terrain leg. In
the same 48-case, 120 km attack matrix, all races and finish
crossings still complete and final road membership aligns. Maximum
solo finish clock disagreement with the source falls from about
39.5 seconds in v1 and 33.2 seconds in v2 to 0.071 seconds in v3.
The source peloton-front clock still differs by up to 1.70 seconds;
the matrix has one successful attacker per race and no competitive
sprint or official classification. This is calibration evidence,
not authority to activate guided races.
