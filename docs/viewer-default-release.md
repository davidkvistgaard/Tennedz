# Viewer default release

This release starts from production commit
`817da900cba6673a0ad645f24d36eceb6f9fb82f` and adds only the viewer
package, two immutable Motor Lab recordings, the shared preview clock, and
the Motor Lab screen. It does not merge the experimental motor branch.

The recordings were generated and independently replayed from Motor Lab
commit `21d1fbf84f571b5155d937296a6c87bfa92b8510` using adapter
`physical-first-to-pelotonia.viewer.v1-1` and seed
`preview-recorded-road-1`. They cover 40 km, 32 riders, and 1,280 paid
rider-kilometres per separate gender category. The viewer shows one
connected peloton. The data contains no rider lanes, exact within-kilometre
positions, geographic route, helmets, assets, or official placings.
Intermediate animation is interpolation between recorded kilometre
boundaries. No Motor Lab sample is substituted for an official game race.

`/team/motor-lab` opens the new viewer, while
`/team/motor-lab/engine` preserves the motor laboratory.
The recorded Motor Lab test race, with clearly labelled synthetic scenery, is
also available without a game account at `/viewer`, so collaborators can
inspect rendering before the preview environment has team data. Its separate
public clock uses the same server-derived race cycle; it exposes no account
or official race information. The wholly fictional visual fixture is available
only with `?mode=exhibition`.
Preview clock version `motor-lab-preview-clock-2` holds the recorded finish
for 15 seconds of presentation time before restarting. It does not extend
the race or add a sporting time limit; all spectators use the same server
cycle, and their camera choice remains local.
The old race viewer and its scene implementation have been removed. Actual
game race recordings at `/team/view` retain their recorded reports and results,
but cannot be played in 3D until the race engine records simultaneous rider
positions. The route explains this limitation and never substitutes the
fictional Motor Lab sample for an official race. Authentication remains active.

The sample clock is anchored to a server-derived race-duration cycle and shared
by spectators, while
camera choice stays local. Commentary follows recorded events and does not
reveal the next kilometre's paid leader at its start. The production release
requires an authenticated browser check and exact deployment SHA, READY,
alias, page, JavaScript and runtime checks before domain promotion.

## Race theatre presentation

The viewer shell in `ViewerPreviewScene.js` adds the race group bar, distance,
camera controls, rider and team details, route profile, commentary, and shared
timeline around the installed `@pelotonia/race-viewer` renderer. Its visual
style follows the supplied ChatGPT Work screenshot. It uses the package as a
module; the kit's demo application is not part of Tennedz.

`motor-lab-scenic-study-2` adds only flat terrain, generated roadside trees,
grass, spectators, and a finish structure to the recorded 40 km Motor Lab
sample. Two foliage textures come from the supplied Viewer Integration Kit
0.98.1 (`source/public/assets/alpine-spruce-v1.png` and
`alpine-larch-v1.png`). The scene has no canonical geography. The adapter
recording, rider identities, kilometre boundaries, group membership, events,
orders, and results are unchanged; tests compare the original and scenic
sampling. The recording places all 32 riders at the same longitudinal road
position within one peloton and has no lanes, so the 3D view cannot display a
real spread-out peloton or multiple groups from that source.

`viewer-visual-exhibition-2` is a separate, explicitly fictional four-minute
visual fixture at `/viewer?mode=exhibition`. It shows leaders, a chase group,
peloton, and a dropped group to demonstrate the intended screen and camera
with the same men/women roster identities. Its route, positions, gaps, events,
and scenery are invented for viewer development and never used as Motor Lab
race facts or official results. It has its own shared clock and no winner.
The recorded Motor Lab view remains the default `/viewer` mode.

Local browser checks on the 32-rider men and women fixtures showed WebGL
rendering, group and rider controls, route profile, time-matched commentary,
and roughly 35–55 displayed frames per second after loading in the test
browser. The displayed renderer mode alone does not establish hardware GPU
acceleration. Synthetic 30- and 150-rider stress fixtures are separately
available with `mode=exhibition&field=30` and `field=150`; `asset=missing`
selects a deliberately unavailable tree texture to check failure handling.
These parameters never alter the Motor Lab recording, and all added rider
identities are labelled synthetic. The exact-SHA preview
`a129e7d27aab087b18897386bc5d611ef837d145` rendered 150 women riders
and all four fictional groups in WebGL. The observed viewer counter was
approximately 19 fps after reducing synthetic tree density and finish crowds.
This was below smooth-playback approval. The 30-rider men fixture with
`asset=missing` reported one failed scene asset, retained WebGL rendering, and
continued the shared replay with fallback. No official race result was
generated. The package automatically creates a dense finish crowd whenever
crowds are enabled. In this preview it created 2,202 spectators and about 4.2
million triangles; CPU frame median was 3.4 ms while the displayed rate was
about 19–23 fps. Commit `312df9f3442530c2a3b3620707af2d63baf93847`
disables that optional synthetic crowd only for the 150-rider visual fixture.
The same protected browser then displayed about 48–50 fps for 150 men and
47 fps for 150 women, with zero spectators, about 1.2–1.3 million triangles,
and CPU frame median 3.3 ms. Commit `557398c6b74ecd4f317136be957003025d73c004`
adds a bounded set of 240 static spectators to the 150-rider fixture. On
exact-SHA preview `b838196cb6a281c4cd85c2c7230fd610d4f67fb0`, the
spectators were visible on both sides of the road; the 150-rider men and women
fixtures each displayed about 40–43 fps with about 1.5–1.7 million triangles
and no runtime errors. A WebGL2 diagnostic identified the test machine's
renderer as ANGLE on Intel UHD Graphics via Direct3D11, so this is a
hardware-backed browser check on that one machine. The viewer's `crowdCount`
diagnostic remains zero because it counts the disabled dynamic crowd rather
than the 240 static feed spectators. Four fictional groups, local camera
choice, shared timeline, and time-gated commentary remained available.
Other devices still require their own performance checks.

