# V2 playable motor test gate

This is the finite acceptance gate for the opt-in v91 motor test. It does not
change production race settlement. A passing laboratory recording is not an
official result until every item below is verified end to end.

## Player path

1. Choose a route/profile, terrain, race length, category, field size and
   starting fatigue. Keep the roster and seed fixed when comparing tactics.
2. Set a plan for any number of managers; the rest receive visible default
   plans. Each plan can name a finisher, an optional lead-out rider and the
   existing effort, attack and chase choices. Reject invalid or unavailable
   riders before simulation where the locked input already proves that fact.
   The offline test drive checks submitted finisher and helper IDs
   against the prepared fictional roster before running the kilometre tour,
   including when the road would later refuse a group finale;
   valid historical recordings keep their prior input and output shapes.
3. Run exactly the chosen race once. Show the committed choices, road groups,
   catches, actual work and remaining energy in a replay sourced from that run.
4. Show a complete individual finish with a transparent provisional status.
   The finish must come from recorded road position, elapsed time and paid
   movement, including a surviving break, a catch and a bunch sprint. Never
   use a synthetic tie-break or the old kilometre result to conceal an
   unresolved short-finale road state.
5. Project points through the existing point policy only from a complete,
   unambiguous classification. Keep all test awards read-only. If a finish is
   unresolved, show why and withhold its points.

## Motor invariants

- Every rider has one position and road group at each recorded event. A catch
  changes membership only at the measured contact; nobody crosses another
  group without a recorded contact or paid passing rule.
- All riders advance on one elapsed clock. Energy debits match the distance
  actually travelled at their recorded role and work rate. A lead-out cannot
  gain distance by paying only for the nominal bunch slice.
- A named manager attack, finisher and helper remain attached to their locked
  rider IDs. A helper cannot also pay for a front rotation in the same interval.
- Replaying the versioned input and seed reproduces decisions, road events,
  energy, line order and point projection. Older motor recordings remain valid.
- Unsupported road states fail visibly. They cannot be turned into a winner,
  an official result or points by a fallback calculation.

## Acceptance scenarios

Use fixed, independent fictional rosters in both categories and at 4, 15 and
20 teams. Cover a short fresh flat sprint, a long tired flat race, rolling and
mountain routes, no chase versus coordinated chase, a surviving break, a
measured catch, two independently ordered attackers and competing lead-outs.
For paired runs change one manager choice while holding the route, roster,
weather and seed fixed; record whether the road, fatigue or finish actually
changed. Run focused tests, the full unit suite, lint, an isolated clean build
and a local browser pass of the test UI. Report any skipped or interrupted
check as such. These fictional scenarios are correctness gates, not target win
rates; sports balance still needs human playtesting.

The first handoff is a local, opt-in test environment for the user, not a v2
production release. Calendar, Arena and monetization work are outside this
motor gate. The existing game and production data stay unchanged.

The offline command `node scripts/engine-v2-test-drive.mjs
docs/design/engine-v2-test-drive-example.json` now runs one fictional v91
race through the conditional motor entry and verifies its replay. Copy and
edit the JSON to choose route, length, category, fatigue, field, seed and
manager tactics. `managerTactics` supplies orders for the first listed rivals;
the others use `defaultRivalPlan`. The optional `managerTacticOverrides`
array names any nonconsecutive rival by `teamId`, so a selected opponent can
change `effort`, `attack` and `chase` without filling all earlier positions.
An ID cannot appear in both tactic forms. The default and player orders stay
visible in the output. `finalePlans` can override any named
manager's finisher and optional helper while unspecified managers keep their
captain and no helper. `--full` includes the complete source and finale
recording for inspection. Output identifies road groups, chasers, energy,
paid lead-out work and conditional line times. Where the already paid bunch
runner recorded inferred source wheels, it also exposes that runner's
`provisionalLineOrder`, `positionSourceStatus`, `passingRule` and timestamped
`roadEvents`; these are laboratory observations, not official placings. The
tool names an unsupported road state with its recorded group and dropped-rider
counts where the unmodified kilometre source is available.
The conditional bunch-to-group fallback and an unsupported group plan reuse
that same locked kilometre recording instead of simulating the race again.
This changes no versioned road or result output.

A fixed 54-case diagnostic across three routes,
both categories, three field sizes and three tactics modes originally replayed
32 conditional individual lines, 12 paid group-band lines and 10 explicit
refusals, all on the tired mountain source with multiple groups or dropped
riders. The same-source separated-group path changed that coverage to 32
conditional lines, 12 single-group band lines, six separated-group band lines
and four explicit refusals. The new depleted-reserve path records two of those
four as unresolved road bands with visible unmet energy demand. A separate
no-front dropped path now records the remaining two: one bunch, one already
dropped rider, no actual chasing, and seven last-kilometre slices on a common
clock. The resulting 54-case matrix has 32 conditional lines, 12 single-group
band lines, six separated-group band lines, two depleted group-band lines and
two no-front dropped-band lines, with no explicit refusal for these fixed
settings. This is coverage
evidence, not a sporting success rate. The matrix fixes seed
`test-drive-acceptance-1`; its player orders are
selective attack/selective chase for mixed rivals, repeated attack/ignore chase
for attack rivals, and no attack/all chase for chase rivals. The tool
withholds classification and point awards and has no account,
database or production path. This is an engine diagnostic, not the requested
browser test environment or a completed playable race.

The offline input may include `"pointContext":{"tier":3,
"divisionIndex":1,"divisionCount":1}`. For a complete, uniquely ordered
paid bunch line, `v91-provisional-point-preview-1` maps the recorded
experimental line places through the existing one-day division point policy.
The fixed 40 km four-team lead-out example changes the nominated finisher's
provisional place from second to first and the tier-three illustration from
188 to 250 points while the kilometre race tape and initial wheels stay
fixed. This projection has no award keys or rows, cannot commit awards, and
does not change `classifiedResults:null` or `pointsStatus:'withheld'` in the
race final. Its inferred wheel source and open passing rule still need
sporting validation. The later separately versioned individual-group paths
offer the same read-only policy illustration only where their paid tracks
remain longitudinally separate and places are unique. Other group-band
roads and ambiguous places have no preview projection; this is a diagnostic
aid, not an official scoring path.

`node scripts/engine-v2-playable-road-audit.mjs` preserves that 54-case
matrix as a repeatable read-only check and adds 12 paired four-team cases
with independent manager orders and three explicitly different team strength
and starting-fatigue settings. The 66 fixed cases replay as 32 conditional
individual lines, 12 single-group bands, six separated-group bands, four
group-plus-dropped bands and 12 bunch-plus-dropped bands, with no unsupported
source in this chosen matrix. The independent pairs keep route, roster and
seed fixed while changing orders. On the 120 km rolling route the split-intent
orders leave four riders dropped versus three under coordinated chase; on the
260 km mountain route they leave one group and two dropped riders versus no
group and three dropped riders. These are observations for this fictional
field, not calibrated sporting probabilities. The audit reports unmet energy
demand separately: the two independent group-plus-dropped cases have none,
despite the older `recorded_depleted_bands` status name. Every case still
withholds classification and points.

`v2-finale-separated-last-km-10` now starts the existing paid multi-group
worker rules at the locked one-kilometre source, rather than replaying a
different four- or five-kilometre handoff. It accepts at least two groups,
one bunch and no dropped riders. The companion
`v2-finale-separated-last-km-clock-1` aligns each paid group passage to the
bunch's marker clock, verifies every recorded gap at each boundary and gives
only band-level possible places. Four fixed tired mountain sources (15/20
teams, M/F) reach all seven slices and retain all 120/160 riders and their
final energy. The shared conditional entry exposes six matching matrix
sources as `paid_separated_bands`; manager finisher/lead-out plans remain
unpaid and are rejected. A valid last-kilometre named attack still refuses
the separated continuation. Contact between road bands, riders dropped at
the source, wheel order within a band, individual classification and points
remain open. The older separated and single-group recordings keep their
existing versions and replay behavior.

