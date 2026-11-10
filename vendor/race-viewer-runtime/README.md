# Pelotonia race viewer runtime fork

`package/` is the installable `@pelotonia/race-viewer` 0.98.5 package from
the separately tested viewer candidate, versioned here as
`0.98.5-pelotonia.1`. It contains the viewer package and its Next examples,
not the standalone demo application. The game consumes it as a local package.

Two presentation-only changes are made in `package/viewer.js`:

1. The camera focus follows the current source sample exactly for a shared
   replay. A kilometre-per-eight-seconds presentation clock made the original
   3.8/s smoothing leave the riders outside the frame even at 1×. Orientation
   and local camera choice retain their original smoothing.
2. A long two-point route labelled `Schematic distance axis` skips the same
   expensive shadow pass that the package already skips for synthetic long
   roads. This does not mark the recorded race as synthetic or alter its data.

The guided replay adapter retains the engine's checkpoint kilometres, group
gaps in seconds, events, and official results. Visual spacing inside a group
is separately labelled illustrative. No motor sporting logic is changed.
