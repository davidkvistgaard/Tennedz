# Race viewer 0.98.3 (experimental Motor Lab preview)

This installable `@pelotonia/race-viewer` package is built from the separate
viewer source under `viewer-package-performance-0.98.1/source`. It applies the
camera-only changes described in `pelotonia-race-viewer-0.98.3.patch` on top
of the 0.98.2 source. The game's dependency remains a package, not the demo
application.

At the shared 60× broadcast rate, the source riders advance much faster than
the old camera focus damping. Mid-race, the camera could aim over 100 m behind
the recorded group and show empty road even though all riders remained in the
renderer. The focus now follows the authoritative playback rate; camera orbit
and zoom controls retain their normal smoothing. This changes no race data,
positions, groups, gaps, events or results.

The standalone viewer passed 286/286 tests. The motor branch passed 45/45
focused viewer and adapter tests, lint and an isolated Next production build.
An isolated game browser test passed with WebGL2 and a 60× shared clock; its
mid-race camera lag was below 12 m and a screenshot showed the cyclists on the
road. The screenshot is a synthetic route fixture, not canonical geography or
an official race result. This local check does not approve production GPU
performance on every device.

Package SHA-256: `B6103DA3EFA3DE8B7EC2781418DE21E4FB3047B611AF0FA32DDF60395D55E5CC`.
Bundled viewer.js SHA-256: `3FC484291A559397CF2AE3649702A072ECA10194CDD774F15ACC69DD2D7B1884`.

The V7 race and this viewer remain separate from guided and official races.