`v2-finale-depleted-last-km-11` is separate from that fully paid path. The
kilometre motor clamps reserve at zero yet continues an exhausted rider at a
reduced ability. Its companion dropped-step v2 records the same saturation:
energy actually spent, energy demanded beyond the available reserve, and the
resulting deficit behind the bunch. The clock aligns the existing group,
bunch and dropped riders over all seven last-kilometre slices. Both fixed
four-team mountain mixed sources (M/F, fatigue 30) retain all 32 riders and
replay as `recorded_depleted_bands`, with six depleted riders and explicit
unmet demand. This is **not** a fully paid individual finish: the dropped
riders have no defensible internal order or energy reserve to debit. It
withholds classification and points, and it rejects finisher/lead-out plans.
The old strict dropped-step recording still refuses zero-reserve travel.

`v2-finale-no-front-dropped-last-km-12` extends the versioned dropped clock
only when the source has no road group, no recorded chase target and an
already dropped rider. Both fixed four-team mountain chase sources (M/F,
fatigue 30) retain all 32 riders: the bunch occupies possible places 1–31,
the dropped rider possible place 32, all recorded energy demand is paid, and
the dropped deficit stays positive across seven slices. It does not resolve
the bunch's internal finish order, so results and points remain withheld and
finisher/lead-out orders are rejected on this path.

The fictional input also accepts optional `settings.teamOverrides` rows such
as `{"teamId":"you","level":76,"fatigue":15}`. Each row changes the
uniform base skill level and/or starting fatigue of one named test team;
unspecified teams retain the original fixture. This makes paired strength
and fatigue probes independent of the seed string, which does not create a
new roster by itself. One fixed 40 km flat women's pair with identical seed
and orders reaches the same paid conditional bunch path, while the player's
finisher crosses later after the team changes from its default level and
fatigue to level 76 and fatigue 15. A more extreme level 62/fatigue 30 input
leaves eight riders dropped at the last-kilometre source and is correctly
refused. These inputs are diagnostic field variations, not motor tuning or
official results.

## Integration priority

The conditional race-final entry now admits a complete bunch with attack
orders only when the locked last-kilometre intent ledger proves none can
launch and no other road action is pending. The fixed 40 km flat men's
(4 teams), 120 km rolling women's (15 teams), and 260 km mountain men's
(20 teams) mixed default requests reach a paid conditional individual line
through the existing full-kilometre bunch runner. The new version records the
blocked or not-due intents; an eligible named attack is still rejected. A
single separated group now has a distinct paid-band path under the strict
conditions below. This resolves an overly broad order-label guard, not the
general finale. The next motor integration must resolve group contact,
valid manager actions on separated roads and individual order on the common
clock. Only then can a general result and
point projection be assessed against this gate.

The repeatable read-only audit
`node scripts/engine-v2-conditional-coverage-audit.mjs` fixes one fictional
seed across 36 combinations: 40 km flat with no starting fatigue, 120 km
rolling with 15, and 260 km mountain with 30; both categories; 4, 15 and 20
teams; mixed and attack-oriented default tactics. It independently replays
each accepted conditional line or road-band recording against the same locked
kilometre race.
Sixteen of 18 mixed sources reach a paid conditional individual line; the
two 4-team mountain sources have a road group and six dropped riders, so
record depleted bands rather than a fully paid result. Twelve of 18
attack-oriented sources reach a paid single-group band
and the other six reach paid separated-group bands. The audit now accepts
all four read-only road statuses, checks the locked rider count and withheld
awards, and replays every accepted source. The six separated sources have two
road groups. Each accepted recording retains the complete field and withholds
awards. None of these counts is a target win rate. A time gap is never
converted into an individual wheel
position or official winner.

The opt-in `v2-finale-group-last-km-to-line-11` now uses the recorded
one-kilometre snapshot directly when it contains exactly one road group, one
bunch and no dropped riders. The existing paid group runner covers both 250 m
approach intervals and five 100 m finish intervals; its calculated catch
continues with the merged bunch to the line. Four source-linked attack-oriented
40/120 km M/F examples preserve all 32 or 120 riders and their paid energy,
with one group surviving. A constructed narrow-gap example catches inside the
first interval and pays the merged remainder. The older five-kilometre
recording versions remain unchanged. This path reports only aligned
road-band passage times and withholds results and points. Its time-gap model
does not establish physical wheel positions or a common-clock individual
finish, and no manager finisher or lead-out order is applied. It therefore
cannot yet give the race-final entry an individual classified finish.

The separate opt-in `v2-finale-group-cooperative-to-line-12` addresses one
missing work contract on that recorded single-break road. Instead of choosing
the first group member as the only puller, each short slice reselects eligible
workers from the existing break-work orders and current energy. It uses the
kilometre motor's sit-on, drive, cooperation and shared exposure costs, and
records every working rider's paid energy. In fixed 40/120 km M/F examples
with 4, 15 and 20 teams, the source groups have 5–40 eligible workers; all
12 complete fields replay to a surviving-group band with every rider retained.
A constructed narrow-gap case records an exact catch and pays the merged
remainder. This is a new version; the earlier single-puller recording remains
replayable. The existing short-step ability-to-speed conversion is still an
experimental pace assumption, and the source still has passage-time gaps,
not physical wheel positions. This path therefore withholds individual
classification and points and cannot yet open the player test.

`v2-finale-group-common-clock-1` aligns that paid cooperative kilometre on
the bunch's passage clock. The source gap is a difference in passage times at
the same marker; the recorded slice speeds place the break at the bunch's
decision times without moving a rider for free. At a calculated catch, both
bands occupy the same position at the same instant, and the merged riders
continue on the paid road. A large recorded gap can put the break over the
line before the bunch reaches the kilometre marker; this is represented with
a negative break line time relative to that marker, not hidden by a fallback.
The alignment uses the existing constant-speed-within-slice assumption and
reconstructs **group-band** positions only. It does not supply rider wheels,
passing lanes, a lead-out among break riders, a complete individual finish or
points. Fixed short flat and tired rolling examples in both categories, plus
a narrow-gap catch, replay the clock and preserve the paid energy.

`v91-conditional-race-final-3` now joins this group clock to the existing
read-only conditional race entry. It admits exactly one recorded break group,
no dropped riders, no eligible final-kilometre attack or other pending road
action, and no active or ordered chase. It rejects player finisher/lead-out
plans because this band runner cannot yet pay them. All break workers pay
their recorded cooperative work, and every rider retains final energy. The
entry reports `paid_group_bands`, explicitly marks finale plans unapplied and
withholds individual results and points. The older individual-line v1/v2
entry versions are unchanged. This is a complete paid road for one narrow
source class, not a playable tactics-and-results test.

`v91-conditional-race-final-4` admits the same paid group road when a team
ordered to chase has its own riders in that group and the locked kilometre
recording shows no actual chase, response or other pending road action. The
main-race chase rule already withholds pursuit of one's own break. In paired
fictional 40 km flat and 120 km rolling sources, both categories and 4, 15
and 20 teams, changing only the player's `chase` order from `ignore` to `all`
left the paid group clock and place/point bounds identical in all 12 cases;
the source had no chasers. A separate source with a rival's active selective
chase still refuses. This removes an order-label false refusal, not a paid
chase model, individual group finish or point award. V3 recordings stay valid.

`v91-conditional-race-final-5` admits one source-recorded `ordered_all`
chase team outside the break, when its nominated helper is still in the
bunch and no attack, response or selective chase remains unresolved. It
selects the fastest eligible helper at the last-kilometre source using the
existing short-step worker speed, then pays that helper's work on the same
clock as the cooperative break and sheltered bunch. In eight fixed sources
across both categories, 4/15/20-team short flat fields and 4-team tired
rolling fields, the active chase reached a complete paid group-band line.
Against the same locked source with passive bunch travel, the chase reduced
the bunch line time by about 0.39–0.50 seconds and cost the helper about 1.00
additional energy. These are fictional correctness observations, not balance
targets. `v2-finale-group-result-bounds-2` and
`v2-conditional-group-point-bounds-2` replay the paid chase before projecting
possible places and point ranges; all awards remain withheld. Selective,
multi-team and response chases still require their own paid continuation.

