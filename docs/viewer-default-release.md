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
The same clearly labelled fictional sample is also available without a game
account at `/viewer`, so collaborators can inspect rendering before the
preview environment has team data. Its separate public clock uses the same
server-derived race cycle; it exposes no account or official race information.
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

`motor-lab-scenic-study-1` adds only flat terrain, generated roadside trees,
grass, spectators, and a finish structure to the recorded 40 km Motor Lab
sample. Two foliage textures come from the supplied Viewer Integration Kit
0.98.1 (`source/public/assets/alpine-spruce-v1.png` and
`alpine-larch-v1.png`). The scene has no canonical geography. The adapter
recording, rider identities, kilometre boundaries, group membership, events,
orders, and results are unchanged; tests compare the original and scenic
sampling. The recording places all 32 riders at the same longitudinal road
position within one peloton and has no lanes, so the 3D view cannot display a
real spread-out peloton or multiple groups from that source.

`viewer-visual-exhibition-1` is a separate, explicitly fictional four-minute
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
This is below smooth-playback approval, and the browser did not expose an
independent hardware GPU identity. The 30-rider men fixture with
`asset=missing` reported one failed scene asset, retained WebGL rendering, and
continued the shared replay with fallback. No official race result was
generated. These browser results are not acceptance of 150 riders or hardware
GPU performance for production.

This is a visual milestone, not a finished engine-to-production integration.
Official race replays still lack the simultaneous rider coordinates that the
package requires. The next data milestone is a new versioned adapter from a
whole-race motor recording that supplies actual distance and group transitions
for every rider, followed by the same-seed replay and finish checks.
