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