`v91-conditional-race-final-6` also accepts exactly two source-recorded
`ordered_all` chase teams outside one break, with no pending attack or
response. The existing short-step chase rotation alternates one present,
nominated helper from each team while the cooperative break, bunch and both
workers share the paid last-kilometre clock. In 12 fixed 120 km flat, rolling
and mountain examples across both categories and 15/20-team fields, every
accepted source retained its full 120- or 160-rider field at a surviving-group
band line. Both helpers spent more energy than on the same locked source with
a passive bunch; the bunch arrived about 0.02–0.05 seconds earlier. The small
effect is a property of these fictional fixtures, not a calibrated sporting
target. Result bounds v3 and point bounds v3 replay the rotation before
reporting possible places or points, with awards withheld. More than two
chasing teams and selective chase remain outside this entry; a two-team
contact and individual group order still need direct end-to-end evidence.

A paired 120 km flat, 15-team men's fixture now checks an earlier strategic
boundary with one locked roster, route and seed. Two conserving `chase all`
rivals leave one break and two engaged chasers at the last-kilometre marker;
a third rival changing from its default attack plan to the same chase plan
closes that break before the marker. The latter source enters the existing
complete-bunch finale, records a nominated player's helper making a paid
lead-out assembly attempt, and brings all 120 riders to individual conditional
line times. The helper never reaches the finisher in this fixture: every
assembly attempt remains `still_separated`. Removing only that attempt leaves
the kilometre race and finisher time identical and saves the helper's energy.
The test therefore asserts a paid failed attempt, not a sprint benefit. The
two-chaser source still yields group bands, and neither path awards points.
This validates a route across source chase, finale and replay; it does not
settle a late two-team catch or group finish order.

`v2-finale-group-result-bounds-1` now derives only the places that this
verified paid road can prove. If the front group survives, its members may
occupy places 1 through the group size and every bunch rider starts after
them; an exact catch leaves the entire field unordered. The separate
`v2-conditional-group-point-bounds-1` applies the existing one-day point
policy to those possible places with an explicit tier and division context.
It reports minimum and maximum possible points, never award rows. Both
projections replay from the paid clock, retain `withheld` status and do not
resolve the order within a road band. In the fixed 4-team flat source the
front contains five riders, so their possible places are 1–5 while bunch
riders can only occupy 6–32. No player-facing point award follows.

## Current complete-bunch boundary

The opt-in `v91-finale-trial-4` carries a caught or contained 500 m bunch to
the line on one clock. It records each rider's actual distance and work rate,
including a lead-out, sprint, exposed coast and a measured reabsorption into
the bunch. The old finale recordings remain intact. Its line times remain
conditional: the 500 m source stores a single bunch band, not wheel positions
or passing lanes. A surviving solo still uses separate provisional bounds.
Neither path is a classified result or a point award. The next gate is a road
position and passing model tied to the locked source, followed by replayable
individual classification and the read-only point projection.

The versioned `v91-finale-trial-5` also resumes that paid individual travel
after an exact solo catch, using the recorded merged road and energy at the
next boundary. Four contact timings are covered, from 400 m to 100 m remaining.
It does not retroactively apply a lead-out order before contact; such an order,
a surviving solo and last-slice contact remain explicitly unsupported by this
continuation. No contact path awards points or claims an official placing.

The subsequent `v91-finale-trial-6` guards a missed causal dependency in that
conditional continuation. A catch in the 300–200 m or 200–100 m slice was
measured without the nominated finishers' sprint, which can start at 300 m and
change when contact happens. The current trial therefore withholds the v5
post-contact runner for those two branches as `unsupported_pre_contact_sprint`.
Only the 500–400 m and 400–300 m catches can currently hand off before sprint
launch. V5 remains replayable as an earlier conditional experiment, not proof
of a late catch under the ordered sprint. The next motor step must move the
solo, bunch and active sprinters on one clock through contact or survival.

The opt-in `v91-finale-trial-7` adds a conservative first-place proof for a
paid surviving solo without a lead-out order. It compares the recorded solo
line time against the earliest time *any* locked bunch rider could cover the
remaining 500 m even with full energy, the best existing riding phase, hard
finale acceleration and bunch draft throughout. A no-chase fictional field
proves the solo first in M/F fields of 4, 15 and 20 teams; coordinated chase
leaves the same solo outcome unresolved against a possible sprint contact.
This is deliberately a bound from the collapsed 500 m bunch band, not a
simulated sprint, full placing, official winner or point award. It makes the
surviving-solo label insufficient by itself to declare victory.

The opt-in `v91-finale-trial-8` tests a single surviving attack from the
recorded 500 m handoff to the line on one elapsed clock. It aligns the solo's
earlier 500 m arrival with the bunch's 500 m time by extending and paying its
measured preceding 250 m pace, then pays every rider's actual travel and work.
An independently moving finisher's return to the bunch is timestamped.
The named finishers can accelerate from 300 m, so their choice can change the
first measured solo contact. That contact stops at its exact distance and time;
the merged continuation is not yet resolved. If no contact occurs, all riders
receive an individual paid line time. The source bunch still lacks wheel order
and passing lanes, so this is a **conditional** line, not a classification or
point award. The current version excludes pre-contact lead-outs, multiple
attacks and conditional chase. Those remain explicit motor gates rather than
silently falling through to an older result.

The opt-in `v91-finale-trial-9` continues a measured solo catch to the line
when **every** locked rider meets at the same contact position. It passes the
exact timestamp, position and remaining energy into the existing paid bunch
runner, which now accepts an initial partial 100 m interval and charges only
the distance actually ridden. This covers early full-field catches in M/F
fictional fields of 4, 15 and 20 teams and varied flat, rolling and mountain
routes. A sprinter catching the solo ahead of the field remains a separate
contact state and is refused rather than flattened into a bunch. The resulting
line is still conditional on the collapsed source road band; no official
places or points are projected.

The separate opt-in `v91-finale-trial-10` puts a nominated bunch lead-out on
the same clock as a surviving solo. The helper and finisher travel together
while the helper can pay for work, and their paired road group appears only
when both have actually moved ahead of the bunch. A selected helper cannot
also chase or rotate in that interval. A paired manager change on the same
locked 40 km race advances the finisher's conditional line and moves exact
solo contact earlier; M/F, 4/15/20-team and tired rolling/mountain replays
retain every rider and energy debit. The run still stops at partial contact,
including a helper and finisher meeting the solo together. It has no passing
rule, classified result or point award. The no-lead-out v8/v9 recordings keep
their older versions and behavior.

The opt-in `v91-finale-trial-11` selects the already paid complete-bunch
runner for a caught or contained named attack and the one-clock lead-out road
for a surviving solo, using the branch recorded by the same locked v91 race.
This consolidates those existing physics paths for the player test. A partial
solo contact remains explicitly uncontinued; a conditional line remains
unclassified. No branch awards points or reuses the kilometre result.

The separate `v91-finale-trial-12` probes the missing complete-bunch wheel
order. The locked 500 m source contains one front coordinate and no rider
positions. A versioned laboratory projection places every rider at or behind
that front, orders prior recorded front workers and positioning skill, and
keeps nominated helper–finisher pairs in one lane. Eight lanes, 2.5 m between
wheels and slight lane staggering are **provisional assumptions**, not facts
from the race recording or adopted sporting rules. All inferred wheels pay
their actual distance and energy to the line; an open-road pass event marks
each trajectory inversion, and the resulting individual order replays. The
passing rule does not model blocked lanes, drafting or contact response, and
the ordering can depend on the assumed grid. Thus `lineOrder` is explicitly
experimental, `classifiedResults` stays null and points remain withheld.
The solo branch keeps its prior one-clock trace. The next gate is a defensible
position/passing model and complete contact continuation, then classified
results and a read-only point projection; this laboratory order alone cannot
open the player test or settle a race.

`v91-finale-trial-13` corrects one causal flaw in that experiment: the v12
source moved nominated helpers and finishers onto a shared lane before either
paid for repositioning. The new independent source assigns the same inferred
wheels with or without a lead-out order. A helper can pull only when its
source wheel is already adjacent and no farther than one wheel ahead; a
distant or rear helper is rejected explicitly. In a paired 40 km fictional
race, the valid helper changes the finisher's paid line time and spends extra
energy without changing the locked race or initial positions. This still
uses provisional wheel geometry and unblocked passing; official places and
points remain withheld. V12 remains replayable as an earlier lab recording.

