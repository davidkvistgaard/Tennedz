# Viewer plus Motor Lab candidate

This branch joins the released viewer branch `e6f1e3bd` with the separate
experimental Motor Lab branch `7427e328`. It is an integration candidate,
not a production release. The currently published `tennedz.eu` deployment
remains `89f39dcc`.

`/viewer` still displays immutable Motor Lab samples or a clearly labelled
fictional exhibition. The public sample client now receives only events
already reached on its server clock. It does not substitute a sample for an
official game recording. `/team/motor-lab/recorded-viewer` is the flagged,
administrator-only path for a saved game-shaped physical recording with a
shared publication clock and measured unofficial finish crossings. Historic
game recordings keep their reports; old group gaps are not presented as
simultaneous rider positions.

The isolated production build and lint passed. Public browser checks passed
for exact 30 and 150 synthetic riders in both categories, camera controls,
WebGL rendering, public sample time/event filtering, and a missing texture
with visible fallback. A separate authenticated browser check passed for a
paid 16-rider game-shaped recording and its measured finish on Intel UHD
WebGL2/Direct3D11. The Motor Lab branch additionally passed paid 32- and
144-rider browser races in both categories; its local frame samples ranged
from 32 to 53 fps. These observations do not certify other GPUs or a hosted
game event.
The optional full 159-file unit suite was started and stopped while an
unchanged, long-running heterogeneous motor test was still computing; it
has no passing or failing final status. The targeted viewer tests passed.

The pushed merge commit `0d12df8b` built as protected Vercel preview
`dpl_38BJPnDxhrFqcEWUPLfdC8FwZAna` (READY, no production alias). An
authenticated in-app browser opened that exact preview: the saved 32-rider
men's and women's feeds, the 120-rider women's split-road feed, group labels,
shared commentary and WebGL canvas rendered. The split sample plainly reports
50/120 finish-calibration differences and no official result. On Intel UHD
WebGL2/Direct3D11, an isolated hosted 30-rider fictional exhibition sampled
50 fps and 627,220 triangles; the isolated 150-rider exhibition sampled
34 fps and 1,519,340 triangles, with zero renderer errors. Opening several
WebGL race tabs together reduced the observed rates to about 14–20 fps, so
these measurements are per-tab observations rather than a device guarantee.
The 32-rider saved race has only a common group road position: its individual
rider rigs overlap, and one visible rider cannot be interpreted as a recorded
peloton formation.

The latest strict whole-race release audit completed 72/72 scenarios but
still found 48/72 same-seed finish mismatches and 0 official results.
Hosted Supabase
does not yet contain the physical entry or recording tables. Those opt-in
migrations have only been verified locally. The physical preview flag defaults
to off. The
viewer package supports at most 150 riders, so a complete eight-rider-team
game field can be tested at 144 riders; exact 150 belongs to the synthetic
renderer stress matrix. No official result, award, timing rule, race position
or geographic detail is inferred to fill missing motor data.

On 9 November, read-only inspection of the hosted `Tennedz` Supabase project
showed 12 applied migrations, ending with the 96-hour rider-market migration.
All 12 matched the local SQL by migration name and MD5 after normalizing line
endings and trailing whitespace. Eleven local filenames had different
timestamps, so this candidate renames those files to the exact applied
versions without changing their SQL. The physical viewer migrations
remain new and unapplied. Neither the hosted schema nor its history was
changed by this reconciliation.

Do not promote this candidate until real committed game entries and a hosted
recording exist, the physical finish is calibrated and versioned for official
use, authenticated browser checks pass on the exact deployment, and the
READY/alias/page/JS/runtime/rollback checks are complete.

The candidate now has an opt-in authenticated spectator route at
`/team/race-viewer/[eventId]`, guarded by
`PELOTONIA_PHYSICAL_VIEWER_SPECTATOR_ENABLED=true` (off by default). It
reads an immutable saved physical recording and uses the same server clock
as the administrator preview. The page projection omits the committed input
snapshot, source ledger, future commentary events and unpublished finish
evidence. A separate authenticated finish endpoint releases measured
crossings only when the shared clock reaches the finish. Focused projection
and broadcast tests, lint and isolated build passed. No hosted game event
has exercised this path, and the required migrations are not applied.

The spectator route now uses viewer package 0.98.3's append-only frame
contract. Its initial page contains only already reached frames; subsequent
one-second polls call the private, service-role-only frame-slice RPC. That
RPC caps the requested time against the database recording clock and returns
only paid checkpoints reached in the current replay cycle. The renderer
accepts them without rebuilding the scene or losing the local camera. The
SQL clock/privacy tests, 286 package tests, lint, isolated build, and local
authenticated browser replay passed. The browser replay covered the entire
16-rider recording, checked the camera across frame appends, and showed
finish evidence only at the shared finish. A separate future-dated recording
remained unpublished. The same authenticated streaming replay also passed
with complete 144-rider men's and women's fixtures. These are local WebGL
checks, not a hosted or cross-device performance guarantee. The women's
144-rider final diagnostic on Intel UHD Graphics/Direct3D11 was 33 fps,
160 draw calls, 2,058,340 triangles and zero renderer errors after the
full replay and a local camera turn. No hosted event
has yet exercised this path, and the
new frame-slice migration remains unapplied alongside the three earlier
physical viewer migrations. New game recordings use document v3, whose
digest binds input metadata, feed, finish, coverage and motor source.
Historic v2 recordings retain their original verification rule and remain
readable. The local, unapplied recording migration accepts both versions;
the database separately checks event ID and seed on write.
The release audit now seals and verifies v3. Its 20-scenario same-seed smoke
run completed every race, with 12 calibrated, 8 mismatched and zero official
results; guided-race readiness remains false.

An isolated browser fixture also verified the new spectator path with a
signed-in non-administrator. A saved 16-rider game-shaped race displayed a
WebGL canvas without private input fields in the page; a future-dated
recording displayed only the waiting state and its finish endpoint returned
425. Both browser cases passed on the local test server. They do not replace
the missing hosted game-event check.
The team's race preparation page discovers an available recorded race through
the authenticated clock endpoint and links to the new viewer; when no
physical recording exists, the existing historical race route remains in
place. This navigation change passed lint and an isolated production build.

The frame-slice RPC avoids transferring an entire roughly 1.1 MB, 120-rider
recording on each poll. It still reads and filters the immutable JSONB
document inside PostgreSQL, so concurrent spectator load and hosted latency
remain unmeasured. The initial page still transfers the already reached
frames, and no browser-side request can prove exact individual road spacing
where the motor records only group positions. The spectator flag remains off
by default while finish calibration is incomplete.

Synthetic presentation study 3 places more roadside trees closer to the
fictional road on long recorded schematics. It does not alter race frames,
riders, groups, clock, commentary or finish evidence. A trial with generated
crowds reached the measured finish but reduced the Intel UHD WebGL2 sample
from 33 fps to 25 fps for women and 22 fps for men, with 576 generated
spectators. The generated crowd remains disabled; the 240 static synthetic
finish spectators remain. These are device-specific samples, not a
device-wide performance certification.
Both public split-road samples passed the local Edge WebGL browser check with
the study 3 scene; the generated crowd remains off.
