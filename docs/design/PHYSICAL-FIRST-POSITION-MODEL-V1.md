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
With the v3 exposed-leader solo payment selected, the unified
72-case audit also completes 72/72 with full decision and finish
coverage, final peloton membership alignment and exact replay.
Maximum solo finish clock disagreement is 0.071 seconds among the
attack cases. The result remains synthetic and unranked.

`physical-first-position-multi-solo-race-2` applies the same
exposed-leader solo legs to each active separate rider while
preserving the v1 recording byte for byte. Its contact guard checks
the minimum measured gap at every terrain-leg boundary shared by
two solo trajectories. A three-kilometre fixture with two distinct
paid departures completes and replays; a converging second solo is
refused until a paid contact contract exists. This extension fixes
the cost rule across another race shape, but it does not yet join
two solo roads or settle their competitive finish.
The 48-case attack audit also completes with this multi-solo
successor and retains the 0.071-second maximum solo finish clock
difference in that matrix. Those fixture races have only one
successful departure each; the separate three-kilometre test is
the evidence for two successful departures.

`physical-first-position-shared-road-km-4` applies the same
exposed-leader energy payment to a separate solo rider and to a
front-pass candidate, recording `energyRole: leader` on the paid
legs. The enclosing `single-catch-race-4` is opt-in and requires
the explicit one-lane passing-corridor input. Earlier recordings
and replay versions remain unchanged. In a synthetic 160-rider hill
fixture, both the 30 km and full 120 km runs complete with one
paid catch, one paid later front pass, 78 lane events, and every
rider crossing every kilometre and the finish. At 120 km the final
peloton membership matches the source (159 riders), with one rider
remaining separate; membership matches at 118 of 120 checkpoints.
The largest front-clock difference is 0.195 seconds. This verifies
that the exposed-leader cost can be carried through this whole
race shape. The 160-rider 120 km recording also passes exact
same-input replay, including its energy, contact, checkpoint and
finish data. The source has only group clocks, so these comparisons
cannot validate exact rider order or make the tail crossing order
an official result. The corridor is a synthetic model input, not
measured route width. Additional orders, profiles, early drops,
multiple catches and competitive finishes still need full-race
validation before guided-race activation.

`physical-first-position-shared-road-km-5` and
`single-catch-race-5` extend the same explicit corridor to a
stronger bunch rider blocked by a slower worker in the same lane.
Before entering, the model checks that the worker cannot hold the
current front speed under shelter while the following rider can.
Entry and return are separate recorded events; the follower pays
exposed-leader energy during the bypass. In the synthetic hill
fixture with one extra weak bunch worker, the v4 recorder drops
both the weak rider and the follower at kilometre 2. V5 records
the follower's pass and return within that kilometre. The weak
rider becomes a measured rear road; the follower stays with the
peloton. The 160-rider 30 km and 120 km hill recordings complete
and replay, with every rider's finish crossing and final peloton
membership aligned to the source. A 120 km alternating-profile
run on another seed also completes with matching final peloton
membership; it differs at three intermediate checkpoint groups
and its largest front-clock difference is 0.234 seconds. This is
an opt-in positional experiment. The
model's chosen corridor width, a single attack and a single
catch remain fixture limits, and the source's group labels do
not prove the exact simultaneous wheel trajectories.
With two equally weak bunch workers, the source probe refuses
their proposed rear group because it cannot choose a payable
shelter-compatible leader; that case is not a completed
same-seed comparison.

`node scripts/audit-position-catch-matrix-v1.mjs --km=30`
screens 24 synthetic combinations of 16 or 160 riders, two
profiles, two seeds and zero, one or two weak bunch workers.
The v5 positional recorder finishes and exactly replays all 24,
with full per-rider kilometre decisions, intermediate checkpoint
crossings and finish crossings. The source completes 16 cases;
all 16 agree on final peloton membership. Its eight failures
are the two-weak-worker rear-leader refusal above, so they do
not establish a source/position comparison. The fixture still
shares a narrow roster and tactical pattern; this matrix is a
coverage measure for those inputs, not proof of other races or
an official classification.

