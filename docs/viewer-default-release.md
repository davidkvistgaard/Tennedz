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

`/team/motor-lab` opens the new viewer by default, while
`/team/motor-lab/engine` preserves the existing guided or legacy laboratory.
`PELOTONIA_VIEWER_V1_ENABLED=false` restores the old Motor Lab default and
disables the new clock endpoint. Actual game race replays at `/team/view`
retain the old viewer because their available data cannot support precise
simultaneous rider positions in this package. Authentication remains active.

The clock is anchored to a server UTC hour and shared by spectators, while
camera choice stays local. Commentary follows recorded events and does not
reveal the next kilometre's paid leader at its start. The production release
requires an authenticated browser check and exact deployment SHA, READY,
alias, page, JavaScript and runtime checks before domain promotion.
