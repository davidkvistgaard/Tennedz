# Race viewer 0.98.5: complete game divisions

This installable package is derived from the pinned 0.98.4 tarball. Its
`data.js` and `viewer.js` exports change the two explicit feed checks from
`riders.length > 150` to `riders.length > 160`, and the accompanying error
text from `1–150` to `1–160`. This includes the optional incident victim
list. `package.json` changes only the version to `0.98.5`. The renderer,
race samples, positions, events and results are unchanged.

To reproduce, extract `pelotonia-race-viewer-0.98.4.tgz`, make those exact
substitutions in both JavaScript exports, change the package version and run
`pnpm pack` from the extracted `package` directory. The application pins the
resulting `pelotonia-race-viewer-0.98.5.tgz` in its lockfile.

Tarball SHA-256:
`38F9343731F3066FC50765A42D67AC1E7CE737923543C6D3A62FF55115106202`.

The extra ten slots allow a complete 20-team one-day division of eight
riders per team. Both 160-rider categories passed the isolated authenticated
Intel UHD WebGL2 recorded-race browser test at 31 fps with zero renderer
errors. The package still has no general hardware performance approval, and
the experimental motor still has no official results.