The same catch matrix at `--km=120 --weak=0,1` completes all
16 source and positional races, each with 16 or 160 riders, two
profiles and two seeds. Every positional race exactly replays and
has all rider decisions, intermediate kilometre crossings and
finish crossings. All 16 final peloton memberships agree with
the source. The two-weak-worker source refusal remains excluded
from this longer comparison.

`physical-first-position-shared-road-km-6` permits a later named
attack to earn a separate departure in the same paid clock. Its
choice and initiation cost are recorded before movement; the
departure event is emitted only after the rider pays for clear
lane movement and gains physical separation. The opt-in
`multi-attack-contact-race-1` composes this with the first-kilometre
departure. A 16-rider, 20 km synthetic hill-to-climb race with
ordered attacks at kilometres 1 and 5 completes with 320 rider
decisions, 304 intermediate crossings, 16 finish crossings and
exact replay. The source also completes the same input.
This case is **not calibrated**: paid contact joins the two
attackers at kilometre 8, but they separate again in the
positional model, while the source keeps them in one rear group
at the finish. The recorded contact alone does not justify
forcing them to stay together. A simultaneous later attack and
planned front-worker change records a
`front_assignment_conflict` refusal for the attempted attack.
The front-worker move retains its paid route. This one-corridor
priority is an explicit experiment, not a claim that the source
attack happened. The 8-case two-attack audit at 20 km completes
and exactly replays all positional races with complete rider
decisions and crossings. The source makes two paid departures in
all eight; the positional model makes two in only one, recording
lane or assignment refusals in the others. Final rear groups
match in one case. Thus full-race completion alone is not
calibration, and this version cannot enter guided races. No
official result or viewer-ready race is asserted.

`shared-road-km-7` lets a later attacker enter the explicitly
provided passing corridor at their measured distance. The
attacker pays initiation and exposed travel, earns a departure
only after physical separation, then records a return to a
normal lane. The `multi-attack-contact-race-2` wrapper preserves
the v1 recording. In the four 20 km audit cases without a
competing front-worker assignment, both ordered attacks now
depart in the positional model, up from one of four in v1.
All eight positional cases finish and replay at both 20 and
120 km with complete per-rider decisions, checkpoint and finish
coverage. The source launches both attacks in all eight;
the positional model still refuses the second in the four
front-assignment conflict cases. Final rear membership matches
only one of eight cases at either distance. The corridor is a
synthetic input and cannot be inferred for a real route.

`shared-road-km-8` allows a follower in a measured two-rider
rear contact to choose cooperative shelter, provided both
actual team orders say `breakWork: cooperate`. The follower
limits their paid sheltered speed to the front rider's paid
leader speed, with a versioned pace event. No contact is created
by this decision; a prior physical contact observation is
required. With `sit_on` instead, no pace event occurs and the
two riders separate in the targeted 20 km case. The enclosing
`multi-attack-contact-race-3` completes and replays all eight
20 km and all eight 120 km audit cases. Every run has complete
per-rider decisions, checkpoint and finish crossings. Final rear
membership matches the source in seven of eight at each
distance, compared with one of eight for v2. The
remaining case has an unresolved simultaneous front-worker
assignment and second attack. Larger rear components and
competitive finishing still need separate physical rules.

`shared-road-km-9` and `multi-attack-contact-race-4` price a
front-worker pass and a distinct named attack within the same
source kilometre. The event order follows their measured
separation on the shared clock. A front rider blocked by the
newly caught attacker first records contact, then enters and
returns through the explicit paid passing corridor. In the
eight-case 20 km and eight-case 120 km two-attack audits,
all positional races finish and exactly replay, both attacks
physically depart, and final rear memberships match the source
in all eight at each distance. Every positional race has complete
per-rider decisions, intermediate crossings and finish crossings.
Intermediate peloton membership still diverges at some
checkpoints (as many as four of 120). A distinct test assigning
the same named rider to attack and front work is refused by both
models without a paid replacement; the source's manager-order
guard remains in force. This
does not establish precise wheel order, official classification,
or validity for races without an explicit corridor.
Changing the named second attacker across six rider slots in
the 16-rider fixture completes and replays 12 of 12 cases, each
with two paid departures and aligned final rear membership.
Three alternate second-attacker slots in the 160-rider field,
with and without a front-worker change, complete and replay
12 of 12 cases with aligned final rear membership. Some of
those larger-field positional attempts are physically refused
even though the source launches two attacks; final group
agreement must not be mistaken for attack-decision agreement.

