# Motor to viewer release checkpoint — 2026-11-11

Source commit: `1a58a0204dcfc051d6bfcf6b19e3c51c4dff8395` on
`codex/motor-lab-release`. The separate viewer package is 0.98.3. Its
camera fix passed 286 package tests, 45 focused game/adapter tests, lint,
an isolated production build and a local WebGL2 game browser check at the
authoritative 60× clock. The local mid-race screenshot visibly contained
the cyclists. The exact commit reached READY on a branch Preview.

## Whole-race release audit

`node scripts/audit-motor-viewer-release.mjs --require-calibrated` covered
two seeds, both rider categories, flat/rolling/mountain terrain, selective
and all-team chase orders, and no/selective/repeated attacks: 72 complete
120-rider, 120 km races. The command exited 1 because its release gate failed.

| Check | Measured result |
| --- | ---: |
| Complete paid races | 72 / 72 |
| Same-seed finish calibrated | 24 / 72 |
| Finish mismatches | 48 / 72, all attack cases |
| Official results available | 0 / 72 |
| Races with unresolved finish ties | 72 / 72 |
| Riders in unresolved ties | 8,592 |

The 24 no-attack cases match the historical V94 finish claim. Each of the
48 attack cases has one mismatched rider. In inspected cases across two
seeds and all three terrain profiles, that rider is `you-7`, the solo attacker.
For the first seed's flat/selective case, V94 records a 15.04-second lead
at kilometre 20 while the independently paid probe records 3.063 seconds;
at 120 km the two leads are 188.46 and 206.826 seconds. The divergence is
in the two motor paths' clocks, not in the viewer adapter. Do not adjust
the display or apply a scripted gap to make these numbers coincide.

The paid recording has complete longitudinal positions and measured finish
crossings, but the bunch has no recorded wheel order. Do not derive official
places or awards from the tied group clock. Preserve historic recordings
and keep this V7 path separate from guided races until a versioned finish
model and whole-race calibration pass the same-seed gate.

## Hosted check

The branch Preview uses an isolated test Supabase project. A normal
tennedz.eu manager account is absent from that project and receives
"Incorrect email/username or password." The user should sign in on
tennedz.eu with their production account, not retry it in this Preview.
The newest hosted saved-race playback still requires an isolated test login
before its post-fix browser check can be completed. Do not weaken auth or
replace the Preview's isolated database merely to make that check pass.

## Next acceptance work

1. Explain and reconcile the physically paid solo pace with the V94 source
   claim through recorded kilometre decisions and energy, without borrowing
   the historical gap as movement input.
2. Version a physical finish ordering policy from recorded rider states and
   paid effort. Keep unresolved finishes explicitly unresolved.
3. Rerun all 72 same-seed scenarios and the 30/150-rider browser matrix,
   then validate the authenticated hosted Preview before any production
   change.
