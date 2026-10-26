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