`shared-road-km-10` accepts a connected positional start with
no separate solo road. The opt-in `general-race-1` recorder
derives the first paid front from the committed start plan and
records all riders on the same clock whether the first attack
order is present or absent. A 16-rider 20 km connected fixture
finishes with 320 rider decisions, 304 intermediate kilometre
crossings and 16 finish crossings, with exact replay. A separate
20 km two-attack fixture also finishes and exactly replays.
For the current generated Motor Lab 120-rider mountain test input
without attacks, both men's and women's 120 km races complete
and exactly replay: 14,400 decisions, all intermediate crossings
and 120 finish crossings per race. All 120 peloton membership
checkpoints align with the source and the maximum front-clock
difference is 0.02 seconds. These are test inputs, not guided
races or official classifications. A men's rolling selective
attack test currently stops the positional recorder at kilometre
118 when a solo reaches the actual finish before the peloton;
that physical early arrival needs an explicit finish contract.
The wider no-attack audit completes and exactly replays all
12 current Motor Lab test inputs: both categories, flat/rolling/
mountain profiles, and selective/all chase orders. Every run
contains 14,400 rider decisions, all intermediate crossings and
120 finish crossings, and all 120 peloton membership checkpoints
agree with its source run. The largest front-clock difference
in each flat case is 1.67 seconds, in each rolling case 1.70
seconds, and in each mountain case 0.02 seconds. These group
clock comparisons do not certify exact rider positions or
official finish order.

`shared-road-km-11` and `general-race-2` keep the connected
start but give a rider who reaches the route's actual finish
before the peloton front an explicit paid crossing clock. The
rider leaves contact topology at that instant. Later global
kilometres contain a terminal `already_finished` row with zero
movement, unchanged reserve and the original finish clock;
they do not charge further distance or invent a new decision.
The fixed-lane finish validates and retains the earlier crossing
instead of replacing it with the peloton's later clock. Replay
checks the entire versioned record. Versions 1–10 retain their
original behavior and historic group-clock races are unchanged.

On the current generated 120-rider Motor Lab test input with a
selective attack, all twelve same-seed combinations of men's
and women's fields, flat/rolling/mountain terrain and
selective/all chase orders complete the full 120 km and exactly
replay. Each has 14,400 per-rider kilometre records, 120 × 119
intermediate line passages and 120 finish passages. A solo first
reaches the finish while the peloton front is still settling
kilometre 118. The peloton membership matches the source at
all 119 comparable pre-finish checkpoints. The last global
checkpoint is a different observation: the positional model
withdraws finishers, while the source still classifies them in
their source groups. Maximum observed front-clock differences
are 1.60 seconds on flat/rolling routes and 0.02 seconds on
mountain routes; maximum final reserve difference is 3.349
units. The largest 9.722-second difference between an
individual positional finish and the source's group finish
clock is reported for visibility; a group clock does not
establish the simultaneous position of its members. The
energy difference still needs investigation and calibration. The
record does not supply an official sprint, placing, awards,
atlas coordinates or production-ready viewer data.
Eight additional 120-rider selective-attack runs with two
different seeds, both categories and rolling/mountain profiles
also finish and exactly replay. The source and positional
records agree on the one attack departure in every one of
those runs. This is evidence for those generated inputs, not
a guarantee for arbitrary profiles, rosters or manager orders.

`rear-boundary-contact-3`, `road-crossing-guard-3`,
`solo-contact-settlement-3` and `whole-race-probe-10` are a
separate source-probe opt-in. When two solo roads have paid
receipts at the same kilometre boundary but the next terrain
has no willing, payable, shelter-compatible leader, the contact
event records that fact without forming a rear road. Both
riders continue on separate exposed, paid solo roads. The new
crossing guard permits their co-timed departure only when the
exact boundary contact and each paid solo receipt are present;
other unrecorded road crossings still fail. A no-willing-leader
order still refuses a shared road. The earlier probe and
boundary contracts are unchanged, and probe 10 adds exact
whole-race replay.

