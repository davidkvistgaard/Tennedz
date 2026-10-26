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
