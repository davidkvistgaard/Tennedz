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

That exact `guided-finish-coverage-42` mountain/tired source now has a
separate *internal* payable-front contact version. Its one front group
began the final kilometre 0.02 seconds ahead. The committed `you-5`
front-work order could pay a `you-5`/`you-6` bunch pair. A rival had
engaged chase at the kilometre-259 handoff, but no rival paid a chase
pull in the final-kilometre trace. The separate clock calculates
contact at 259,031.806 m and charges the named pair through both the
pre-contact and post-contact portions of that slice. All 160 riders
reach one unordered `unresolved_contact` line band; classifications,
points and awards are withheld. Source replay rejects a forged worker
charge. The old one-front no-contact version still refuses this source,
the unavailable-pair contact version still refuses its payable pair,
and a same-seed fresh mountain source with no modeled contact still
refuses the new contact version. This is a narrow synthetic boundary,
not a guided default or an individual finish result.

The same 192-case holdout left two further validated source roads
without a candidate checkpoint: `guided-finish-coverage-13` tired
rolling and `guided-finish-coverage-14` fresh rolling had no front
group and no dropped rider at the last-kilometre handoff. Both had a
payable `you-5`/`you-6` named front pair. A distinct internal
`paid-bunch-only` version now replays all seven short slices with the
pair charged, and refuses any newly exhausted rider rather than
dropping them silently. It records one unordered 160-rider peloton
band and withholds individual places, classifications, points and
awards. The two exact source cases validate and replay. Together with
the earlier no-front, one-front, two-front and payable-contact
checkpoints, these candidates account for the 192 synthetic
named-front handoffs; this does not establish an official finish
engine or authorize routing the guided default to them.

An independent 48-seed holdout (`--seed-start=49 --seeds=48`) covered
another 192 generated rolling/mountain, fresh/tired, 20-team 260 km
named-front sources. Every source road validated; each source reached
one of the separate internal, source-replayed, non-awarding checkpoints:
45 no-front with dropped riders, 130 one-front no-contact, 13 two-front,
one three-front, one payable named-front contact and two complete paid
bunches. No case needed the unavailable-front catch version and none
remained outside these narrow candidate contracts in this holdout.
This broadens synthetic boundary evidence, but does not establish
individual finish order or calibrated race dynamics.

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

An additional *internal* version now handles a different narrow source:
the named front-work order remains committed, but no pair can pay even
one final slice, while a paid rival chase contributes before the sole
front group is caught by the continuing relative road clock. The
version records that contact at its calculated
route marker, carries all 160 riders to a single `unresolved_contact`
line band, and withholds classifications, points and awards. It rejects
any slice that can pay bunch-front work; those sources still require a
separate mixed-work contact clock. The full source and the checkpoint
deep-replay, including rejection of a forged contact marker. In a
96-case hard-effort generated rolling/mountain, fresh/tired holdout,
30 no-front, 55 one-front and seven two-front no-contact checkpoints
replayed; all three one-front catches replayed only under this
unavailable-front version, and one three-front source remained outside
the contract. The ordinary guided finish and refusal are unchanged.

A disjoint 24-seed hard-effort holdout (seed numbers 25–48, another 96
generated rolling/mountain fresh/tired races) source-replayed 25
no-front, 64 one-front and seven two-front no-contact checkpoints.
None needed the unavailable-front catch version or reached a three-front
handoff. Across both 24-seed batches, the isolated versions therefore
replayed 55 no-front, 119 one-front, 14 two-front and three
unavailable-front catches. The one three-front source now has a
separate, source-replayed no-contact checkpoint with three unordered
front bands, a bunch band and an unresolved dropped band. Its named
front pair could pay none of the seven slices, so the checkpoint records
zero bunch-front workers; it does not pretend otherwise. Contact between
any of those groups remains a refusal, and awards and points remain
withheld. This is synthetic boundary coverage, not a complete guided
finish.

A separate 24-seed effort audit used the same generated rolling/mountain,
fresh/tired 20-team 260 km sources with a committed named front-work
order. Under `hard` effort, all 96 source roads reached an internal,
source-replayed, non-awarding checkpoint: 30 no-front, 55 one-front,
seven two-front and one three-front no-contact cases, plus three
unavailable-pair catches. Under `conserve`, 95 of 96 reached the
existing checkpoints. The remaining `guided-finish-coverage-23` fresh
mountain source began the last kilometre with no front group and ten
dropped riders. Its named front pair could pay, but two more riders
exhausted during the final seven slices. The earlier paid no-front
version correctly refused them because it only carries the original
dropped set.