In synthetic, noncanonical 16-rider 20 km tests, one and two
weak bunch workers now let probe 10 reach the finish where
probe 9 stopped at kilometre 3. The position recorder also
finishes and replays each input. Peloton membership agrees at
all 19 pre-finish checkpoints. With one weak worker, the
source eventually forms a two-rider rear road while the
position model keeps two separate physical rear riders; that
membership remains uncalibrated. A different synthetic case
with two attacks and a later front worker still stops probe 10
at kilometre 12 when a solo crosses an existing rear road.
That crossing needs its own paid physical contact contract.
Passing the simpler cases does not waive this refusal.
The two-worker positional case emits 6,385 contact-topology
observations over 20 km, which is a measured replay and viewer
performance concern. Any event reduction must preserve the
underlying paid-contact evidence and use a new model version.
On the synthetic 160-rider, 120 km one-worker variant, probe 10
and the positional recorder both finish. The position record
contains 19,200 per-rider kilometre rows, all 19,040
intermediate passages and 160 finish passages, with exact
replay. Peloton membership differs at kilometre 2 and agrees
at the other 118 pre-finish checkpoints. The source's final
two-rider rear road is still two separate positional riders;
the recorded boundary tie alone is insufficient to force a
positional reunion. This is a calibration limit, not a reason
to insert an unearned contact.

`shared-road-km-12` and `general-race-3` change only the
experimental contact event projection. A contact observation is
now emitted when the membership of a connected group changes,
not when two riders merely exchange order inside that group.
Each movement tick still computes the physical groups and uses
their current lead order for paid pace and shelter. Event
membership is compared without relying on rider or group order;
the event still records its observed clock and paid step.
The 16-rider 20 km two-weak-worker fixture emits eight group
membership events instead of 6,385 order-sensitive observations.
The full positions, decisions, intermediate line passages and
finish clocks match `general-race-2` exactly, and the new record
exactly replays. This removes viewer event noise without changing
the paid race. It does not resolve the source and position model's
remaining rear-road membership difference, nor does it make this
experimental version a guided-race or production default.
The 160-rider 120 km one-worker fixture also completes and
exactly replays with all 19,200 decisions and 160 finish
passages. It emits three membership events. Its source and
positional peloton membership still differs at kilometre 2,
and the source's final two-rider rear road remains two separate
positional riders. This event reduction does not mask those
calibration differences.
On the current 120-rider Motor Lab seed with one selective
attack, all twelve combinations of men's/women's fields,
flat/rolling/mountain terrain and selective/all chase complete
with positional replay, full rider-kilometre decision coverage,
all intermediate line passages and all finish passages. The
recorded attack departures and the peloton membership agree at
all 119 comparable pre-finish checkpoints in each case. This is
one generated seed, not arbitrary-manager-order certification.
The source and position final reserves still differ by up to
3.349 recorded units on flat and rolling routes, and the new
model still has no official competitive sprint result.
The same branch's isolated Next build and authenticated local
V94 browser smoke pass after the existing preview test is routed
to `/team/motor-lab/engine`, where the guided workbench now
resides. The browser smoke protects the existing game path; it
does not publish or authenticate the experimental positional
race in the hosted viewer.
The flat selective-attack seed's largest final reserve drift
is now traced to the actual front choice. The group-clock
source names `you-2` as peloton leader in 17 kilometres
starting at km 88. The position recorder keeps `you-3`
in front because the proposed pass has no payable, completed
movement on that road. At the finish the source versus
positional reserves differ by -3.349 for `you-2` and +3.315
for `you-3`; the mean absolute difference across 120 riders
is 0.062. The tail adds effectively no distance or energy to
these two, so this is leader-work allocation, not an
unrecorded finish tail. Aligning the records by copying the
source leader would invent a position and is prohibited.
The audit now reports leader mismatches explicitly.

