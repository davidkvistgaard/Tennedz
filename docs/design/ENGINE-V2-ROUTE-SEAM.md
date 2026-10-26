# Route-independent rider motor and stage overlay

The v2 candidate has three distinct inputs:

1. `prepareRaceParticipants` canonicalizes teams, riders, sporting skills, form,
   fatigue and leadership without reading a stage. It also retains the team's
   proposed orders; it does not choose an outcome.
2. `commitParticipantsToStage` validates those orders against the loaded
   stage's distance and legal tactical markers, then creates race-local energy
   and decision state. The same participants may be committed to another stage.
3. `buildKilometreRoute` supplies the stage overlay: elevation, terrain, road
   surface, exposure and locked local weather. `prepareRiderReadiness` is
   stage-independent; `applyStageConditions` combines that readiness with one
   route segment. It never rewrites stored rider skills or team orders.

The current simulator still resolves the race one kilometre at a time and
passes each route segment into tactical and movement calculations. The seam
above is a refactor of existing v2 behavior, **not** a claim that the motor is
fully route-independent or that all final wheel contacts are resolved.

Managers may now commit a phase at every 5 km marker or an existing route
keypoint. The phase applies in the following kilometre. This is a tactics
interval; it does not average away route features shorter than 5 km. Today's
stage model has kilometre segments and point keypoints, but does not yet have
explicit named climb start/end spans or sub-kilometre road and weather spans.
Those belong in a later versioned stage-data contract, with replay evidence
showing which condition affected each rider decision and movement.

The fictional four-team Motor Lab now lets a manager move its single timed
effort change to any 5 km marker. Its replay shows the committed order in
force beside that kilometre's terrain, road surface, wind and rain, recorded
Amber chase/attack actions, and changes in gap and mean energy. The panel
reports observations rather than asserting that any one action caused a gap
change. The other late chase/attack controls still switch at 120 km. Motor
Lab remains a fixed-route exercise, not a stage editor or a universal finish.

Existing recordings retain their stored route, orders, frames and result
contracts. The viewer reads those frames; playback never reruns the motor.

The supplied `LBL25_Profil.jpg` is used as a concrete stage-shape check in
`engine-v2-foundation.test.mjs`: approximate labelled distance/elevation
points span 252 km without changing rider settings. The sparse labelled
elevations yield hills and descents but **no climb segment**, despite steep
short climbs shown in the picture. Its graphic does not specify wind, weather, road surface or
precise climb boundaries, so the test supplies illustrative weather and does
not present itself as an exact 2025 race simulation. A short climb can still
be blurred by today's one-kilometre segment model; the image is useful for
exposing that limitation rather than concealing it.

## Stage overlay v3 data contract (preview, not yet paid by motor)

A separate 'stage-overlay-v3.mjs' contract requires explicit surface,
exposure and weather for every 5 km tactical interval, including a shorter
final interval. The caller must label the condition source as observed,
simulated or illustrative. It accepts bounded, fractional-kilometre feature
spans for climbs, descents, sprints, landmarks and road changes. Looking up a
position returns its interval and all active feature spans; a 0.9 km climb
therefore survives a 1 km boundary. These spans and interval conditions are
stage data, never rider settings.

The contract is deliberately separate from 'buildKilometreRoute' version 2.
Existing recordings and race movement still use paid 1 km route segments;
v3 features currently describe input geography only and do not claim to
alter rider energy, tactics or results. Motor consumption will need an
independently versioned transition and replay evidence before a short climb
can change a rider's movement. The LBL image illustrates why this matters,
but does not provide exact feature boundaries, road conditions or weather;
the v3 unit example is synthetic rather than a claim about Liège 2025.

The v3 contract can also split a single kilometre at each feature boundary
while conserving total distance. This prepares a future motor step to pay
movement and energy on the actual short span. It is a data slicing operation,
not a simulation: no v3 slice currently changes a recorded race.

Optional, non-overlapping condition spans can replace the five-kilometre baseline on exact fractional-kilometre road sections. Each span supplies its own surface, exposure, weather and provenance; missing weather or overlapping spans are refused. Per-kilometre slices split at both feature and condition boundaries, so a short climb and a short exposed or rough-road section can coexist without losing their distinct lengths. These are still stage input and read-only lookup data: v2 movement, energy and replay do not yet consume these slices.

