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