`shared-road-km-13` and `general-race-4` are a further opt-in
decision policy for simultaneous orders. When more than one
team attempts an attack at the same kilometre boundary, the
committed single passing corridor grants one attempt to the
rider with the highest recorded perceived attack ability,
breaking a tie by rider ID. Every other attempted choice is
retained as an unpaid `single_boundary_attack_slot` refusal;
an order is never converted into a departure merely because
it was requested. The selected rider still has to pay and
physically pass, and can independently be refused by the
existing lane/runway guards. This version does not model a
second attack later within the same kilometre. In a synthetic,
noncanonical 16-rider, 20 km two-team attack case, the earlier
general recorder stops at km 1; the new one records both
attempts, one paid departure and one explicit refusal, then
finishes all 320 rider decisions, 304 intermediate passages
and 16 finish passages with exact replay. A single-attack
fixture has identical paid positions, decisions and crossing
clocks to `general-race-3`. The independent source probe still
stops this two-team synthetic input at km 2 because its solo
contact contract is incomplete. Thus the new decision policy
is not calibrated for guided races or official results.
A 32-rider 20 km fixture with four attacking teams likewise
finishes and replays: one recorded departure and three
explicitly unpaid boundary-slot refusals. The no-attack
two-weak-worker fixture still completes and replays both
source and positional records under the new version.

`physical-first-attack-choice-5`, `shared-road-km-14` and
`general-race-5` correct a positional decision error without
changing historic attack choices or the guided race path. The
previous positional adapter projected all riders to the same
group clock when asking whether a teammate was already up the
road. A paid solo rider 103.8796 metres ahead therefore counted
as zero forward teammates. The new opt-in choice reads the
committed front distance and each detached rider's actual
recorded distance. It counts only riders physically ahead of
the bunch front. Its bridge estimate uses that measured gap in
metres and the riders' committed route, condition and ordered
effort to estimate closing speed. This is a decision projection,
not a fabricated simultaneous wheel or contact. The actual
road step must still price and record a pass; the estimate
cannot create a group or a departure. If the projected catch
leaves no useful shared work, the choice holds as before.
In a synthetic 16-rider two-attack race the second boundary
choice now records one physically forward teammate; both
departures, every rider-kilometre decision, all line crossings
and the finish replay. The same no-attack race retains the V4
paid positions, decisions and crossing clocks exactly.
The remaining flat-seed front mismatch is not a lane blockage.
At kilometre 88 the proposed worker is on the same paid road
with a clear lane, 2.74 metres from completing the front pass,
but the quoted relative speed is only 0.000446 metres per
second. The pass would need roughly 73 km of old-leader travel
at that pace, well beyond the kilometre. The group-clock
source rotates the name anyway. The positional recorder
retains the old paid leader and reports a refusal instead of
granting a physically impossible pass. This explains a
measured reserve difference; it is not a calibration knob
to erase by inserting a scripted move.
The current 120-rider, one-seed, selective-attack matrix of
men's and women's fields, three terrains and two chase orders
completes and exactly replays 12/12 source and positional
races under V5. All 12 have every per-rider kilometre decision,
every intermediate line passage and every finish crossing.
Eight have at least one front-leader mismatch, which remains
visible in the audit. These are coverage and replay results,
not proof of official sprint placements, arbitrary new seeds,
all manager orders or hosted viewer readiness.
The V5 160-rider, 120 km synthetic one-weak-worker case
also completes and exactly replays both comparison source and
positional runs: 19,200 decisions, 19,040 intermediate line
passages and 160 finish crossings. Positional contact emits
three membership observations. Peloton membership differs
from the group-clock source at km 2, as in V4.
The 16-rider two-attack, two-weak-worker, front-rotation
synthetic case completes and replays the positional race with
320 decisions, 16 finish crossings and 50 contact-membership
observations. The source probe stops at km 12 when two rear
roads cross without its required paid contact contract.
A 32-rider same-boundary two-team attack case likewise
finishes and replays positionally with 640 decisions and 32
finish crossings; one attempted attack is an explicit unpaid
boundary-slot refusal. The source probe stops at km 2 on a
missing solo-contact contract. These failures must remain
visible; a completed positional race does not retroactively
give the source a physical contact or an official result.
On the repeated-attack mountain seed both categories complete
and replay in source and V5 position. The first attack-choice
count difference in the men's record is at km 118: the source
still lists `you-7` as a solo 284.507 seconds ahead, while the
positional record has already paid and frozen that rider at the
120 km finish. V5 correctly excludes a finished rider from
the count of teammates still riding ahead. The actual ordered
attack departure count remains one in both recordings, and
the first choice remains `hold_until_ordered_attack_window`.
The audit reports this distinction rather than equating a
past group clock with an active wheel on the road.
Two additional seeds, `calibration-a` and `calibration-b`,
complete and exactly replay all 24 of their selective-attack
120-rider source/position combinations across both categories,
three terrains and two chase orders. Together with the
original seed, V5 has 36/36 such full-route cases with complete
decisions, intermediate passages and finish crossings. This
expands same-input coverage; it does not certify all possible
orders, contact cases or an official sprint classification.