A separate v3 **isolated rider calculation** now evaluates a kilometre one bounded slice at a time. It applies the existing rider-readiness and stage-condition formulas to each slice, scales effort work and baseline road-clock time by its actual distance, and carries energy into the next slice. A synthetic 0.6 km climb with a 0.2 km rough, exposed section produces different work and baseline road time from a flat kilometre while leaving the stored rider unchanged. It refuses overlapping topographic features, missing or incorrectly signed gradients, and exhausted energy that would need coasting. This diagnostic does **not** run tactics, recovery, drafting, group timing, contact, replay or finishing; it is not yet a whole-race motor continuation or user-facing result.

A separate preview-only v3 step now advances **two distinct cooperating solo bands** through the precise slices of one kilometre. It uses existing solo skill weights and bounded road-group drift tuning, charges each rider for working alone, and records positive separation and energy on each paid slice. A short climb can therefore change their relative gap as well as their energy. If the projected gap closes within a slice, the step stops at that slice’s start and returns an unresolved-contact interval; it does not interpolate an occupied-wheel pass, spend energy beyond the paid boundary, or produce a place. This is a bounded two-rider diagnostic, not the whole-race group motor: drafting, recovery, attacks, multi-rider groups and the finale remain outside it.

A separate preview-only two-solo **stage replay** now composes those paid slices across a complete synthetic stage with explicit baseline terrain for every kilometre. It accepts precommitted effort changes at 5 km markers, applies them from the following kilometre, and records the active effort, road conditions, exact feature ids, positive separation and both riders' energy at each paid slice. The short climb and precise rough section therefore remain visible in the same replay as the effort change. It refuses a possible contact before charging the first unpaid slice and never creates classified places or points. Only two already-separated cooperating solo riders are supported: no attack launch, drafting, recovery, multi-rider group, occupied-wheel response or official finish is inferred. It is not routed to Motor Lab or production.


The internal v3 separated-solo replay now carries three to eight already-separated
cooperating solo lanes simultaneously across the same fractional stage slices.
Each rider pays energy once per slice; adjacent positive gaps are updated from
their paid abilities, and any possible adjacent contact refuses the first unpaid
slice without charging any lane for it. Precommitted 5 km effort markers are
recorded in the stage replay. This is a narrow synthetic evidence path: it does
not form attacks or groups, model drafting/recovery, resolve wheel contact,
classify the line, or change guided Motor Lab or old v2 recordings.


A separate internal v3 fixed-two-group slice step now uses the existing
cooperation bonus and rotation-relief coefficients on precise stage slices.
Both groups start separated, retain the same member rosters, and all members
work cooperatively. Every worker pays individual energy once; the group clocks
produce only a positive inter-group gap. If that gap could close, the first
unpaid slice is refused without charging any member. Internal wheel positions,
drafting, attacks, recovery, merges, official results and guided routing remain
unresolved. This calculation has no effect on saved v2 races.


The same bounded fixed-two-group clock can now replay a complete synthetic
integer-kilometre stage, carrying each member's energy and the positive
inter-group gap across every precise feature/condition boundary. Precommitted
group-wide 5 km effort changes take effect in the following kilometre. A
possible group catch stops at the first unpaid slice and returns no classified
result. Group membership and cooperative work remain fixed throughout; this is
internal evidence, not a replacement for the v2 whole-race tactics/attack,
drafting, recovery or contact systems.

For a homogeneous one-kilometre road with no short features or condition
overrides, the v3 fixed-group clock now has a cross-version audit against the
existing v2 cooperative road-group pace and exposure costs. Two-, three- and
five-worker groups on flat, climbing and exposed rough roads agree within the
v2 clock's two-decimal-second rounding. This anchors the slice model to the
published group coefficients; it does not validate formation, internal wheel
positions, recovery, attacks or a whole-race result.

