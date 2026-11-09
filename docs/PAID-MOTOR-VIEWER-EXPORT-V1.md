# Paid Motor Lab viewer export v1

`exportPaidMotorRaceToViewerV1` in `lib/viewer/paid-motor-race-export-v1.mjs`
is the server-side bridge from a committed physical Motor Lab race to
`pelotonia.viewer.v1`. The caller supplies the measured start bunch, every
route kilometre, committed teams and rider orders, sporting stakes, seed,
category, race ID and committed team styles. It does not create those inputs.
It also requires a complete, unique mapping of race bib numbers; those
numbers cannot be reconstructed from finish order. The synthetic fixture
allocates and labels its own test bibs explicitly.

The bridge runs the physical race (or accepts that same committed paid
recording), checks its input commitment, replays every rider and kilometre,
then exports crossing clocks, recorded paid contact, group membership and
unofficial finish evidence. It rejects missing orders, partial races and
recordings that differ from the supplied input. The existing 120 km synthetic
Motor Lab viewer fixture now uses this same bridge; a separate 2 km fixture
tests the boundary independently of its fixed route.

The emitted `source` identifies the probe version, seed, commitment hash and
validated rider-kilometre count. `teamKitSource` records where the supplied
styles came from; `riderNumberSource` records bib provenance. The adapter
emits zero lateral lane offsets and a clearly
schematic straight distance axis because the motor does not record precise
lanes or canonical geography. Between paid crossings and contacts,
longitudinal distance is interpolation. The finish evidence records paid
clock and road only; it does not award official places or points.

New exports carry `motor-lab-paid-finish-v2` evidence. `clockGroups` is
copied from the independent Motor Lab race recorder after the full replay:
each group contains the exact measured crossing clock and the riders sharing
it. `unresolvedTieRiders` counts riders in groups of two or more. The
document seal verifies that every group and clock matches the crossing list.
Historic `motor-lab-paid-finish-v1` documents remain readable. The viewer
shows a shared-clock group instead of an arbitrary first-ten ranking and
explains that names within the group have no recorded finishing order.
In a 20-team flat test race, all 160 riders share one paid bunch clock; the
motor has not recorded an individual sprint or tie-breaking result.

This is **not yet an official game race export**. The current live entry saves
eight selected riders and a captain, but no tactical orders or sporting
stakes; its official cycle still calls `simulateStage`, and its replay uses
strategic phases. A future official producer must commit actual player and
rival orders, explicit stakes and the complete route before calling this
bridge. Historic recordings should remain readable under their original
version. The physical V94 path stays experimental until whole-race
calibration and production release checks pass.
