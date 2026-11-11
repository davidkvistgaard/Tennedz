# Race viewer 0.98.2 (experimental Motor Lab preview)

This installable, separate `@pelotonia/race-viewer` package was rebuilt from
`Pelotonia_Viewer_Integration_Kit_0.98.1.zip` (SHA-256
`85810F01B4B6F441E13AB6E030578F7C077B162B81CC141E8D2297B2F83557EE`).
The source changes are in `pelotonia-race-viewer-0.98.2.patch`, which applies
from the directory containing the archive's `source/` directory. The game
imports the package; it does not embed the demo application.

The changes affect only synthetic, two-point route schematics longer than
40 km. Visual road geometry uses 9 m stations; the expensive shadow pass is
disabled; and exact same-point riders are rendered as one representative rig
per occupied point. The selected rider becomes that representative when at
the point. All source rider samples, identities, time, groups, events and
results remain available and unchanged. This deliberately does **not**
invent individual lanes, wheels or road order. It also means a 120-rider
group may show one rider until the motor records distinct positions. It must
not be used as evidence that a real peloton formation has been rendered.

Package tests: 285/285 passed, including 30 and 150 rider feeds and the
same-point compaction cases for both categories. On the local Intel UHD
Graphics WebGL2 device, the women's 120 km/120-rider Motor Lab finish showed
about 38–46 fps, 36 draw calls, 1,137,314 triangles and zero renderer errors
after eight orbit actions. The earlier non-compacted candidate was about
14 fps, 78 draw calls and 1,636,638 triangles on the same case. These are
local observations, not a production GPU approval or proof for all devices.

Package SHA-256: `9C790CF6F6EC1BF694CFA739A741C9CB441290712336F6112C84DEFE397BB46D`.
The preview route is intentionally separate from guided/official races.
