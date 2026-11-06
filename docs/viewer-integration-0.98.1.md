# Pelotonia Viewer 0.98.1 integration — default Motor Lab screen

The independently packaged `@pelotonia/race-viewer` is installed from
`vendor/pelotonia-race-viewer-0.98.1.tgz` (SHA-256
`7afceef5fd9bd5c0e59ef382aca8e665327509ec0d560db7d369df16a0740212`).
The kit's older native adapters are unused. The new, versioned
`physical-first-to-pelotonia.viewer.v1-1` adapter consumes current committed
physical-first Motor Lab inputs and paid probe output. The motor is unchanged.

The authenticated `/team/motor-lab` route opens the new viewer by default.
`/team/motor-lab/engine` preserves the guided or legacy Motor Lab controls.
`PELOTONIA_VIEWER_V1_ENABLED=false` restores those controls as the default
and disables the new viewer's clock endpoint. The old official race viewer
remains the fallback for actual game runs because they do not supply this
viewer's required rider positions. In development only, setting
`PELOTONIA_VIEWER_V1_PREVIEW_ENABLED=true` enables unauthenticated local
acceptance routes at `/viewer-acceptance`, `/viewer-acceptance/inspection`,
and `/viewer-acceptance/stress`.

## First recorded race

The fixed `preview-recorded-road-1` seed generates a 40 km flat one-day
physical-first race with four fictional teams and 32 riders. Men and women
are separate fields. The motor supplies every kilometre's paid road leader,
clock, rider set, common road distance, and route elevation. Independent
energy/road replay validates all 1,280 rider-kilometres in each field.
The adapter emits 41 boundary frames and releases each paid leader event at
the end of its kilometre, never at the start.
The viewer interpolates visually between boundaries; these interpolated
locations are **not** additional measured motor positions.

The preview clock is anchored to the same UTC hour for all spectators, runs
at 1×, and holds the finish until the next hour. The API returns server time
for clock offset estimation and refreshes every five seconds. Camera target
is browser-local. Commentary and route profile use the same viewer time;
events after that time are withheld. No result or winner is supplied.

## Coverage and boundaries

| Datum | Preview source | Limitation |
| --- | --- | --- |
| Rider identities and separate fields | Current Motor Lab test teams | Fictional test identities, not player clubs |
| Team clothing | Game kit catalog allocation | Helmets and official classifications unavailable |
| Position and time | Paid road boundary states | No within-km sample or rider-specific lane; all lanes use centreline |
| Groups | One connected `peloton` | Split roads are rejected; no group gap is treated as a simultaneous position |
| Route and elevation | Recorded kilometre elevation | Straight schematic distance axis; no canonical geography or atlas |
| Actions and commentary | Recorded paid leaders and finish event | No inferred attacks, orders, chase, or future events |
| Results | None | No invented placings, awards, or winner |
| Assets | None | Renderer uses its built-in scene; atlas and game assets remain pending |

This fixture demonstrates end-to-end playback only for a connected field.
It does not establish correctness for breakaways, drops, contacts, changing
groups, guided races, full-sized stages, or official results. The current
guided Motor Lab output has group time gaps but lacks simultaneous
rider-specific positions. The adapter intentionally refuses to convert
those gaps into precise coordinates. It also cannot export a 160-rider field
because the package contract limits a feed to 150 riders.

## Verification gate

Unit tests validate the installed contract, start/mid/finish samples,
commentary chronology, result absence, split-road refusal, shared clock,
and separately labelled synthetic 30/150-rider feeds for both categories.
The synthetic stress feed fabricates riders, lane offsets and spacing only
for renderer testing and must never appear as Motor Lab race data.
Browser WebGL, camera, asset failure, and performance observations should
be recorded separately from contract tests. A WebGL renderer label or CPU
fallback alone is not GPU certification. Actual game races remain on the
legacy viewer until a real full race with splits and official result coverage
passes the same checks and authenticated browser validation.

Local development browser acceptance on 2026-11-06 showed actual 32-rider
men's and women's previews in WebGL, with the recorded 0 km and 40 km
boundaries displaying 40.0 km and 0 m remaining respectively. The start
showed only the start event; the finish showed the recorded finish event and
no invented result. Synthetic stress frames rendered 30 men (~95 fps),
30 women (~87 fps), 150 men (~56 fps), and 150 women (~50 fps) on this
browser/machine. A deliberately missing, referenced glTF produced one asset
error while 150 riders continued rendering. These are local observations,
not a hardware-wide or production performance guarantee. No authenticated
production browser check has yet run.

The Motor Lab and live production branches diverged after their common
production commit. Publishing the Motor Lab branch directly would also
publish its unrelated engine history and replace newer production-only
changes. A separate release integration is required before tennedz.eu can
use this as its default Motor Lab screen.