`shared-road-km-15`, `fixed-lane-finish-2` and `general-race-6`
are an opt-in finish experiment. The final shared-road kilometre
stops with its paid front at 300 metres to go; solo riders who
already crossed the true finish remain frozen at their paid
crossing. The finish continuation then advances every remaining
rider to the actual line in quarter-second steps. A rider is
eligible to choose a sprint only if the committed team stake
names that rider as sporting captain with `sprint_finish`.
The V2 finish rejects a sprint stake that names another team's
rider, so one team cannot spend a different captain's reserve.
The choice records actual reserve and an exposed-work quote.
Insufficient reserve yields a `hold_sprint` decision. A paid
sprinter accelerates according to their finale ability, ordered
effort and remaining reserve, is charged for every travelled
metre, and may enter one adjacent clear lane per step. Changes
of lane and measured overtakes are separate versioned events;
pass observations carry cumulative sprint distance and cost.
Crossings whose model clocks differ by at most one microsecond
are marked as unresolved finish-clock ties; the stable rider-ID
sort used to serialize crossings must not be read as an official
placing between those riders.
Every rider gets one recorded finish choice, including riders
who crossed early. The old fixed-lane finish remains unchanged.
In a synthetic 16-rider, 20 km race an explicitly committed
sprint captain makes a paid pass and reaches the line first.
Another fixture refuses an exhausted captain, and a two-team
fixture records both captains' independent paid choices. Full
record replay rejects a forged pass clock. These fixtures are
noncanonical. The new finish is not an official classification:
the choices and lane model need whole-race, all-category and
larger-field calibration, finish-tie validation and game-result
integration before any awards or guided-race use.
The current 120-rider Motor Lab input matrix (one seed, both
categories, three terrains and two chase orders, selective attack)
completes and exactly replays all 12 V6 positional recordings.
Every case has 14,400 kilometre decisions, 14,280 intermediate
passages and 120 finish crossings. The source probe also completes
and replays all 12, but eight cases differ in front leader and all
12 differ in at least one attack-choice detail. These inputs have
`none` or `summit_attack` stakes, so none exercises a paid sprint.
The deliberately synthetic 160-rider, 120 km, two-weak-worker
fixture with 20 explicit `sprint_finish` stakes completes and
exactly replays 19,200 decisions, 19,040 intermediate passages,
160 finish crossings, 20 paid sprint choices, 11 lane-entry
observations and 281 overtake observations. The V6 record
also exposes one unresolved model-clock tie rather
than silently assigning a placing from the serialization order.
Its source
group-clock probe refuses a peloton/rear crossing at km 120
without recorded paid contact. This is an exposed source-model
limit; the positional finish must not be used to overwrite that
source recording or publish an official result.
A separate six-case 120-rider stake-variation audit explicitly
changes every team goal to `sprint_finish` on the current Motor
Lab fixture (both categories and all three terrains, no attack).
This is labelled a synthetic stake variant, not the unmodified
Motor Lab generator output. Both source and V6 position models
complete and replay all six; V6 records paid sprint passes in
all six with full decision, checkpoint and finish coverage.
