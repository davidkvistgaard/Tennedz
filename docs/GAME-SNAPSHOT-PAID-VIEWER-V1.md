# Game snapshot to paid viewer v1

`createGameSnapshotPaidViewerDocumentV1(snapshot, manifest)` is an
experimental, server-side integration boundary. It accepts the shape of
`recovery_race_snapshot` for one-day events and a separately committed,
versioned manifest with tactics and presentation identity for every team.
It does not change the official race cycle or existing recordings.

The snapshot supplies the actual event ID, category, seed, game date, stage
profile, locked weather, participating teams, selected riders and captain.
The manifest must match that event and every participating team exactly. Each
entry must supply normalized tactical orders (including baseline effort,
attack, chase and front work), sporting goal and captain, game team style,
and one unique positive race bib per selected rider. Missing fields,
conflicting captains, injured or wrong-category riders, duplicate bibs and
unknown manifest fields are rejected. The route comes from the motor's
`buildKilometreRoute`; the start reserve comes from the motor's replayable
energy cap. The paid race export then verifies every rider-kilometre and
produces `motor-lab-viewer-document-v2`.

The resulting viewer document labels `officialResults:false`. Paid finish
clocks are evidence, not official places, points or awards. The adapter's
longitudinal coordinates between recorded crossings are interpolation; lane
offsets and geography remain unavailable. Tests cover complete 20 km
game-shaped races for men and women and refusal of missing tactics, bibs and
an injured selected rider. These are fixtures, not production races.

The current database entry and `recovery_race_snapshot` **do not yet carry**
the required tactical manifest, game bib assignment or style snapshot. The
official `buildRace` still invokes the earlier `simulateStage` and awards
official points from that engine. Connecting this boundary to official races
requires storing those missing inputs atomically, validating full-race
calibration and finish semantics, then versioning the official cycle and
preserving historic runs. This module must not be used to fabricate those
inputs from the old strategic replay.