Verification on 18 October: the relevant old and new finale tests passed (18
focused cases), as did the expanded v13 field tests, lint and an isolated
Next build. The full unit run did **not** pass: its existing concurrent
15-team balance audit reached its 720-second subprocess limit. The same audit
also timed out when run alone, with no assertion result; its script imports
the older ensemble path, not the new bunch runner. This is a test-performance
failure to diagnose, not evidence that the sporting acceptance gate passed.

An offline paired-tactic audit (`node scripts/engine-v2-positioned-finale-audit.mjs`)
now measures the v13 helper gate without changing the race or wheel source.
Its fixed fictional matrix spans 40 km flat, 120 km rolling and 260 km
mountain races; 4, 15 and 20 teams; and both genders. Sixteen of eighteen
sources contain the complete bunch required by this trial. The two 4-team
mountain sources correctly refuse the complete-bunch runner. With rider 7
nominated for each team, only 9 of 226 team nominations in the sixteen
accepted sources have any helper already adjacent and within one wheel ahead
at 500 m; no 20-team nomination has one. In the four 4-team paired trials,
the eligible helper saves the same finisher 0.217–0.231 seconds on the same
locked road and wheels, without changing its place. This is a diagnostic of
the provisional eight-lane source and strict contact gate, not a target
lead-out rate or a calibrated sporting result. A playable lead-out needs a
paid way to establish the pair's road position before this handoff; silently
moving them at 500 m would restore the v12 causal flaw. The current audit
does not settle group geometry, blocked passing, results or points.

`v91-finale-trial-14` adds one paid, opt-in response to that gap without
altering the earlier source or recordings. A nominated helper who starts
behind the finisher in the same or an adjacent provisional lane can spend
their existing lead-out work budget to approach on the common bunch clock.
The speed is limited by the existing hard-effort pace, available energy and
the wheel-sized target; no rider is moved before travel is paid. A recorded
`assemblyAttempts` row distinguishes a pair ready at the next boundary from
one still separated. Only a ready pair pulls on the following approach
slice. The fixed 4-team M/F source with rider 6 just behind rider 7 records
paid assembly, then a paid pull and a changed finisher line time on the same
locked race and starting wheels. A farther-back helper in a 15-team source
spends work twice but does not catch up before the sprint, so receives no
lead-out benefit. Nonadjacent lanes are refused. This addresses one rear
helper case; an ahead-but-distant helper, lateral moves, contested lanes and
solo partial contact still lack a road model. The inferred source and
open-road passing remain provisional. `classifiedResults` is null, points
are withheld and the playable acceptance gate remains open.

The reproducible paired audit `node scripts/engine-v2-assembled-finale-audit.mjs`
holds each fictional race recording and 500 m wheel source fixed, then tries
the closest payable rear helper in the same or adjacent provisional lane.
Its 40 km flat, 120 km rolling and 260 km mountain matrix covers both genders
and 4/15/20 teams. Sixteen of eighteen sources have the complete bunch this
runner requires; the two 4-team mountain sources are correctly refused. Of
the sixteen paired sources, seven helpers reach the nominated finisher's wheel
by an approach boundary, but only six pull before the sprint. In the 40 km
flat, 20-team women's source the helper spends work in both approach slices
and reaches the wheel at 300 m; `assemblyAttempts` says
`ready_next_boundary`, although the next slice is the sprint and no lead-out
occurs. The newer conditional entry now records this as
`ready_without_following_pull`, while a pair that actually pays for the next
pull records `paid_pull_next_boundary`. The old laboratory recording and
its replay retain their original label. The six actual pulls save 0.08–0.11 seconds for
the paired finisher under this fixed source and provisional line model. These
counts are diagnostic of this chosen helper and seed matrix, not a target
lead-out frequency, calibrated outcome or classified result. All tested
points remain withheld. The stronger next vertical step is an earlier,
paid positioning decision and an end-to-end result path, not another isolated
100 m recording.

`v91-early-bunch-trial-1` now reuses the paid individual bunch runner for an
entire last kilometre in the narrower case of one complete bunch and no
current attack order. It locks manager finishers and optional helpers against
the recorded one-kilometre road and energy, places all riders in a distinct,
tactic-independent provisional source, then pays two 250 m approach slices
and five 100 m finale slices on one clock through every individual crossing.
The older 500 m runner and source versions remain separate. In a fixed
40 km men's four-team fixture, rider `rival-3-5` starts behind the nominated
`rival-3-7`, pays to assemble, pulls on subsequent approach slices, and
changes that finisher's crossing time from 88.079 to 87.656 seconds from the
last-kilometre start with the same race tape and initial wheels. In the
fixed 15- and 20-team sources, paired M/F helper orders likewise pay for
assembly and a later pull, and change the nominated finisher's line time
without changing the underlying race or source wheels. In the
18-source route/category/field-size matrix, sixteen complete sources reach
all individual crossings; the two four-team mountain sources are refused
because they do not supply one complete bunch. These figures demonstrate
causal work and explicit coverage, not a target win rate. The source still
infers eight lanes and permits unblocked open-road passing; it has not proved
a real within-bunch order. `classifiedResults` remains null, points are
withheld, and attacks or surviving road groups must use their own paid path.

The same fixed 15-team source also accepts two independent manager lead-out
orders simultaneously: both helpers reach a wheel, pull on the common clock,
and pay each recorded interval once. In a separate paired 120 km rolling
source, changing only one rival manager from the neutral default to hard
effort lowers that team's finisher energy at the kilometre handoff and delays
their conditional line crossing; the player's unchanged finisher retains the
same energy and crossing time. This checks the main-race order-to-finale
boundary, not sporting calibration or official classification.

The shared conditional race entry also replays a fixed 15-team women's
40 km race with rider 6 nominated as the player's finisher and rider 5 as
their helper, while a rival orders its own lead-out. Both helpers pay for
actual pulls and their finishers' conditional line times change against
the same recorded race and tactic-independent source wheels. The default
player captain (rider 7) has no adjacent eligible helper in this particular
provisional source, so a selected pair can still be refused; the test does
not establish a generally usable lead-out choice or an official placing.

`v91-conditional-race-final-1` is a single read-only caller for the payable
branches above. With no named final-kilometre attack, it uses the complete
one-kilometre bunch path. With one supported named attack, it reuses the
recorded caught/contained 500 m bunch path or the one-clock solo path. If a
solo meets the entire bunch at an exact contact and no helper was ordered,
the already measured contact feeds the existing paid bunch continuation;
that continuation now validates the versioned lead-out-capable solo trace as
well as the older no-lead-out trace. A separated solo reaches the line on its
own one-clock recording. A separate passive partial-contact continuation
pays every rider from exact contact to the line when rivals have no chase or
attack order, the source has no active chase or front rotation, and no
lead-out was ordered. It carries prior velocities and work to the next 100 m
decision, then uses existing passive, front and sprint work rules. A new
versioned active-chase continuation pays that same partial-contact boundary
when the source has a measured chaser and rivals have `ignore` or `all` chase
orders. The prior chaser's work continues to the next decision; later chasers
are selected from the recorded orders and remaining energy only while the
named solo remains ahead. After contact, an eligible front-rotation team can
take a paid turn using the existing rotation rule. A source rotation, lead-out,
or rival attack remains explicitly unsupported here. This is a conditional
open-road longitudinal trace, not a joined drafting group or a classified
finish. In constructed
40 km flat (4-team), 120 km rolling (15-team) and 260 km mountain (20-team)
sources it retains every rider, replays the source contact, and pays energy
to each individual crossing. The same three route/field combinations exercise
the active-chase continuation. A separate 40 km case records a chase team
rotating only after the named solo is caught, with each selected worker's
measured slice energy matching the continuation. These constructed sources do
not establish sporting balance.