Another internal, separately versioned v3 path accepts a declared pull and
drive roster for each of two fixed road groups. It pays each worker or sitter
once on every precise slice using the existing v2 rotation, sit-on and drive
coefficients. A homogeneous one-kilometre case is checked against v2's
mixed-work group clock. A synthetic 20 km replay can change that declared
roster after 5 km markers and records condition provenance, work, energy and
positive group gaps at every short feature boundary. It stops before the first
unpaid possible group contact. The caller must supply the actual worker roster:
this path does not select attacks, position riders inside groups, decide
drafting, recover energy, merge groups, classify the line or alter guided races.

A further internal, separately versioned slice clock now accepts three to
eight **already separated** road bands. Each band may contain one to five
riders, so a solo can be evaluated between two declared-work groups without
replacing either group's paid roster. The solo must pull, each rider pays once
at every short feature/condition boundary, and all neighboring gaps advance
from the same slice. If any neighboring gap might close, every band stops
before that slice is charged and the possible contact pair is reported. Its
two-group component agrees exactly with the preceding fixed-group v3 clock
in a neighboring regression. This does not launch the solo's attack or infer
an initial split, internal wheel position, draft, catch, recovery, official
place or full-race result. Guided Motor Lab does not consume it yet.

The same already-separated mixed bands can now replay a complete synthetic
integer-kilometre stage. Explicit work-roster and band-effort changes activate
after their 5 km markers; the replay records the active orders, each short
slice, per-rider work and energy, and both neighboring group-clock gaps. A
possible catch stops every rider before the first unpaid slice. This still
requires a separately paid attack/split handoff before a solo can enter the
middle lane, and it has no group membership changes, draft, catch resolution,
classified finish or guided user route.

A bounded v2-to-v3 diagnostic handoff now validates an entire saved v2
laboratory recording and accepts a checkpoint only **after** a paid, recorded
road-group split kilometre. It transfers exactly the recorded road groups,
positive adjacent gaps, committed rider skills, next-kilometre effort and
post-kilometre energy into the internal mixed-band replay. The old split's
attack/defense costs are already in that energy and are not charged again;
the replay starts at the following kilometre. A locked 40 km three-team case
passes this seam with the attacking solo between two older road bands. It
still uses an explicitly supplied v3 overlay for future conditions and an
explicit future work roster; it does not retroactively locate the attack
inside the completed v2 kilometre or replace its saved recording. No
user-facing v3 result is produced.

The handoff regression also reuses the **same** validated rider/energy/gap
state with two separately supplied illustrative future condition overlays.
Its committed riders and starting road remain byte-for-byte equal, while
exact-slice work differs on rough exposed road. That demonstrates the intended
participant-versus-stage seam for this bounded step, not whole-race route
independence or verified weather for Liège–Bastogne–Liège.

The internal mixed-band clock also treats a rider who cannot pay an exact
slice as an explicit unresolved exhaustion case. It names the rider and the
first unpaid span, retains every earlier paid frame, and leaves **all** bands'
energy and gaps at that span's start. The synthetic stage replay propagates
that refusal rather than implying a coasting or recovery response. No official
place or award follows from it.

A separately versioned **complete stage input** now packages the v3 short-slice
overlay with a terrain, gradient and provenance entry for every whole
kilometre. A read-only continuation validates a saved v2 split, then passes
only its already separated road bands to the internal v3 replay using that
single stage package. This prevents a caller from silently combining one
stage's terrain with another stage's road and weather. In the locked split
case, changing the explicit future terrain changes the paid road clock while
the saved participants and recording stay unchanged. The bunch and older
drops are outside this bounded clock; it produces no whole-race result or
official awards and is not wired to guided Motor Lab.

The continuation now reports exact source-rider coverage as part of that
boundary. In the locked three-team case, all 24 riders are accounted for at
the handoff, but only the already separated road-band members advance in v3;
the remaining rider IDs, source groups and source energy are listed as
unadvanced. The diagnostic explicitly marks whole-race coverage false. It
cannot be interpreted as a finish for the field.

