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

Migration `20261109131922_committed_physical_entry_inputs.sql` adds an
optional, locked entry transaction that saves the normalized team order,
sporting stake and game kit with the selected lineup. The database allocates
unique positive race bibs and preserves them on an identical resubmission.
The private table has RLS enabled and no client grants. The companion
`/api/event/join-physical` endpoint is disabled unless
`PELOTONIA_PHYSICAL_ENTRY_ENABLED=true`; it validates the manager input,
reads the saved game kit and uses the atomic RPC. The legacy entry path remains
available. PGlite tests verify the transaction, bib assignment, rollback
and revoked anonymous grants. The migration has **not** been applied to the
hosted database.

The current `recovery_race_snapshot` still omits these new fields, and no
game UI writes the new entry yet. The official `buildRace` still invokes the
earlier `simulateStage` and awards official points from that engine.

`manifestFromCommittedPhysicalEntriesV1` now assembles the private saved
entry rows into the exact manifest above, checking the event, every team,
selected rider order and captain against the current game snapshot.
`createPhysicalGameRaceDocumentV1` uses the official engine's current seed
and deterministic weather fallback when those values are not yet locked,
and labels that provenance in the document. It never stores weather or
publishes official results. `loadPhysicalGameRaceDocumentV1` rereads the
game snapshot after the private rows and rejects a changed source.

An administrator-only GET at
`/api/admin/physical-viewer-preview?event_id=<uuid>` exposes this transport
document when `PELOTONIA_PHYSICAL_VIEWER_PREVIEW_ENABLED=true`. It uses the
existing deadline-guarded snapshot RPC, so it cannot preview an open race
before its deadline. Both flags are off by default; the hosted migration has
not been applied, and no actual game race has yet completed this path.
Until the tactical entry UI saves physical inputs for every participating
team, this route correctly refuses the old incomplete entries.

Connecting this boundary to official races requires reading a consistent
physical input snapshot, committing seed and weather, validating full-race
calibration and finish semantics, then versioning the official cycle while
preserving historic runs. This module must not fabricate those inputs from
the old strategic replay.