The next performance check found that the 30-rider fixture enabled the package's
automatic finish crowd and fell to about 28 fps with 1,908 dynamic spectators
on the same Intel GPU. Both visual presentation versions now use 240 explicitly
placed static spectators and disable the automatic crowd. The recorded Motor
Lab positions, group membership, timing, actions, events, and results remain
unchanged. The limited spectator placement is a visual choice, not motor data.

The exact-SHA preview `1837b7c3d360ef6ea63b6ac41c534aa95c93baec`
then displayed about 60–61 fps for both 30-rider categories after warming up,
with 240 visible spectators, zero dynamic spectators, roughly 0.67 million
triangles, and no renderer errors. A deliberately missing texture produced one
visible asset error while WebGL and the race continued at about 61 fps. Two
separate browser spectators showed the same shared race second while each
retained a different local camera target. A single recorded 32-rider women's
race tab displayed about 50–53 fps late in the 40 km race, with metres shown
under the last kilometre. The recorded riders all overlap at one coordinate;
the interface now explains that data limitation beside the replay.

This is a visual milestone, not a finished engine-to-production integration.
Official race replays still lack the simultaneous rider coordinates that the
package requires. The next data milestone is a new versioned adapter from a
whole-race motor recording that supplies actual distance and group transitions
for every rider, followed by the same-seed replay and finish checks.

## Experimental 120 km split-road recording

`/viewer?mode=split` and `/team/motor-lab/viewer-preview?race=split` use two
immutable men/women exports from experimental Motor Lab commit
`5352f9eb0a2f618976083b933189839bcacbe673`. Their adapter version is
`physical-first-split-to-pelotonia.viewer.v1-1`. Each contains 120 riders,
14,400 paid rider-kilometres, 131 frames and five recorded paid contacts.
The renderer receives recorded kilometre crossing times and membership;
between crossings it interpolates distance for presentation. The two fields
share the same server-derived clock cycle with all spectators of that field;
camera choice remains local. The exported feed has no official results or
group-gap field. The UI does not infer official gaps from interpolated road
positions and does not reveal future commentary.

This is a fixed Motor Lab test race, not a conversion of an official game run.
Same-seed finish calibration differs for 50 of 120 riders, with a maximum
deviation of 421.01688 seconds. Some riders share the same longitudinal
coordinate because individual lanes and order were not recorded. At the start,
the adapter records 50 solo riders, so the group strip is unusually long.
The route, terrain, trees and spectators are a synthetic visual study and do
not assert canonical geography. No official finish result is displayed.

On 9 November 2026, local browser checks loaded both gender categories from
start to late race on hardware-backed WebGL2 (ANGLE Intel UHD Graphics via
Direct3D11), with no renderer errors. The 120 km scene displayed about 21 fps
after warming up and around 4.0–4.1 million triangles on that machine. The
separate 150-rider, 40 km synthetic fixture displayed about 25 fps and 1.52
million triangles in the same development browser. These measurements are
below a smooth-playback release target and are not evidence for other devices.
The split recording remains an explicitly labelled preview. Guided game races
at `/team/view/[event_stage_id]` use their separate saved replay adapter,
described in `VIEWER_GUIDED_INTEGRATION_DA.md`. They still have no measured
simultaneous rider positions. The experimental split data must not be
substituted for an official race.

## Split-road display study, 10 November 2026

`illustrative-group-layout-1` now gives riders who share the same recorded
group, distance, and lane a stable visual arrangement in the split-road
preview. The source recording is not changed. Each drawn rider remains in its
recorded group and at most 20 m behind its recorded distance anchor; the
arrangement does not claim measured lanes, wheel order, contact, or race
results. The viewer labels this limitation beside the canvas. A frame at the
start line can still overlap because the source has zero distance and the
display does not move anyone before the start.

The 120 km schematic scene uses 80 m longitudinal terrain cells instead of
20 m cells, and its decorative road markings are built in 512 m sections for
camera culling. These changes affect only generated scenery. On the local
Intel UHD/ANGLE WebGL2 browser, the split preview displayed all 120 riders
at a midrace checkpoint, around 0.9 million rendered triangles, 75 draw
calls, and about 29 fps after warmup. This is one-device evidence and still
below a 60 fps target. The 30-rider fictional exhibition displayed about
44 fps and the 150-rider exhibition about 31 fps in the same session. The
missing-texture fixture displayed a fallback warning while WebGL continued.
The split recording still has 50/120 same-seed finish mismatches and no
official result. It is not approved for guided races or production default.