The v2 saved frame does not retain the quiet-kilometre counter, energy cap,
consecutive low-kilometre counter, attack load or active team-response
state. Reconstructing bunch recovery, dropped-rider movement or the next
attack from energy and group labels alone would invent motor state. An
**opt-in internal v3 handoff-state trace** now captures those rider values and
selected team-response fields at each
paid kilometre boundary alongside an unchanged v2 recording. The normal
simulator still returns the original recording shape, and the trace is a
separate versioned sidecar. It is evidence for future transition work, not a
v3 bunch clock, a saved recording migration or a whole-race continuation.
The exact recording object issued by that opt-in run can retrieve a detached
copy of its state at a paid kilometre boundary during the same process.
Modified, serialized, copied and ordinary v2 recordings are refused, because their
hidden counters cannot be authenticated from the saved frames. Editing the
inspection sidecar cannot change the issued state.

A separate same-run issued-road audit joins that trusted hidden state to a
validated paid v2 split. It checks each rider's identity, team, road group,
energy and deficit against the saved frame, and checks the active team
leaders. Its output accounts for every rider: one list for already separated
road bands eligible for the bounded v3 clock and another for riders outside
that clock, with their hidden counters retained but no movement applied.
The locked 24-rider example still reports `wholeRaceCovered: false`. This
handoff requires the original in-process recording object; it cannot turn an
older saved v2 recording into a trusted bunch or dropped-rider continuation.

The separate internal v3 recovery projection checks every fractional slice
before awarding the existing once-per-kilometre quiet-bunch recovery. A short
steep climb or rough exposed stretch anywhere in the kilometre resets the
quiet counter; a uniformly calm kilometre matches the v2 recovery rule.
Overlapping topography refuses. This projection applies neither recovered
energy nor the rider's cap. A separate settlement accepts paid post-work
energy and an explicit current capacity, then reports applied recovery and
the amount lost to the cap. Neither step advances bunch or dropped riders,
calculates a new cap, or authenticates a saved recording.

A third internal projection applies the existing long-day capacity-decay
formula after 160 km to each exact stage slice. A short steep or rough section
changes only its fraction of that kilometre's cap loss; a homogeneous
kilometre agrees with the v2 rule, and the capacity floor remains in force.
It does not pay work or recovery, update a rider, or resolve road contact.

An opt-in, separately versioned fixed-road-band clock now applies that
capacity decay **with** each rider's paid work on the same exact slices. The
bounded stage replay carries both energy and capacity into the next
kilometre, so long-day capacity loss can change later group gaps. A possible
contact or exhausted rider stops every band before the first unpaid slice,
preserving previously paid frames, energy and capacity. The old fixed-band
clock and replay shapes remain unchanged. This still only advances already
separated fixed bands: quiet-bunch recovery, attacks, drops, changing group
membership, occupied wheels, the riders outside the eligible road bands,
and a whole-race classification remain unresolved. It is internal preview
evidence, not a guided Motor Lab result or a deployed v3 motor.

A same-run continuation now binds that capacity replay to a v2 recording's
authenticated paid split and a complete future v3 stage input. It carries
the issued capacity for each rider in the eligible separated road bands,
while listing every other source rider and hidden state as unadvanced.
Copied or ordinary saved recordings are refused because their capacities
cannot be authenticated from visible frames. The locked 24-rider source
therefore still has `wholeRaceCovered: false`; the continuation cannot
produce a whole-race line or awards.

### Gate for a whole-field v3 continuation

The next integration must advance **every** rider from one authenticated
same-run boundary, or stop without presenting a finish. A road-band clock
cannot be treated as a race clock while the bunch and older dropped riders
remain at their source energy and position. The source-side coverage audit
should be repeated after each paid kilometre and must name any unadvanced
rider; `wholeRaceCovered` can become true only when the advanced IDs equal
the committed field exactly once.

The missing transition is more than energy accounting. V2 selects attacks,
helpers, shelter and team responses at whole-kilometre boundaries; it then
computes the bunch reference from attached riders and updates each rider's
consecutive low-kilometre counter and deficit once for that kilometre.
Recovery and leadership responses also use that whole-kilometre state. A v3
slice may pay terrain-dependent work and road time, but it must not silently
run those decisions once per slice or infer them from a saved group label.
The continuation needs an explicit boundary rule for each decision, paid
movement and energy for the bunch and every dropped rider, and a refusal at
the first unpaid slice wherever a road band could meet another band or the bunch.
The current fixed-band clock cannot supply those rules by increasing its
five-rider membership limit.