`v2-finale-chased-partial-after-lead-out-runner-3` also carries a paid
lead-out through later partial contact when the helper's recorded pull has
already ended and contact occurs inside the final 300 m sprint. It preserves
the prior helper work and every rider's exact position and energy at contact,
then pays the active chase and all individual crossings using the same
conditional road rules. A fixed paired 40 km source keeps the underlying race
recording identical while the lead-out spends energy and changes its nominated
finisher's conditional crossing time. In a constructed 54-case matrix spanning
40/120/260 km, flat/rolling/mountain, both genders and 4/15/20 teams, all
54 named player lead-out sources reach this versioned conditional line.
These sources do not validate how large a sporting lead-out advantage should
be. A helper still pulling at contact, an earlier partial contact with a
future lead-out opportunity, and unrecorded positional interactions remain
unsupported.
The companion `v2-finale-passive-partial-after-lead-out-runner-4` applies
the same paid, already-ended lead-out condition when rivals have no chase
order and the measured source has no active chaser or rotation. Constructed
40 km flat men's (4-team), 120 km rolling women's (15-team), and 260 km
mountain men's (20-team) sources all retain their paid helper pulls and reach
every conditional individual crossing. Earlier contact with a helper still
pulling remains outside this branch. Neither post-lead-out version creates a
classified order or point award.
`v2-finale-chased-partial-active-lead-out-runner-5` covers the narrower
contact where the player's active helper–finisher pair reaches its own solo
together, on the measured road, before the final 300 m. It carries both riders'
prior movement and energy to the next decision, reselects the existing paid
lead-out only while they remain together and the helper can pay, retains the
recorded pair group while they ride together, then separates the sprint from
the helper's work. It does not infer drafting with the caught solo. Constructed
40 km flat men's (4-team), 120 km rolling women's (15-team) and 260 km
mountain men's (20-team) sources replay with every individual crossing. In
the fixed 4-team paired trial, the same locked race with a player lead-out
changes the selected finisher's conditional line time from 87.911 to 87.755 s;
this is one fictional seed, not a calibrated benefit or target. Other active
lead-out contacts, rival pairs and official placing remain outside this scope.
Each accepted branch keeps its original source recording and riders,
and every crossing remains conditional: no inferred wheel order becomes an
official result or point award. Other valid attack combinations and existing
separated road groups remain outside this narrow entry.
The unified entry now checks each purported paid line against the locked
roster and the final road frame: every rider must appear once at the line
with matching elapsed time and remaining energy. This is an integrity guard
over existing recording versions, not a new placing or point rule.

The complete-bunch conditional entry now uses separate verified-assembly
runner versions 7/8 and race-final versions 10/11. They replay the older
paid movement exactly and inspect the next recorded interval before
labelling a newly assembled helper as an actual lead-out. In a fixed
40 km, 20-team women's case, `rival-8-5` reaches its finisher's wheel at
the 300 m sprint boundary and receives `ready_without_following_pull`;
the helper never has a `lead_out` role. In a fixed four-team case, a formed
pair has `paid_pull_next_boundary` only where the next interval records both
helper and finisher in lead-out roles. The prior runner and early-bunch trial
versions remain replayable, including their experimental point previews;
the changed labels neither move riders nor award points. They do not solve
lane obstruction or road-group finishing.

The opt-in `v2-finale-multiband-positioned-source-lab-1` now prepares a
provisional individual starting wheel for every rider in the recorded last-
kilometre road groups and bunch. It keeps each band's measured passage time,
every rider's locked energy and group membership, and places wheels only
behind that band's edge using the existing complete-bunch laboratory spacing.
This is a source for a future shared-clock individual continuation, not a
new finish. The six fixed 40/120/260 km cases in both categories and at
4/15/20 teams replay without losing riders; a complete bunch is refused by
this multiband entry. Group-to-group contact, final individual movement,
classification and points remain at gate items 4 and 5.

For one surviving front group and a complete bunch, the offline test input
may now set `"individualGroupLine":true`. The `v2-finale-multiband-
individual-line-lab-1` branch keeps the paid group work and energy through
the 500 m passage, then reuses the existing individual sprint and lead-out
runner separately for each band's remaining road. The optional `finalePlans`
are checked at that passage: a helper in a different band cannot lead out a
finisher. The output records every conditional individual crossing and the
helper's actual work, without changing the old group-band recording or
running a second kilometre race for a refused plan. The six fixed 40/120 km
front-group sources in both categories and at 4/15/20 teams have complete
conditional lines and replay; one four-team paired plan spends helper energy
and changes its selected finisher's crossing time with the same locked race.
That example is evidence of an effect, not sporting calibration. Inter-band
contact and passing still need a common-clock response. The 500 m handoff
also starts the individual finale: prior group chase and cooperative work are
paid through the handoff, while later work follows the existing sprint and
rotation rules rather than extending those group orders automatically. That
choice is provisional and needs sporting review. Other group configurations
retain their explicit band-only status.

The opt-in individual group line now also carries a replayed cross-band
overlap audit. It reconstructs each rider's paid active and sheltered motion
on the shared clock and checks every front-group/bunch pair for the first
longitudinal meeting. This is deliberately a conservative **potential**
contact: lane interaction and the response to an encounter are not modelled.
Six fixed 40/120 km, 4/15/20-team M/F source recordings remain longitudinally
separate to their conditional lines; a synthetic crossing fixture locates its
first meeting at the exact interpolated time and rejects a tampered replay.
Neither finding promotes inferred wheels to official placing or points.

The separately versioned multiband line lab-2 now gives a **provisional**
combined order only when this audit finds no longitudinal overlap and every
rider has a unique paid crossing time. With an optional point context, that
read-only order passes through the existing one-day point policy as an
experimental preview. The test drive still returns no classified result or
award rows, and `canCommitAwards` remains false. Possible overlap and tied
places withhold the preview; the earlier lab-1 records (both before and after
the overlap audit was added) remain replayable. The six fixed M/F, 4/15/20-
team 40/120 km cases have distinct provisional times; one four-team case
also verifies that each displayed point value matches the existing policy.
This provides a consistent test result for clearly separated bands, not a
contact model or a production settlement path.

The opt-in `v2-finale-separated-individual-line-lab-1` extends that same
500 m handoff and individual runner to the existing paid **multiple-group**
clock. It uses each recorded group's own passage time and energy, locks
finisher and helper roles against the actual band, then audits every ordered
pair of bands for possible longitudinal overlap. Six fixed 260 km mountain
sources (M/F at 4/15/20 teams) contain two surviving groups plus the bunch;
all riders reach distinct conditional crossings, with no final-500 m
longitudinal overlap in those sources. A four-team paired case lets an
eligible helper in the bunch spend energy and change its nominated finisher's
time without changing the kilometre recording. A helper across bands is
refused with the locked race still visible to the offline test drive. The
older full-kilometre band recording is retained for replay;
its pre-500 m group-edge separation is still a laboratory premise, and
inferred wheels and open-road passing need sporting review. The provisional
order and point illustration are read-only, never an award or official
classification. Dropped-rider bands and physical cross-band contact remain
outside this path.

The fixed 66-scenario road audit can now also be run with
`node scripts/engine-v2-playable-road-audit.mjs --individual-lines`.
Its default output remains the earlier band-level audit. With individual
lines enabled, the 40/120/260 km, M/F, 4/15/20-team baseline and
independent-manager matrix gives 32 complete-bunch conditional lines,
18 conditional multiband lines, 12 dropped-bunch band recordings, and
four depleted group-plus-dropped band recordings. All 18 multiband
continuations have complete rider crossings, no potential longitudinal
cross-band meeting in their final 500 m, and unique provisional orders.
These fictional cases are a coverage measurement, not a target win rate or
proof of sporting realism. The 16 dropped-rider cases still lack one
full-field individual finale. Two of the four depleted cases also record
unmet energy demand after a dropped rider's reserve reaches zero; their
passages must not be described as fully energy-paid. Inferred wheel order,
pre-500 m contact, and an official result/award remain open throughout.

The separately versioned `v2-finale-depleted-individual-line-lab-1` now
continues active groups and the bunch from their recorded 500 m handoff and
retains each dropped rider's own recorded passage and energy through the
line. An isolated rider is not turned into a cooperative group, and a
helper in another band cannot lead out the nominated finisher. The fixed
66-scenario audit with `--individual-lines` now reaches 32 complete-bunch,
18 multiband, and 14 depleted conditional individual lines. Its remaining
two 260 km M/F cases stop at recorded bands because dropped riders have
unmet energy demand. An explicit finisher or lead-out plan on those two
sources is refused against the same locked race instead of appearing to run.
Four of the 14 depleted continuations have a possible
longitudinal meeting in their last 500 m. All 14 withhold a combined order
and point preview because individual contact before the 500 m handoff is
not audited. This is still a conditional replay, not an official result.

