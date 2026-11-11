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

## Newer V7 position recorder holdout

The earlier 72-case audit checks the original physically paid group-clock
probe against V94. It does not measure the newer positional recorder alone.
`audit-position-general-motor-lab-v1.mjs` was therefore run with position
version 7, source version 2 and synthetic sprint stakes. One selective-attack
flat case and four repeated-attack holdouts (men/women, flat/mountain) all
completed and independently replayed the source and position traces. All
five covered every decision, checkpoint, finish crossing and finale rider
frame. This proves replay coverage for those cases, not release readiness.

The selective flat case still had 17 kilometres where the selected front
leader differed from the source, a 7.188 reserve-unit maximum final
difference, an 8.011-second maximum source group-clock versus wheel-finish
difference, and 21 unresolved finish-clock ties. The four holdouts had
12–22 unresolved finish-clock ties each, 7.191–7.215 reserve-unit maximum
differences and up to 9.653 seconds of source clock versus wheel-finish
difference. Flat cases had 17 front-leader mismatch kilometres; mountain
cases had none. The first flat refusal was at kilometre 88: source chose
`you-2`, but the position model kept `you-3` because the proposed pass was
`no_payable_front_pass`. That refusal must not be overwritten by the
historical leader assignment. The V7 audit explicitly reports no official
results and `readyForGuidedRaces: false`.

The unchanged current Motor Lab mountain/no-attack test input was also run
with V7 and source version 2 for both categories, without synthetic sprint
stakes. Both 120-rider races completed and replayed with full decision,
checkpoint, finish and finale-frame coverage. Neither had a front-leader,
attack-choice or peloton-membership mismatch. Final reserve differed by at
most 0.049 unit, while the source group clock versus wheel finish differed
by up to 9.658 seconds; each case reported 10 unresolved finish-clock ties.
There were no sprint attempts because no team had a committed sprint goal.
These results support replay integrity for that input, but not an official
finish order or sporting calibration across new orders and seeds.

A direct, unchanged men/mountain holdout on seed
`viewer-release-holdout-2` produced 11 finish-clock tie observations. The
first two riders both crossed at exactly `10835.80537419145` seconds; two
more crossed at exactly `10836.80824399145`. The crossing recorder retains
full numeric precision and calls times tied within `1e-6` seconds, so these
are identical model crossing times rather than display rounding. Sorting
the tied rider IDs would invent an official order. The finish solver still
describes its crossing order as non-official.

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
2. Validate and refine the existing opt-in V7 finish ordering from recorded
   rider states and paid effort. Keep unresolved finishes explicitly
   unresolved rather than guessing an order.
3. Run the full V7 same-seed matrix alongside the 72-case legacy comparison
   and the 30/150-rider browser matrix,
   then validate the authenticated hosted Preview before any production
   change.