A separately versioned, internal **one-kilometre quiet-bunch step** now
advances all 32 riders from an authenticated same-run paid checkpoint. It
requires a single attached bunch, steady/no-attack/no-chase balanced orders,
no pending team response, no recovery or long-day capacity decay, and no
group departure. All riders pay every exact short stage slice; the bunch
reference and low-kilometre state are updated once after those slices.
Across three homogeneous 40 km seeds, its next-kilometre rider work, energy,
and group state match the existing paid v2 frame. An illustrative 400 m
climb within that kilometre changes every rider's paid work without adding
a tactical decision. Saved or copied recordings, a possible drop, and any
dynamic order refuse. This is **one complete field step**, not a whole-race
clock, contact resolution, official result, or guided Motor Lab feature.
The same quiet-field rule now carries all 32 riders across ten interior
kilometres from one issued checkpoint. When each kilometre's simulated
conditions match the source race, every rider's energy and group state
matches the ten paid v2 frames. An illustrative short climb changes later
energy while earlier frames stay identical. If topography becomes ambiguous,
the entire unsupported kilometre is rolled back and earlier fully paid
kilometres remain; partial work within that kilometre is not exposed.
This replay still has no attacks, front work, shelter, recovery, drop,
occupied-wheel position, finish or official award, and is preview-only.
An independently versioned replay can also take declared team-wide
`steady`/`hard` effort changes at future 5 km markers. The marker changes
the following kilometre, not the marker kilometre. A late 40 km case
matches a separately paid v2 hard-order recording for all riders through
the interior kilometres; another case shows a hard order followed by a
return to steady. These hypothetical future orders are **not yet bound to
the source recording's authenticated manager plan**. Neither replay can
serve as a player result until the order commitment, dynamic group decisions,
and finish are integrated and verified.
A third internal replay version reads only future effort phases already in
the exact, unchanged same-run v2 recording's committed manager plan. It
requires each phase to contain only a `steady` or `hard` change at a 5 km
marker; an attack phase refuses. The locked km 35 hard order activates at
km 36 and its 32 rider states match the separately paid v2 ordered race
through km 39. Copied recordings refuse because the issued hidden state
cannot be authenticated. This closes the order-commitment gap only for the
quiet-field case; it does not validate dynamic tactics or a finish.
A fourth internal replay version admits a committed `conserve` phase. It
pays every short slice, then decides quiet-bunch recovery **once for the
whole kilometre** and settles it under the authenticated 100-point reserve
ceiling. A short climb cancels that entire kilometre's recovery and resets
the quiet counter. On a homogeneous 40 km route, all 32 rider energies,
group states and quiet counters match v2 across nine post-order kilometres;
another 20-kilometre comparison includes the point where recovered energy
hits the ceiling. This does not yet handle long-day cap decay after 160 km,
front work, shelter, attacks, any drop, or an official finish.

A fifth internal replay version adds authenticated long-day capacity decay
to that same quiet-field transition. Work and capacity are paid over exact
stage slices before the once-per-kilometre recovery settlement. Starting
from a same-run km 160 checkpoint in a synthetic flat 260 km race, all 32
riders' energy, capacity, quiet counters and group states match v2 for 99
interior kilometres; an illustrative 400 m climb increases only its share
of cap loss. A separate committed km 165 `conserve` scenario matches v2 for
20 kilometres while recovery and capacity decay operate together. This is
still an internal quiet-bunch replay: no attacks, front-work rotation,
shelter, drops, inter-group contact, finish or official awards are inferred.

Before routing v3 to guided Motor Lab, verify a complete source field and
energy ledger at every replay boundary; homogeneous-kilometre parity with
v2 for work, cap, recovery, bunch/drop state and group clocks; a fractional
climb that changes paid work without changing the number of tactical
decisions; atomic rollback on possible contact or exhaustion; and a
conditional line for every rider with official classification withheld when
wheel order remains unknown. A stored v2 recording without its issued
hidden-state sidecar must still refuse this handoff.