The opt-in `v2-finale-depleted-individual-line-lab-2` now audits the paid
first 500 m as well. It uses each dropped rider's recorded deficit as the
time at which that rider passes the same last-kilometre marker, alongside
the already inferred active wheels. It creates no dropped wheel or shared
dropped group and refuses a provisional order when trajectories might meet.
In the fixed 260 km four-team mountain chase sources for M and F, the one
dropped rider stays longitudinally separate through both first-250 m
passages and the existing final-500 m audit. All 32 individual crossings
therefore receive a **provisional** order and a read-only projection through
the existing point policy. The old lab-1 recording still replays, and neither
version creates an official classification or award. A separate 54-case
route/category/field/tactics probe found exactly these two newly auditable
sources, six paths with unmet dropped energy and no thrown errors; this is
coverage evidence, not a sporting win rate.
The wider 66-scenario `--individual-lines` audit now finds ten of its 14
depleted conditional lines longitudinally separate both before and after
500 m, including a one-group/two-dropped-rider case whose 32-rider preview
passes the existing point policy. Four retain a potential contact and no
combined order; two other sources still stop at unmet dropped energy.

The separately versioned pre-500 active-band audit now carries each inferred
source wheel through the two already paid 250 m band passages. It records a
possible longitudinal meeting and withholds the provisional order if one is
found; it never merges groups or awards points. In the fixed 66-scenario
`--individual-lines` audit, all 18 active multiband continuations have no
pre-500 meeting under those inferred wheel positions, alongside their earlier
no-overlap final-500 check. This narrows the conditional preview's contact
uncertainty for active bands, but the initial wheel positions, lanes and
passing remain provisional. Dropped riders have no source wheel position, so
their pre-500 contact is still unresolved and all 14 depleted combined orders
remain withheld. The official classification and award gate remains open.

A separate fixed flat-road boundary probe
(`node scripts/engine-v2-flat-length-boundary-audit.mjs`) paired 40 and 260 km, fresh and
30-fatigue fields, M/F, 4/15/20 teams, and no attack, ignored chase, or
repeated attack against ordered all-team chase (72 fictional runs). The short
fields reached individual conditional lines in all 36 cases; the 260 km
fresh four-team contested races exposed a single surviving front rider with
no recorded rival chaser. A new versioned group fallback records that all
three rival teams ordered chase but have no helper above the existing energy
minimum. It pays passive group travel and retains the locked road; it does
not invent a chase pull or a solo sprint. The opt-in individual-line drive
initially marked that singleton continuation unsupported while preserving
the paid band. In the six 260 km tired contested runs, zero-reserve riders cannot pay
even the first passive slice. Those runs now refuse with an explicit unpaid
travel reason and no result or points. These are coverage and integrity
observations, not calibrated sporting frequencies.

The opt-in `v2-finale-singleton-front-individual-line-lab-1` now carries a
single surviving front rider's **already paid** final-500 m passages to their
individual crossing while the bunch uses its existing nominated-finisher and
optional lead-out runner. The new recording replays source energy and time,
audits inferred pre-500 m positions and possible final-500 m cross-band
contact, and withholds classification and awards. The separately versioned
lab-2 continuation lets the manager nominate that lone front rider as the
finisher: the first 200 m retain paid group-clock work, then three individual
100 m sprint slices use the existing finale ability and energy cost, with no
shelter or helper. In the fixed 260 km M four-team case, the nomination
changes the solo crossing from 82.559284 to 82.397773 seconds from the
last-kilometre bunch marker, spending about 7.292 extra energy. The locked
kilometre recording remains identical. In the fixed 72-run flat
boundary probe, the two fresh 260 km M/F four-team contested scenarios now
have complete conditional individual lines, with no possible longitudinal
cross-band meeting under the provisional positions. Counts are 38 complete
bunch, 26 multiband, 2 depleted conditional lines and 6 unpaid-travel
refusals. Both gender cases also accept a front-finisher nomination and a
read-only preview through the existing one-day point policy; award rows stay
empty. These are constructed coverage cases; group contact and an official
result are still open.

The tired 260 km flat contested boundary also checks a valid nominated
finisher and lead-out against an unpaid group continuation. The opt-in drive
now returns the same locked last-kilometre road and an explicit unsupported
reason, with no line or point projection, when that fallback cannot pay the
rider travel. Previously this second refusal escaped as an exception. The
fixed M/F and 4/15/20-team probes all retain the group and withhold awards;
they do not establish a playable result for that road.

A paired competing-lead-out probe also exposes an unavailable-plan boundary
in the conditional complete-bunch runner. The fixed 40 km four-team race
cannot place one nominated rival helper beside its finisher on the inferred
source lanes; the fixed 260 km mountain 15-team race has an unavailable
helper at the locked handoff. Both now return an explicit unsupported plan
with the original last-kilometre source and withheld points, rather than an
uncaught exception. Paid same-band lead-outs and their older recordings are
unchanged. A general paid lane-change/assembly path for competing plans is
still required before these cases can count as playable finishes.
With the same two fixed helper nominations, a wider 18-case check spanning
40 km flat, 120 km rolling and 260 km mountain routes, M/F categories and
4/15/20-team fields returned 18 explicit unsupported outcomes and no award
path. This is a concrete remaining acceptance gap, not a tuned failure rate.
It is specific to those two helper IDs, not a blanket failure of competing
lead-outs. In the same fixed 40 km four-team men's recording, player helper
`you-5` and rival helper `rival-1-4` each reach an adjacent wheel, pay a
following pull, and retain an identical kilometre race when the rival helper
is added. The rival finisher crosses about 0.14 seconds earlier than with
only the player helper. `rival-1-0` instead spends assembly energy without
reaching the wheel and gives its finisher no such pull. These outcomes remain
conditional because source wheels and the passing rule are inferred; awards
are withheld. The acceptance gate still needs broader paid competing plans.
The complete-bunch offline summary is now `v91-offline-test-drive-5` and
includes the recorded `leadOutAttempts` with distance, energy, gap and
verified status. This exposes a paid but still-separated attempt without
misstating it as a pull. It changes no underlying motor recording or official
result contract.

A fixed 90-run manager-order probe across the three acceptance routes, M/F,
4/15/20 teams, baseline/one-helper/two-helper/alternate-finisher plans and
a named attack found 46 conditional bunch lines, six depleted conditional
lines and 36 explicit unavailable-plan outcomes. Two long tired four-team
mountain cases with a valid named attack still threw because the controlled
attack trial requires one complete source bunch. The opt-in drive now reports
that road as `v91-offline-test-drive-6` unsupported, retaining the named rider,
the actual locked road groups/dropped riders and withheld points. It does not
run a different race to manufacture a bunch or imply that the named attack
has been paid. The general separated-road attack remains an acceptance gap.
In both fixed M/F cases, `you-4` is an eligible peloton attacker with 40.681
energy; `rival-2-0` is the sole already dropped rider and there is no front
road group. The existing no-front dropped continuation pays the bunch and
dropped rider without a new attack, while the named-attack launch requires
every locked rider in the bunch. A usable continuation must keep the attacker,
bunch and dropped rider on one clock through any contact and finish; simply
relaxing the complete-bunch guard would lose the dropped rider's travel.
On rerun, all 90 requests return a controlled output: 46 conditional bunch
lines, six depleted conditional lines and 38 explicit refusals, with zero
uncaught errors and zero award-capable paths.

A paired 40 km flat, 20-team men's probe holds the fictional roster, seed,
route and recorded rider states at the last-kilometre marker fixed while
changing only the 19 rival managers' chase orders. With all rivals ignoring
the named `you-4` attack, its conditional individual crossing is first; with
all rivals chasing, paid contact occurs about 146 m before the line and its
conditional crossing is 21st. Both complete 160-rider recordings replay and
withhold classification and points. This verifies tactical sensitivity in
one constructed field, not a calibrated rate of late attack wins; inferred
wheel positions still prevent an official result.

