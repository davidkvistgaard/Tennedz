# Guided Motor Lab v93 release checkpoint

This branch starts from the exact production commit `0ca7cbf` and ports only
the bounded v93 Motor Lab, its engine dependencies, read-only point policy,
local verification fixtures and the guided `/team/motor-lab` entry. It does
not merge the broader preview branch into production.

The page offers a ready 40 km sample and a 120 km two-manager example. Players
can select terrain, distance, field size, gender, starting fatigue, own orders,
default or custom rival orders, a nominated finisher and an optional lead-out.
The recorded road, individual line, provisional points and rider replay share
the same run. Points are an illustration; no award rows or official results are
saved. Complex late bunch exits and front catches still return the validated
road and a clear refusal without inventing a finish.

The new route is selected only when both
`PELOTONIA_V91_PLAYTEST_ENABLED=true` and
`PELOTONIA_V93_COASTED_PLAYTEST_ENABLED=true`. Otherwise the existing Motor
Lab remains available. The API is gated by the same flags and requires an
authenticated user; its per-user rate limit is six runs per minute.

Verification on this production-base branch:

- `pnpm build` and `pnpm lint` passed.
- The isolated local browser suite passed all 36 v93 flows, including the new
  guided mobile journey from login to result and rider replay.
- The old Motor Lab passed both browser flows with the flags absent.
- The playable acceptance suite passed 20 route/field/finale cases; the point
  preview suite passed three cases; the focused v93 contact/bounds suites
  passed 13 cases.
- The full unit suite passed with two-way concurrency after porting the
  updated v2 foundation and Motor Lab contract tests. The unchanged v93
  motor was previously verified on the preview branch with 975 passing unit
  tests. The Vercel preview build for this selective release reached READY;
  a production smoke remains required after activation.

## Later guided finish coverage diagnosis (2026-10-28)

`scripts/audit-v93-guided-finish-coverage.mjs` reruns the guided random
20-team, 260 km input with named finishers, then validates either the
paid finish or the complete kilometre road attached to a refusal.
Across 12 seeds, flat/mountain terrain and fresh/tired starts (48
synthetic cases), all 48 had a validated paid finish. This is a useful
baseline for the ordinary order mix, not a measured real-world rate.

The opt-in `--named-front-work` audit instead uses generated long
rolling/mountain routes and a committed V8 named break, rival chase
target and named front worker. All eight initial cases (two seeds by
two styles and two fatigue settings) reached the validated km 259
road, then refused with `The separated last-kilometre finale needs
recorded response or front rotation.` The handoff was not always a
separated front: in the first four inspected cases it included one
front group or no front, plus 6–47 dropped riders. The common factor
was the still-active explicit front-work order. The current last-km
clock does not pay that order's worker, energy and pace, so the guard
must remain. A future version needs a recorded paid front-work handoff
and exact source replay before it can turn those refusals into a
result. The audit does not change playable behavior or infer a placing.

The follow-up handoff check found the named worker and at least one other
eligible helper still in the bunch in all eight cases; the player's team
had no rider ahead. Thus these are genuine available front-work orders,
not orders that could safely be ignored because the worker was absent.
The audit now records that availability alongside the road state.
The km 259 ledger also shows the same paid pair, `you-5` and `you-6`, in
all eight cases. A correct final-kilometre continuation therefore needs
to carry an actual paid two-rider bunch pace from that source, while
allowing later availability to change through the short slices.
The pair's recorded ability at the handoff ranged 70.40–79.38; its
lower-energy rider retained 13.12–28.91 energy across the eight cases.
Those values are inputs to a paid continuation, not permission to hold
the pace constant or waive the energy cost through the final kilometre.

An isolated, opt-in first-slice candidate now selects from the committed
lineup/order and handoff energies. In all eight audited cases it selected
the same named `you-5` plus `you-6` for the opening 250 m; each worker
could pay the slice. Its plan is exposed only in the read-only audit.
No final-kilometre road, finish, replay or player-facing route uses this
candidate yet. The remaining work is to recalculate eligibility and
energy on each slice, account for bunch speed and any contact, then
validate the complete source replay before routing it to a finish.