An isolated, separately versioned *dynamic paid no-front* checkpoint
now records those new exhaustion drops and their travel behind the
paid bunch, reselects and charges the committed named workers for each
slice, and ends with all 160 riders in unordered line bands. It
withholds individual places, classifications, points and awards.
The exact conservative source validates and full source replay rejects
a forged worker. The older no-front version still refuses it. This
candidate remains internal; the guided finish and its refusal have not
changed. The effort audit tests contract coverage, not calibrated race
dynamics or an official finish.

Rerunning the full 96 conservative sources with this separate version
accounted for every handoff: 35 earlier no-front paid checkpoints,
53 one-front, four two-front, one three-front, two complete paid
bunches, and this one dynamic no-front checkpoint. All 96 source
roads still reach the ordinary guided refusal; the internal checks
do not award an official result.

An independent conservative-effort holdout using seed numbers 49–96
(192 generated rolling/mountain, fresh/tired sources) also reached
internal source-replayed checkpoints in all 192 cases: 44 no-front,
137 one-front, seven two-front and two three-front no-contact cases,
plus two complete paid bunches. None needed the dynamic paid no-front
version in that disjoint sample. This confirms broader coverage of
the narrow source contracts, without resolving individual placing
or the guided finish refusal.

The ordinary V93 guided-random 96-case flat/mountain, fresh/tired,
20-team 260 km baseline has one separate late-contact refusal:
`guided-finish-coverage-19` (fresh mountain). At km 259 its sole
four-rider front group is 0.26 s ahead. The existing seven-slice
separated-road trace pays a chase rider in five slices and catches
the front at route marker 259774.17 m, with 226 m remaining. The
older early-contact finish contract correctly refuses that marker.
A new *internal* late-contact checkpoint requires exactly one front,
contact within the final 500 m after recorded paid chase, and no
new exhaustion drops or bunch-front work. It source-replays the
contact, worker and energy; an altered contact marker fails replay.
It accounts for all 160 riders in two unordered line bands: 148 in
the merged contact group and 12 still dropped. Individual places,
classifications, points and awards remain withheld. The ordinary
guided result and its refusal are unchanged.

Across independent seed batches 1–48 and 49–96, flat/mountain,
fresh/tired (384 ordinary guided 20-team 260 km races), 381 paid an
individual finish and three validated their source road but refused
the ordinary last-kilometre finish. The new late-contact checkpoint
source-replayed both `guided-finish-coverage-19` and the independent
fresh-flat `guided-finish-coverage-86`. In the latter, three slices
paid chase before contact at 259611.21 m; the contact slice itself
had no paid chase worker. The checkpoint records contact *after*
paid chase, without claiming that a worker paid in the contact slice
or inferring a causal wheel order. The remaining fresh-mountain
`guided-finish-coverage-39` refusal concerns pre-500 m bunch drops
in a two-front handoff. Its separate internal two-front paid-road
checkpoint source-replays unordered road bands, but the ordinary
positioned finish still refuses because those drops need a truthful
wheel handoff. None of these internal checkpoints change the guided
result or grant awards.

The V93 refusal preview now exposes the seven paid last-kilometre
group passages for the two late-chase contacts only when that separate
source checkpoint can replay exactly. It records the contact marker,
isolated passages and each own rider's paid energy, while returning
HTTP 422 with individual line times, classification and points
withheld. The existing final-100-m preview retains its version and
individual contact audit; other unsupported catches retain their
kilometre-only refusal. This is a group-road explanation, not a
playable finish or an automatic change to guided tactics.

The remaining `guided-finish-coverage-39` pre-500 m bunch-drop
refusal also has a narrow paid group-road preview. It requires the
existing two-front paid-bunch checkpoint to source-replay all 160
riders and their final energy before showing seven last-kilometre
passages and unordered line-band counts. The API continues to return
HTTP 422; individual line times, classification, replay and points
stay unavailable. If that source checkpoint cannot replay, the
earlier exact refusal remains. No finish guard or guided default was
changed.