The dropped-rider contact audit previously treated the order of rider IDs as
the order on the road. In a fixed 40 km four-team source, `rival-2-3` had a
35.133-second source passage deficit while `rival-2-4` had only 18.788
seconds; the old audit falsely reported contact at the later rider's marker
passage. The opt-in depleted individual line is now lab-3. It compares signed
position on overlapping paid trajectories, regardless of ID order, in both
the first and final 500 m. The old lab-1/lab-2 recordings still replay. In
the fixed 66-scenario `--individual-lines` audit, all 14 payable depleted
lines now have a unique **provisional** individual order and no measured
longitudinal meeting; the four formerly blocked 40 km independent sources
were false contacts. Two other depleted sources still have unpaid energy
demand. This correction changes no riding speed, energy, team order, official
classification or award. Source wheel geometry and lane/passing behavior
remain provisional, so the playable-result acceptance gate stays open.

The controlled late named-attack trial now also accepts an earlier attack
strategy by that same manager. It uses the actual recorded last-kilometre
energy and repeat-attack load; the late named phase still selects the same
locked rider. A paired 40 km flat four-team men's trial keeps the same
fictional roster but changes the player's earlier strategy from no attack to
repeated attack. The latter reaches the last-kilometre bunch with `you-4` at
91.024 energy and 0.82 recorded attack load (0.8 after existing recovery),
then produces a paid conditional 32-rider line and replay with no awards.
Independent rival baseline attacks remain outside this one-attack trial.
When earlier attacks leave a front road group, the actual source is retained
and the trial refuses a complete-bunch finale instead of rerunning it.
Across two fixed seeds, three routes, M/F categories and 4/15/20-team
fields, this player-only earlier repeated strategy reaches 24 paid
conditional lines and 12 explicit separated-road refusals, with no thrown
errors. This is coverage of a constrained order combination, not a balance
claim or support for simultaneous rival attacks.

The offline test drive can now change one chosen rival's baseline tactic by
team ID while preserving its original fictional field and every other
manager's orders. In the fixed 40 km four-team flat example, selecting only
`rival-3` to conserve and ignore chasing raises that team's recorded energy
before the final kilometre and changes its nominated finisher's paid
conditional line time. No older input gains a new setting or recording field,
and this paired observation does not imply an official result or balance
target.

The separate opt-in `"namedDroppedRoad":true` path now retains a valid
last-kilometre named attack when the locked road has one bunch, exactly one
already dropped rider and no front group. It reuses the existing attack and
chase steps for the present bunch, pays each dropped rider independently on
the same elapsed clock, records exact active-road contact and refuses unpaid
energy or dropped-to-bunch contact. In the fixed 260 km tired four-team field,
flat, rolling and mountain routes in both M/F categories each replay all
seven last-kilometre slices with 32 distinct riders. `you-4` splits at the
first boundary and is caught later; `rival-2-0` stays behind and pays every
slice. The new `v2-finale-named-attack-dropped-road-1` and
`v91-offline-test-drive-7` records stop at road bands: nominated finisher and
lead-out plans have not been applied, individual order is unresolved and
points remain withheld. The ordinary test-drive request and older opt-in
recordings retain their existing versions and unsupported outcomes. Sources
with a front group or insufficient energy still refuse this path.
Across two fixed seeds, three routes, M/F categories and 4/15/20-team fields,
12 of 36 opt-in sources use this new paid road; the other 24 keep the existing
complete-bunch conditional line. None throws. These constructed counts test
road coverage, not the rate of successful real-world attacks.

For this same opt-in, a named attacker who is **actually caught by the paid
500 m boundary** can now feed a conditional individual finale. The first
500 m retains the measured attack, chase, catch and separately paid dropped
rider; the remaining 500 m uses the existing tactic-independent provisional
wheel source and nominated finisher/optional lead-out runner for the bunch.
The dropped rider continues on an independent paid clock. In the fixed tired
four-team field, choosing `you-0` or `you-1` as attacker reaches this branch
on flat, rolling and mountain routes for M/F: all 32 riders cross on recorded
energy and the signed cross-band audit finds no contact. With `you-0` on the
flat route, `you-6` works four lead-out steps and changes `you-7`'s
conditional crossing from 88.619 to 88.415 seconds after the last-kilometre
marker; the dropped rider's time is unchanged. The new
`v2-finale-named-dropped-individual-line-lab-1` and
`v91-offline-test-drive-8` preserve the earlier road-only recording and keep
the inferred wheel order explicitly provisional. This early-catch path does
not cover a surviving solo. Neither path classifies an official result or
awards points.

When that new conditional line has 32 distinct, uniquely ordered crossings
and the signed audit shows no possible active/dropped contact, an optional
`pointContext` now supplies `v91-provisional-named-dropped-point-preview-1`.
It replays the full paid road and nominated finale, checks every rider's time,
energy, team and place, then applies the existing one-day division point
policy. A surviving attacker, possible contact or tied place gets no such
projection. The preview has no award rows and cannot commit points; the race
record still says `classifiedResults:null` and `pointsStatus:'withheld'`.

A further separate survivor recording now covers a named rider who remains
alone ahead through the line while one rider remains dropped. It retains the
paid solo and dropped trajectories from the same road tape when the solo is
not nominated to sprint, and runs nominated finisher/lead-out work for the
500 m bunch band. The signed three-band
audit decides whether the independent trajectories could meet. In the fixed
long tired four-team example, `you-5` survives and all 32 conditional
crossings are unique; the read-only `v91-provisional-named-dropped-point-
preview-2` follows the same existing policy. Nominating `you-4` to lead out
`you-7` records four helper pulls but creates possible bunch/solo contact.
That paired run keeps its conditional paid paths, removes the provisional
full-field order and withholds preview points. Two seeds, three routes and
M/F categories repeat those separate/contact outcomes in this constructed
field. The same fixed field now also pays a nominated surviving solo rider's
exposed sprint work over the last 300 m: the solo crosses sooner and with
less energy than under another finisher nomination, while the first 200 m,
dropped passage and bunch work retain their recorded sources. Contact is
audited again before a provisional order or read-only point preview appears.
The same solo nomination reached a separate conditional line in both sexes,
three route profiles and two fixed seeds of this constructed field.
Possible contact between tactical bands still needs paid continuation; no
official placing or award is inferred from these conditional lines.

The separate opt-in `namedDroppedRoad: true, lateCatchLine: true` now covers
one named solo caught **after** 500 m while the same rider remains dropped.
The measured catch and remainder of its 100 m road slice replay unchanged.
At the following paid boundary, the merged bunch starts the existing
individual sprint runner with its actual remaining energy and a distinct,
tactic-independent provisional wheel source; the isolated rider pays each
remaining passage. A signed two-band audit gates the provisional line and
the read-only point preview. On the fixed tired four-team route, attackers
`you-2`, `you-3` and `you-4` catch in successive slices and all 32 riders
cross; nominated sprint work changes the finisher's time and energy. Two
seeds, three route profiles and M/F categories also replay the `you-2`
branch with 32 separate conditional crossings and no award rows. An ordered
lead-out before contact explicitly refuses this branch because that work
has no individual pre-contact trajectory. Without `lateCatchLine`, the
existing `v91-offline-test-drive-7` road-only recording remains the result.
This is still a conditional laboratory line, not an official classification
or points award.
The same request in a constructed 15-team field instead follows the existing
complete-field branch. When that branch has only a collapsed road band and
no individual inferred wheels, test-drive reports its point preview as
unavailable rather than trying to assign places or points.

The opt-in named-attack/dropped-rider test path also rejects a finale plan
that nominates the isolated rider to finish. The rider's existing dropped
passage remains paid, but none of the early-catch, surviving-solo or late-catch
conditional lines supplies sprint work for that rider. All three formerly
could display an unchanged crossing as though the nomination had been applied.
The test-drive boundary now reports `An isolated rider cannot be a paid
finisher.` and withholds the conditional line. The earlier versioned road and
line recorders are left available for replay; this is an input refusal in the
opt-in player path, not a new sporting coefficient.
The same guard now covers the existing opt-in depleted-band individual line:
in a fixed long women's mountain race, nominating isolated `rival-2-0`
previously left both their crossing and energy unchanged while the plan named
them as finisher. The test drive now withholds that conditional line and point
preview. Its earlier versioned recorder remains replayable.

