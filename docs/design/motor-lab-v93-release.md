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

An internal versioned no-front continuation now does that for a narrower
road: a bunch plus already dropped riders, with no leading road group.
It reselects and charges the named two-rider pair on each of the seven
recorded final-kilometre slices, uses the resulting bunch speed for the
dropped riders' relative clock, and replays exactly from the source.
The old clock still refuses the same explicit front-work source.
The focused source/replay/tamper test passed. In 48 new seeded generated
rolling/mountain variants, 18 reached this no-front handoff and all 18
candidate traces replayed with each selected worker charged. The other
30 require separate front-group/contact work. This trace is still an
internal probe: it is not a playable finish, individual order, point
award or guided route until the downstream line contract is proven.

The same opt-in no-front trace now has a separate source-replayed line
checkpoint. It carries the paid worker trace into unordered `peloton` and
`unresolved_dropped` bands, keeps all 160 riders inside those bands, and
withholds points and awards. A changed recorded worker fails deep replay.
All 18 no-front handoffs in the 48-case audit replayed this checkpoint;
the 30 front-group handoffs remain unsupported. This is still an internal
candidate and does not change the guided finish or its refusal.

Of the other 30 generated-route handoffs in that audit, 29 had one
leading road group and one had two. The player's team was in none of
those groups, so its named bunch-front order remained a real available
task. These cases need a separate versioned bunch/front relative clock
and exact contact handling before a paid line can be recorded. The
no-front checkpoint cannot be applied by changing its group-count guard.
Their 31 recorded group gaps ranged from 0.13 to 60.63 seconds at the
handoff (median 13.91); seven were at most five seconds. None of the
30 handoffs had an active break or GC response, while 25 had an
engaged chase team. A separate one-front continuation must pay both
the existing chase and the explicit bunch-front pair, and it must
record a catch if the group reaches the bunch inside the kilometre.

An isolated one-front paid-bunch candidate now reselects the committed
front pair on each slice, excludes any team already doing paid chase,
charges the selected workers, and moves the front group against the
resulting paid bunch clock. It refuses an unmodelled front catch. The
separate line checkpoint records unordered `road_group`, `peloton`, and
`unresolved_dropped` bands with awards and points withheld. In the 48
case audit, all 29 one-front handoffs source-replayed this clock.
One had no initially dropped riders, so a separately versioned optional
dropped-travel step records an empty rider list until a real drop occurs;
its line has only `road_group` and `peloton` bands. The legacy dropped
step still refuses empty source travel. The two-front handoff remains
outside this version. This is internal
probe code only; the guided finish and its refusal remain unchanged.

The two-front case now has its own opt-in candidate version, keeping
the one-front source guard intact. It pays the committed bunch pair
alongside any selected chase, advances both front groups, and refuses
an unmodelled catch or contact. The unordered checkpoint withholds
awards and points and deep-replays the source. An extended 24-seed
rolling/mountain fresh/tired audit covered 96 generated 20-team,
260 km sources: 36 no-front, 54 one-front and six two-front handoffs.
All six two-front candidate traces and checkpoints replayed with their
workers charged. This is synthetic coverage of a rare case, not a
general contact model or a guided race finish.

A larger 48-seed holdout used the same four generated-route combinations
for 192 synthetic races. The isolated no-front checkpoint replayed in
58 cases. The one-front checkpoint replayed in 116 of 117 attempted
handoffs; the remaining mountain/tired handoff had a recorded lead of
only 0.02 seconds and correctly refused an unmodelled front/bunch catch.
All 15 two-front attempts replayed. The wider sample therefore tests
the refusal boundary as well as the paid continuation; it does not
authorize treating a catch as an unchanged road-group finish.

The named-front coverage audit also accepts an explicit `--front-effort`
(`hard` or `conserve`) at the committed kilometre-five marker. In 32
same-source generated rolling/mountain, fresh/tired races per effort,
the conservative order replayed the isolated paid checkpoint in all
31 handoffs with at most two front groups; one source had three front
groups and remained outside its contract. Under hard effort, 29 of
those 31 replayed; two fresh mountain one-front handoffs correctly
refused a front/bunch catch inside the last kilometre. These results
show that the contact refusal is reached by a normal committed effort
choice. The old guided finish and its refusal remain unchanged.

A focused contact probe of the fresh mountain `guided-finish-coverage-2`
hard-effort source found no payable named bunch-front pair on any of the
seven final slices. The field still had an engaged rival chase team and
caught the 0.19-second front lead. A contact variant that simply assumes
the named pair keeps working would misstate this source. Its temporary
code and test were removed; the narrow no-contact checkpoint continues
to refuse this case. Contact must separately record the unavailable
front-work order and the actual paid chase before a line checkpoint is
considered.