The opt-in late-catch path also refuses a nominated solo finisher when measured
contact occurs after the final-300 m sprint boundary. Its paid road has no
pre-contact solo sprint, so starting that work only in the merged bunch would
silently omit part of the order. On the same fixed 260 km field, `you-4` is
caught after that boundary and now reports the unpaid-work refusal; `you-3`
is caught before it and remains an accepted conditional line. Both retain the
same earlier versioned road recording and withhold official results and awards.

The separate `v91-offline-test-drive-10` opt-in now follows one named attack
when **at least two riders are already isolated** and the attacker is caught
by the paid 500 m boundary. It reuses the named attack/chase road with a new
source version, pays each isolated rider independently on the same bunch clock,
then uses the existing nominated bunch runner, signed cross-band contact audit
and read-only point policy for every individual passage. The earlier one-drop
road/line versions remain replayable. In the fixed 120 km asymmetric field,
4/15/20 teams, M/F categories and flat/rolling/mountain routes all replayed
18 conditional complete-field crossings: 32/120/160 distinct riders,
respectively. The 4-team source has three isolated riders; 15/20 teams have
four. Nominating `you-6` to lead out `you-7` pays four helper steps and moves
that finisher's crossing from 88.616 to 88.507 seconds after the last-km
marker; all isolated crossings and the recorded attack road stay unchanged.
Two seeds in a constructed 260 km flat/mountain 4-team field also reached
eight complete conditional lines across M/F. The corresponding rolling source
cannot pay one active rider to the line and explicitly withholds a finish and
point preview. These counts verify replay and energy bookkeeping in fictional
fields, not calibrated sporting rates. Source wheels and passing remain
provisional, so no official classification or award follows.

The same opt-in named-attack path now carries a **surviving singleton** through
the line when several riders were already isolated. It reuses the recorded
attack road, the existing paid solo sprint and nominated bunch runner, and a
separate paid passage for each isolated rider. A new line and point-preview
version preserve older one-drop recordings. In the fixed 120 km asymmetric
source, all 18 combinations of 4/15/20 teams, M/F and
flat/rolling/mountain produce 32/120/160 distinct conditional crossings and
replay. The 4-team flat source with `you-7` surviving has a payable solo
sprint and a separate provisional point illustration. A rival lead-out pays
work and advances its finisher while leaving the recorded road and all isolated
crossings unchanged; that same plan triggers possible cross-band contact, so
the preview becomes unavailable. Official classification and awards remain
withheld in both cases. Late catches with multiple isolated riders still stop
at the paid-road boundary unless the explicit late-catch option is selected.

The explicit late-catch option now also covers a named attacker caught after
500 m with **several isolated riders**. The measured contact and remaining
partial slice stay on the existing paid road. From its merged boundary, the
existing positioned bunch runner pays every active rider and each isolated
rider pays independent travel against that bunch clock. The new versioned
line replays 18 fixed 120 km combinations (4/15/20 teams, M/F and
flat/rolling/mountain) with 32/120/160 distinct conditional crossings; a
260 km four-team flat/rolling/mountain sample also reaches conditional lines.
The point illustration requires an unambiguous signed band audit. A nominated
solo sprint before contact and a pre-contact lead-out still refuse explicitly
because that work is not in the road trace. Neither new version settles an
official result or awards points, and the older one-drop late-catch recording
remains replayable.

A paired full-race tactic check now holds the fictional route, roster and seed
fixed and changes only `rival-1` from ignoring to pursuing the named attacker.
At 120 and 260 km on a flat route, in both categories and 4/15/20-team
fields, all 12 ignore runs keep that rider separate at the line and all 12
chase runs record a catch. Each still has a distinct conditional crossing for
every rider and withholds official points. This checks that a manager order
changes paid road dynamics; it is a constructed asymmetric field, not a target
catch rate or evidence for retuning speed coefficients.

The opt-in `v91-offline-test-drive-11` path pays a nominated solo attacker's
existing sprint work **before** any contact inside the final 300 m. The
attacker and bunch continue on one clock, so the paid speed and energy can
change the actual contact distance. It then reuses the existing survivor or
late-catch individual-line runners, plus an independent passage for every
previously isolated rider. The sprint-aware road, line and point illustrations
have new versions; earlier recorded roads and lines still replay unchanged.
In a fixed fictional 40 km, fresh asymmetric field, both categories, 4/15/20
teams and flat/mountain terrain give 12 replayed conditional lines with
32/120/160 distinct rider crossings. On the flat source, the old road caught
`you-7` with about 159 m left, while the paid solo sprint keeps them clear.
On the mountain source, the old road caught `you-6` with about 219 m left;
the sprint-aware road delays contact to about 161 m left and pays the exact
partial sprint step. This is a measured tactic effect in constructed fields,
not a calibrated win rate or grounds to change coefficients. A four-team
source permits a read-only point illustration. Larger-field signed contact
uncertainty withholds that illustration. Official results and point awards
remain withheld; a pre-contact lead-out still refuses because its road work
has not been paid. A nominated solo caught before the final-300 m boundary
continues through the existing late-catch path.

The same sprint-aware road has an exact-line boundary: with the fixed 40 km
mountain source and the rival team's level set to 87, the old road catches the
named attacker about 176 m before the line, but the paid solo sprint moves
contact to about 80 m before it. That contact is inside the final recorded
100 m slice. The road pays the remainder, but it has no individual wheel order
at the finish, so the opt-in drive now returns a replayable road-only outcome
with the measured contact and every rider's final road energy. It explicitly
withholds an individual order, point illustration and awards in both M/F
versions. It no longer throws an uncaught line-construction error. The
source is a correctness probe, not evidence for a sporting coefficient.

`node scripts/engine-v2-playable-road-audit.mjs --point-preview` reruns the
existing 66-case M/F, 4/15/20-team, short/medium/long route and mixed/attack/
chase matrix with a fixed read-only tier-three point context. It verifies that
every illustrated rider is unique and has exactly the crossing time and final
energy from the recorded individual line, and that no award row is created.
All 64 cases with conditional individual lines yield a read-only illustration;
the two exhausted four-team mountain sources have unmet energy demand and
explicitly report the illustration unavailable. This checks bookkeeping and
withholding across the existing acceptance matrix; inferred wheels still
prevent these illustrations from becoming official points or results.

A paired two-manager lead-out check now holds each fictional 4-team roster,
seed and route fixed while adding the same two helper orders. Across 40/120 km,
flat/rolling/mountain routes and M/F categories, all 12 planned runs pay both
helpers, record a pull on a later boundary and advance both nominated
finishers relative to the no-helper run. The conditional line and read-only
point illustration include all 32 riders with matching crossing times and no
award rows. The same hard-coded pair is unavailable in
larger 15/20-team fields because at least one helper lacks an adjacent source
lane; the existing refusal remains visible. This verifies a real but narrow
choice effect, not general lead-out availability or a calibrated time gain.

The offline drive now handles that narrow larger-field source-lane refusal
without discarding the otherwise payable bunch finish. In a new
`v91-offline-test-drive-12` wrapper, the original manager request remains
visible, while `appliedRequest` removes only helpers that the existing
source-lane guard proves unable to assemble. Each such helper is listed in
`unavailableLeadOuts` with zero lead-out energy and no paid pull. The existing
race-final and paid-runner recordings remain unchanged and replay against the
applied orders. In the fixed 40 km men's 15-team case one of the two requested
helpers is unavailable; in the 20-team case both are. Both finish all riders,
and their conditional line and read-only point illustration exactly match a
direct run with the applied orders. This is a visible failed tactical attempt,
not paid lateral movement, an improved lead-out effect, an official result or
an award. Cross-band and energy-unpayable plans still refuse where they did.

`node scripts/engine-v2-test-drive.mjs input.json --integrated` is the
single opt-in offline entry for the most complete already paid path. It
selects the existing individual group-line and named dropped-road late-catch
continuations without asking a player to choose internal branch flags. The
older command and each underlying versioned recording retain their behavior;
the output identifies `v91-integrated-test-drive-1` and the selected source
drive version. A fixed 120 km rolling 15-team women's group source finishes
all 120 riders, and fixed tired 260 km mountain M/F named attacks both reach
32-rider late-catch lines. Each recording matches the corresponding explicit
branch run exactly. A source with unmet energy still withholds its line and
point illustration. This is a more cohesive offline motor test, not yet the
browser test flow, official classification or point settlement.
