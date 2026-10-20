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

The opt-in v91 input builder also accepts `settings.managerFinaleOrders` for
any number of known teams, including `you`. Each row names a `teamId` and may
change `effort`, `attack`, `chase` or `frontWork` at the one-kilometre marker.
An explicit `attackRiderId` requires `attack:"selective"` and a rider on that
team. These are visible committed orders in the existing kilometre recording;
two managers can now name different eligible attackers on the same road, with
other managers choosing selective chase or front rotation. The diagnostic
v91 playtest API still stops at the kilometre handoff. The offline test drive,
with or without `--integrated`, routes two named manager orders through that
same committed tour. An exact, fully paid double catch that reaches one
complete bunch at 500 m enters the existing conditional individual runner.
Later double catches and one narrow surviving-front road can also reach
separate conditional individual lines, as described below. Other road states
expose the locked orders, road groups and precise refusal;
neither a provisional kilometre result nor a point award fills the gap. The
test drive also exposes the first replayed common-time event, including each
rider's position and energy paid up to that event, when the source supports
one. Two attackers at the same position still have unresolved group identity
until a separately paid contact record proves it. The
double-catch runner rejects a lead-out helper outside the finisher's adjacent
source wheel. Its inferred lanes and passing rule remain experimental, so
even an accepted line is not an official result. Most surviving-attacker and
attacker-to-attacker contact roads still need paid continuation.
The conditional bunch-to-group fallback and an unsupported group plan reuse
that same locked kilometre recording instead of simulating the race again.
This changes no versioned road or result output.

When both attackers are caught only after the 500 m handoff, the offline
drive can now take a separate conditional individual continuation. It uses
the paid three-band tape only through the first complete bunch boundary
after the second exact catch; it does not charge the tape's later bunch
crossing as well. In the fixed 15-team flat source this handoff is at 200 m
remaining. Each rider starts the existing individual sprint runner with
the energy earned at that boundary, and a nominated finisher's sprint work
is recorded. A helper nominated only after this catch is refused because its
earlier wheel and pull cannot be reconstructed. Wheel slots and passing
remain provisional; the line order is conditional, and classification,
point illustration and awards stay withheld. This one late-catch source does
not establish a general two-attack finish or sporting calibration.

`node scripts/engine-v2-concurrent-late-catch-audit.mjs` repeats one fixed
fictional two-manager setup across M/F, 15/20 teams, short flat/rolling/
mountain routes, 120 km flat or tired rolling routes and a 260 km tired
mountain route. All 24 runs replay a conditional individual crossing for
every locked rider and withhold awards. Twenty use the later paid handoff;
the four long mountain runs are already caught by the older complete 500 m
bunch path. The audit checks roster uniqueness and finite crossing time and
energy. These counts describe coverage of one seed and manager setup, not a
break survival rate or proof of sporting balance. Other seeds and
attacker-to-attacker contact remain open.

When only the rear attacker is caught and the front rider survives, a
separate `v2-finale-concurrent-survivor-line-lab-1` can use the paid two-band
100 m handoff. It retains the front rider's paid solo tape to the line and
replaces only the bunch's remaining band crossing with the existing individual
finisher-only runner under a new `late_separated_bunch` recording label. The
cross-band audit checks every linear frame edge and
active/sheltered change up to the solo crossing, refusing the line if any
inferred bunch rider contacts the solo. This avoids treating line timestamps
alone as proof of no late catch; a synthetic mid-step pass followed by a
slower line crossing is detected by the audit. One fixed fictional manager
pair with a
different nominated attack rider has a 5.20 m front gap at the handoff and a
3.84 m minimum audited gap before the front crosses. All 120 riders get one
conditional crossing. The inferred bunch wheels and passing remain
experimental, so classification, points and awards are withheld. An optional
lead-out is refused because no earlier helper pull has been paid; nominating
the solo itself as finisher also refuses until its sprint can be paid. This is a
separate versioned path; older road and line recordings remain unchanged.
With attack slots `3,5` and the same fictional seed, the configurable audit
records 20 complete conditional lines across M/F, 15/20 teams and flat,
rolling, mountain and tired 120 km routes. The four tired 260 km mountain
runs stop earlier because their two-split 400 m source has no three-band
handoff. All 24 withhold points and awards. This is coverage of one chosen
field and attack pair, not a break survival frequency or motor completion.

The opt-in concurrent double-catch line now has a separate lab-2 continuation
when a manager nominates a lead-out. It reuses the paid 500 m bunch runner's
assembly rule: a helper behind the finisher may spend actual distance and
energy to reach an adjacent wheel, and a pull can start only at a later
recorded boundary. The lab-1 line and runner remain replayable. A paired fixed
20-team source verifies a rear helper's paid assembly against the unchanged
road and initial wheel projection. The offline integrated drive exposes the
assembly attempts and work when this exact double catch is available; an
unresolved attacker relationship still refuses the line and points. The
source lanes and passing rule are provisional, so neither line version
classifies riders or awards points.

For a two-attack run that cannot reach that complete double catch, the same
offline entry now reports the existing later paid common-clock boundary when
it can be recorded. A fixed 15-team flat fixture with two distinct manager
attacks reaches the first attacker's 500 m boundary with the second attacker
and bunch still behind. The exposed event carries every rider's travelled
distance, energy debit and road position and replays from the locked tour.
This is a diagnostic continuation, not an individual finish: the road
relationship, classification and points remain unresolved.

From the fully paid three-band state with the bunch at 400 m remaining, one
event-driven continuation now carries both attackers and the bunch on the
same clock to their band crossings or the first exact contact. Each band
retains its paid pace until its own next decision boundary; the existing
attack, selective chase and front-rotation rules choose the following paid
interval. Fixed flat 15-team men's and women's and 20-team men's sources
reach three separated band crossings with reconciled distance and energy,
and the recording replays from the committed tour. This establishes band
arrival times only. Bunch riders still lack individual sprint positions and
lead-out work, so the integrated drive withholds classification and points.
In the first version, exact contact stops the continuation without inferring
a merge or draft.

A separate dual-survivor line now uses those three paid band crossings when
both attackers remain separated. At the bunch's recorded 100 m boundary it
retains both attackers' paid solo tapes and runs the remaining bunch once
through the existing finisher-only individual runner. It checks the two
solos against each other and both against the inferred bunch positions at
every relevant motion edge, rejecting any unrecorded contact. In one fixed
40 km flat order and seed, M/F categories with 15/20 teams all reach
120/160 unique conditional crossings; the smallest audited separation is
about 0.88 m. The old three-band recording remains replayable. These close
four fictional coverage cases, not a calibrated attack success rate. Inferred
bunch wheels, missing helper work, other road states, official results and
points remain open. The focused replay, full unit suite and lint pass; this
offline motor increment did not change the browser UI or production build.

A paired run now holds that 40 km men's flat route, seed and all 120 riders
fixed, changing only rival-3's front-rotation effort from steady to hard.
Both choices replay the same conditional dual-survivor road state. The harder
turn advances that manager's captain crossing by about 0.035 seconds, charges
more energy to at least one rider, and narrows the minimum front-to-bunch gap
from about 3.84 m to 3.44 m while both attackers remain clear. The solo
crossings barely change because their paid road speeds are separate from the
bunch's last turn. This proves one observable tactic consequence in a fixed
fictional case; it does not establish a calibrated sporting advantage or an
official classification.

When either of the two separated attackers is nominated as a finisher, a
separate lab-2 continuation now starts that rider's existing paid solo sprint
at their own 100 m road boundary. It replaces their later solo position and
energy on the shared clock, reconciles work on each side of the bunch's 100 m
handoff, and audits both solo-to-solo and solo-to-bunch contact before
reporting an individual line. The lab-1 recording remains unchanged. In the
fixed 40 km flat order and seed, nominating both attackers gives all 120/160
conditional crossings for M/F and 15/20-team fields; one nominated attacker
also replays. The sprint work is visible and points remain withheld because
the bunch still uses inferred wheels. These four fictional cases do not prove
that other road states or official classification are ready.

The same two named finisher orders also reach 120 unique conditional
crossings on a 40 km rolling route and a 120 km rolling route with 15 starting
fatigue, with both solo sprint energy debits and positive audited separation.
The 260 km mountain route with 30 starting fatigue reaches three paid band
crossings but refuses an individual line: a provisional bunch rider would
meet a sprinting solo before the line. The offline drive now retains that
specific solo-sprint refusal alongside its unsupported road status, rather
than hiding it in the fallback attempt. These are fixed 15-team men's cases
with one seed and the same manager orders. They show where this version's
contact boundary lies; they do not settle a catch, inferred wheels, official
places or points.

The next opt-in version handles one narrower measured contact: when the rear
attacker reaches the bunch, that rider joins the bunch at the recorded
position and time, pays sheltered travel for the rest of the current interval,
then follows the existing bunch work choices at later boundaries. The older
version still stops at contact and replays unchanged. Fixed men's and women's
15-team sources catch the rear rider with about 194 m remaining and carry the
front rider and merged bunch to separate band crossings; every rider's paid
distance and energy reconcile. In this version, attacker-to-attacker and
front-to-bunch contact still stop unresolved, and no inferred wheel,
individual result or point award is added.

The next opt-in version also continues a measured front-to-bunch contact after
the rear attacker was caught. It preserves the already paid chase until the
next boundary, changes only the caught rider to sheltered cost, and then uses
the existing front-rotation decision with no remaining attack to chase. A
fixed 15-team source records rear contact around 315 m remaining, front
contact around 259 m remaining, and one paid bunch crossing with all 120
riders. The earlier contact-stopping versions replay unchanged. The bunch
still has no individual wheel order, sprint or awards.

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

`node scripts/engine-v2-integrated-terrain-audit.mjs` repeats 96 fixed
fictional integrated runs across custom elevation and exposed flat routes,
40/120/260 km, M/F categories, 4/20 teams and chase, break, mixed or named
attack choices. It checks complete field identity, paid crossing time and
energy against every read-only point illustration, chosen rival orders and
award withholding. The recorded outcomes are 60 conditional bunch lines,
24 multiband lines, four depleted conditional lines, four named late-catch
lines and four depleted road-only bands with unmet energy demand. Twenty-four
point illustrations are unavailable because their recorded order or energy
cannot support one; none grants awards. A separate same-roster custom-route
pair changes only six elevation heights and confirms different source energy
and finisher crossing time. These counts are coverage evidence from one seed,
not calibrated frequencies or an official classification.

Partial solo contact now has a separate read-only
`v2-finale-conditional-crossing-bounds-1` projection. It replays the paid
partial-contact runner's final positions, energy and exact line timestamps,
then gives a place interval for each shared timestamp. In a fixed custom-route
40 km four-team case, four separate sprint crossings allow conditional places
1–4, while the other 28 riders share a recorded crossing and remain in places
5–32. This exposes the actual unresolved order instead of describing that
runner as having inferred wheels. The original paid runner and its version are
unchanged; the projection is not an official classification and still withholds
the point illustration and awards. No wheel proximity, drafting or tie-breaker
is inferred from a common timestamp.

The integrated drive's separate multiband summary now distinguishes an
audited, separated conditional line from a possible cross-band contact. When
both existing overlap audits find no encounter and every provisional place is
present, `v91-offline-test-drive-13` reports
`conditional_separated_inferred_wheels` instead of a contact-unresolved label.
A fixed 260 km mountain example with three road bands and 120 riders keeps its
unchanged paid replay and read-only point illustration. The inferred wheel
positions still require sporting validation; the status does not classify the
race or award points.

When an early lead-out helper cannot assemble from its recorded source lane,
the offline drive now retries the effective finale orders against the same
locked kilometre recording. This avoids rerunning the chosen race for each
unavailable helper. A 15-team fixed example removes one helper and a 20-team
example removes two; both produce exactly the same versioned conditional
finale as a direct run with those effective orders. The ordinary replay
validator still recomputes the requested race to verify the result. The
original request, zero helper work, refusal reasons and point withholding
remain visible.

The prior rear-catch branch now has a separate versioned continuation from
the already paid two-band 400 m state. It reuses the existing band event loop
for the solo and bunch, preserving one clock, ordered work and earned energy
until exact contact or both band crossings. In the fixed 260 km tired mountain
15-team men's source, the solo band crosses 0.13 seconds before the bunch.
A second new version uses the paid 100 m bunch handoff, the existing
finisher-only individual runner and the signed cross-band audit. All 120
riders receive one conditional crossing; the nearest provisional bunch rider
stays at least 0.63 m behind the solo before its crossing. A focused repeat of
this same fictional 260 km tired mountain order and seed with M/F categories
and 15/20 teams reached the conditional individual line in all four cases,
with 120/160 unique crossings and no cross-band contact. The matching
synthetic timings do not establish separate gender balance. The old
three-band and survivor recordings replay unchanged. This establishes one
additional complete laboratory line, not a calibrated finish or coverage of
other routes, orders and seeds. Wheel positions remain inferred; classified
results, point illustrations and awards remain withheld.

The next version of that same conditional individual line explicitly carries
the already paid rear-attacker/bunch contact into the replay. It records the
exact contact time and road position, the two road bands, the caught rider
and their energy at contact. The older line version remains reproducible;
the new event ledger changes no rider motion or provisional order. This
writes the contact in all four fixed M/F, 15/20-team mountain repetitions,
each with 120/160 unique provisional crossings. This closes a replay
visibility gap for this branch, while the inferred bunch
wheels and withheld official classification still need resolution.

The separate `v2-finale-lane-queued-early-bunch-runner-lab-11` pays a complete
inactive-attack bunch from the recorded one-kilometre handoff to every
individual line crossing. It retains each rider's fixed provisional source
lane and chosen work cost, but limits travel at the next wheel in that lane.
It records each block, actual distance, spent energy and the resulting line
time. Across the fixed M/F 4/15/20-team flat and rolling trials and the
15/20-team mountain trials, all supported fields crossed and no same-lane
pass was recorded. A four-team nominated lead-out changed its finisher's paid
crossing on the same source. The older open-road runner and its recordings
remain unchanged. Fixed lanes are a test constraint, not a validated lateral
positioning or drafting rule; the line remains conditional and points withheld.

`node scripts/engine-v2-test-drive.mjs
docs/design/engine-v2-test-drive-example.json --lane-queue` exposes that
separate version in the offline motor test. Its ordinary input already allows
route, terrain, distance, field size, manager tactics and optional finisher/
lead-out overrides. `--full` includes the complete recorded race and paid
kilometre for replay inspection. A source with separated road groups, a
unresolved last-kilometre attack, or an unavailable helper reports an explicit
refusal. The lane-queued
summary gives the conditional individual line, energy, lead-out attempts and
same-lane blocks. It does not classify a result or award points.

The same opt-in lane-queue rule now also starts from an already paid, measured
`caught` or `contained` 500 m handoff after one named manager attack. The new
`v2-finale-lane-queued-caught-bunch-runner-lab-12` preserves the existing
attack decision, source road trace and every source rider, then pays the
remaining individual travel and work behind fixed source lanes. The older
500 m open-road runner is unchanged. In fixed M/F flat, rolling and mountain
4/15/20-team examples where the controlled source is a complete bunch, all
eligible caught attacks reached a unique conditional crossing without a
same-lane pass; the four-team mountain source correctly refused its earlier
separated road. A valid four-team helper changed its finisher's paid crossing.
`--lane-queue` now accepts a single named attack that is caught by 500 m and
reports `attackRoadOutcome`, paid helper work and line energy. A surviving
solo or separated source remains explicitly unsupported by this particular
lane-queued branch; `--integrated` retains the other paid road continuations.

An optional `pointContext` now projects the existing one-day division policy
from either lane-queued version only when every source rider has a unique,
replayable paid line time and energy. The `v2-finale-lane-queued-point-preview-
lab-1` projection retains the source version and fixed-lane rule, and has an
empty `awardRows` array and `canCommitAwards: false`; the drive still reports
`pointsStatus: withheld`. Ambiguous lines have no illustration. This is a
read-only policy check on provisional fixed source lanes, not a sporting
classification or settlement path.

The fixed-lane test also has a separate `v2-finale-concurrent-double-catch-
line-lab-3` path for two named manager attacks when both measured contacts
have already reunited all riders at exactly 500 m. It keeps the paid contact
road, locked rider IDs and 500 m energy, then applies the same paid lane queue
to every individual crossing. The offline `--lane-queue` entry accepts this
specific source and exposes its contact road and conditional line versions;
a later or still separated catch remains an explicit refusal. An unambiguous
line may carry the same read-only point illustration, never an award.
The fixed 20-team fictional matrix has two such exact double catches; both
replayed a queued 160-rider line and a read-only point illustration without
refusal. A JSON serialization check also now covers the prior lab-11 and
lab-12 queue recordings: the paid tail omits an absent optional contact field
instead of writing `undefined`, so saved recordings replay exactly.
On that same locked road and inferred source wheel order, the paired
manager lead-out audit now replays the queued line with and without the
helper. Both valid helpers pay recorded work and leave the contact road and
starting wheels unchanged. One changes the nominated finisher's crossing;
the other does not because the finisher records a same-lane wheel block.
Both outcomes preserve the withheld-awards status. This distinguishes a
paid but obstructed tactical attempt from a guaranteed sprint benefit;
the provisional lanes still do not establish an official placing.

A separate three-seed, 54-case long-race check varied flat, rolling and
mountain routes, M/F rosters and starting fatigue 0/15/30 in 20-team fields.
All 54 no-attack sources replayed 160 unique queued conditional crossings
and a 160-rider read-only point illustration, with points and awards still
withheld. This checks completion under the selected inputs, not broader
attack or sporting balance. In a 260 km tired mountain source, a helper on
an allowed source wheel has less than the existing 20-energy lead-out
threshold. The offline refusal now exposes the selector's `exhausted`
reason and named helper while retaining the locked race and withheld
points; removing the helper order produces the payable 160-rider line.

The offline lane-queue entry was also probed with one named player attack
across 40/120/260 km, flat/rolling/mountain, M/F and 4/15/20-team fields
under one fixed fictional seed. When every rival chased, 48 of 54 sources
recorded a catch and replayed complete conditional crossings; the other six
were the tired 260 km four-team sources with one already dropped rider at the
kilometre handoff, so this complete-bunch branch refused them. Changing the
rival tactics to ignore the attack left a surviving solo in all 54 sources;
all were explicitly refused by this bunch-only queue. These are route and
tactic boundary checks for one seed, not a catch-rate target or evidence that
the separated solo road has an official result.

The integrated offline entry was independently checked on the same 108
route, category, field and rival chase/ignore combinations. Every source
retained all 32/120/160 individual conditional crossings: 48 chased sources
used inferred wheels, six chased tired four-team sources used the separate
dropped-rider path, 36 passive sources retained crossing bounds, and 18
passive sources reached an inferred-wheel line. None awarded points. A
different paired manager order in the fixed 40 km passive source makes a
rival helper and finisher reach the player's solo together at 307 m to go.
The integrated test drive exposes that already recorded exact contact, the
two road groups, active helper and the three riders' energy when this road
is unsupported. The separate `v2-finale-passive-partial-active-rival-lead-out-
runner-6` now continues this narrower case: one rival's paid helper–finisher
pair meets the solo before 300 m to go, with no chase or front rotation.
It starts from their exact recorded positions and remaining energy, pays the
helper's unfinished pull, then the sprint, on one clock. The fixed four-team
paired run keeps the kilometre race unchanged and moves the rival finisher's
conditional crossing from 87.848 to 87.621 s; these fictional timings are
not a calibrated sporting benefit. A fixed-seed 54-case check across
40/120/260 km, flat/rolling/mountain, M/F and 4/15/20 teams replayed all
32/120/160 conditional crossings under the same rival plan. The older
passive, spent-helper and chased own-pair versions remain replayable.
Other multi-rider contact geometry, inferred bunch wheels, official places
and point awards remain unresolved.

The existing flag-gated `/team/v91-playtest` workbench now has an opt-in
"Continue to a conditional finish" mode. It sends the same synthetic route,
length, gender, field, fatigue, seed and manager tactics to the integrated
offline runner, together with a nominated finisher and optional helper for
the player and customized rivals. The API returns the locked kilometre replay
only through the last-kilometre handoff and the conditional finale summary
without writing a result. It does not display the kilometre motor's separate
last frame as if that frame were the paid finale. The page shows road
groups, rider energy, paid helper work, individual crossing times and finale
road events, or the explicit refusal when a line cannot be paid. The original
kilometre-only mode retains its response contract. An isolated local login
fixture passed the full browser flow at 390 and 1440 px: the same 40 km race
produced 32 crossings, and adding an eligible helper recorded 16.5 energy
spent and changed the nominated finisher's crossing. With a fixed fictional
tier-2, division-1-of-2 context, the existing policy illustration changed
the finisher from provisional place 3 / 75 points to place 1 / 125 points;
both runs saved zero awards and kept official points withheld. This is a hands-on
diagnostic race preview, not a classified sporting result or point award.

The browser replay now stops the kilometre trace at the locked handoff and
offers a separate rider-by-rider final-kilometre scrubber only when the paid
frames span that whole handoff-to-line interval. It checks one clock, the
locked field, position continuity and energy debits before exposing the
compact trace. A 54-case no-attack audit across 40/120/260 km, three terrains,
M/F and 4/15/20 teams exposed 48 complete finale traces; the six tired
long-distance four-team sources retained individual conditional lines but
did not invent a full trace from their later continuation. The active-rival
partial contact case likewise keeps its line and contact evidence while the
missing earlier road segment remains an explicit replay gap.

The opt-in browser preview now also accepts one named final-kilometre
attacker from any of the selected teams. It submits the existing controlled
attack order and shows the actual recorded launch, road branch, group count
and 500 m handoff when the engine pays that road. The UI states the current
controlled-trial constraint on the other managers' attack and chase orders;
unsupported combinations remain explicit refusals. In an isolated local
four-team, 40 km flat fixture with three managers ordered to ignore the
attack, a player rider launched at 39 km, remained a solo group at 39.5 km,
and all 32 conditional crossings were recorded with official points withheld.
The browser correctly kept the kilometre replay at the 39 km handoff; its
missing full-finale scrubber for this partial road was not filled with an
unpaid trace. Focused lint, local production build and browser checks for
this case plus the prior 390/1440 px preview flows passed.

The surviving-solo browser path now separately replays its already paid
39–39.5 km approach in two 250 m boundaries. Each boundary shows the bunch
clock, attacker group and gap, and every rider's recorded role and energy
debit. The reducer checks the locked field, contiguous distance and clock,
group membership, per-rider energy continuity and the 500 m handoff. It
does not claim individual positions for the opening approach or splice the
later 500 m continuation into a fabricated full-kilometre trace. A fixed
18-case M/F, flat/rolling/mountain and 40/120/260 km solo matrix retained
all 32 riders at both paid boundaries; this is correctness evidence for one
seed and passive rival plan, not attack balance.
The focused 28-test v2 playtest, finale-trial and replay suite passed. A full
unit-suite attempt and a wider test-drive attempt were interrupted after
their respective first 39 and 28 passing tests stopped producing output;
neither is recorded as a pass.

The browser now retains one previous integrated run for a paired comparison
only when route, custom profile, category, field, fatigue and seed match.
It shows the named final attack, source group count, the nominated rider's
conditional crossing and energy at the line, with a time difference only
when the same rider finishes both runs. The 40 km flat local browser fixture
ran a baseline and then a named player attack with unchanged conditions:
the attack launched solo and changed that rider's crossing. Switching the
route to rolling removed the comparison. All three browser cases passed,
including the existing 390 and 1440 px flows. A serial full unit-suite
attempt also stopped after its first 39 passing tests, at the balance-audit
portion, and was interrupted; the focused suite remains the verified check.

The default-rival selector now includes an explicit passive plan: steady
effort, no attack and no chase. Existing plans and default selections are
unchanged. It lets a manager launch one controlled final-kilometre attack
against 15 or 20 rivals without editing every opponent individually; any
customized manager retains their chosen orders. The opt-in input builder
accepts this new plan for all field sizes. Fixed fictional 4/15/20-team
flat women's scenarios recorded a solo branch and 32/120/160 conditional
crossings; a 120 km rolling, 15-team women's scenario with fatigue 15 also
recorded all 120 crossings. A 390 px authenticated local browser run used
that latter setup with zero customized rivals, showed the 119 km launch and
paid approach, and kept points withheld. The 29 focused motor tests, lint,
local build and all four preview browser cases passed.

A paired passive-versus-hard-chase check held the 120 km rolling route,
fatigue 15, seed, named attacker and roster fixed while changing only the
default rivals' tactical plan. Across M/F and 4/15/20-team fields, each
passive road retained the solo at 500 m and each hard-chase road recorded a
catch. All 12 runs retained 32/120/160 conditional crossings as appropriate,
and the nominated player's crossing time changed without awarding points.
The 15-team mobile browser comparison showed `you-0 (solo road)` becoming
`you-0 (caught road)` and the changed crossing. These fictional outcomes
confirm tactical causality for one seed; they do not establish balance.
The same local browser setup then kept the caught road and nominated a
player helper. It showed four paid lead-out intervals, 4.7 energy spent by
the helper, a changed finisher crossing and all 120 conditional lines, while
points remained withheld. This checks one paid finale tactic after a catch;
it does not establish official classification or a complete positional
replay for this road. The 31 focused motor tests, lint, local build and four
browser cases passed.

The named-attack browser path now also exposes the paid 250 m launch and
250 m follow-up when the attacker is caught or contained before 500 m.
For the fixed 120 km rolling, 15-team women's chase, the recorded solo group
at 119.25 km was caught at 119.438 km; the 119.5 km handoff has all 120
riders in the bunch. The compact trace checks group membership, one bunch
clock and each rider's energy, including work before and after the exact
catch. It also verifies that the 500 m energy and clock match the paid
finale's first boundary. The UI still labels individual positions in this
opening half-kilometre unavailable; the later positioned continuation is
not presented as a full-kilometre replay. A fixed M/F and 4/15/20-team
matrix of the same 120 km rolling chased attack passed all six paid-approach
reductions with 32/120/160 riders and the recorded catch before 500 m.
The existing solo-approach response retains its original shape.

The same caught-road browser case now shows the paid 500 m-to-line bunch
continuation as a separate scrubber. Its first frame must start at the
approach's 119.5 km boundary with the same bunch clock and every rider's
energy; its last frame must match all paid individual crossing times and
line energy. The UI labels these later positions conditional and does not
present the group-only opening half-kilometre as positional replay. All six
fixed M/F and 4/15/20-team chased cases reduced two group-level approach
frames plus five paid finale frames with 32/120/160 line crossings and
points withheld. This is a coherent two-part preview trace for that road,
not an official classification or a full individual-position replay.

The paired browser comparison now includes the nominated finisher's
read-only point illustration when both runs use the same point context.
In the fixed 40 km flat four-team browser case, adding a paid helper changed
the provisional finisher from place 3/75 preview points to place 1/125;
the comparison still showed official points withheld. In the fixed 120 km
rolling, 15-team caught-attack case, both sides instead showed points
unavailable because the road has no unambiguous individual line order.
The UI therefore does not infer a point change from conditional crossings
on a caught road. All four local browser cases passed at 390/1440 px and
for the named-attack scenarios; lint and the isolated preview build passed.

The player-facing paid finale replay now checks every last-frame rider's
crossing time and line energy against the finale's recorded individual line
for both a full bunch kilometre and a caught-attack final 500 m. Altering
either value in a fixed four-team bunch recording makes replay fail closed;
altering caught-road line energy does the same in the 15-team chase case.
This strengthens result/replay consistency without inventing missing wheel
positions in the caught road's opening 500 m. Seven focused replay/point
tests, lint, the isolated preview build and all four local browser cases
passed.

A six-case integrated acceptance matrix now locks one fictional seed across
40/120/260 km, flat/rolling/mountain routes, M/F categories, 4/15/20-team
fields and fresh/tired starts with passive rivals and no final attack. Each
case runs the selected race through its individual conditional bunch line,
checks every replayed final time and energy against that line, and checks
every read-only place and point value against the one-day policy. All six
produce complete paid final-kilometre replays for 32/120/160 riders as
appropriate, with zero award rows and no classified result. This is a
regression gate for that bounded bunch path; attacked and separated roads
retain their separate acceptance scenarios and unresolved position limits.

The same integrated acceptance test now pairs passive rivals with a
coordinated chase against one named player attacker on a fixed 120 km
rolling route with fatigue 15. M/F and 4/15/20-team fields all record a
solo with passive rivals and a measured catch with chasing rivals, while
the roster and seed remain fixed. All 12 runs have 32/120/160 distinct
conditional crossings, as appropriate; each caught road has two paid
group/energy approach frames and five paid final-500 m frames whose last
time and energy match every individual line. The nominated finisher's
crossing changes with the chase. All point previews are explicitly
unavailable and awards stay withheld because the opening 500 m lacks
individual wheel positions. The 12-case integrated test and lint passed.

A full local unit-suite run with two test workers completed with exit code 1.
Only two balance-smoke tests failed, both because their ensemble subprocess
hit its 720-second timeout: the 15-team selective-chase coverage and the
20-team exact-double-catch coverage. The runner reported no other failures.
Those two audits therefore have no verified result from this run; this is
not evidence of a motor assertion failure or a full-suite pass.

The integrated preview now joins a named solo's paid 500 m alignment,
individual pre-contact travel, exact catch and paid continuation to the
line in one scrubbed replay. A rider ahead at the handoff uses the recorded
alignment position and energy; every later frame retains that rider's
physical position and energy on the shared clock, and the last frame is
checked against every conditional crossing. Paired no-helper/lead-out
scenarios across 40 km flat M/4 teams, 120 km rolling F/15 teams and
260 km mountain M/20 teams keep the same full-race recording while the
helper pays work and changes the nominated finisher's crossing. Tampered
alignment, contact and line records fail the replay check. The UI keeps
the conditional-order and withheld-point labels; no award path was added.
Twenty focused unit tests, lint, a local Next build and all five isolated
playtest browser cases passed. The two earlier ensemble audits completed
in isolation in 497.07 and 595.22 seconds respectively, below their
720-second per-test limit. Their earlier simultaneous full-suite timeouts
are therefore consistent with CPU contention rather than a motor assertion
failure.

The complete local unit suite was then rerun with one test worker and the
dot reporter. It finished with exit code 0 in about 52 minutes, including
both formerly timing-out ensemble tests. The serial run establishes a
passing full-suite baseline for this preview commit; it does not shorten
the expensive audits or establish an official v2 result path.

The offline `engine-v2-playable-road-audit.mjs --individual-lines
--point-preview` matrix subsequently covered 66 fictional settings across
40/120/260 km routes, both categories, 4/15/20-team fields, baseline
manager modes and independent tactics. It returned 32 paid conditional
bunch lines, 18 conditional multiband lines and 14 conditional depleted
lines; all 64 have an individual line with points withheld. The remaining
two are the 260 km mountain, fatigue-30, four-team mixed-mode M/F cases:
they retain recorded depleted bands with 0.62112 unmet energy demand and
an unavailable point preview. Neither was silently assigned a finish or
award. This is a bounded coverage result for one fixed seed, not sporting
balance evidence or complete playable coverage.

The preview workbench now accepts two named last-kilometre attackers with
independent manager chase choices and optional front rotation. In a fixed
40 km flat, 15-team local browser scenario, rival-2-2 meets the bunch first
and you-2 is caught next; five paid road boundaries show the groups and
each rider's energy through the complete bunch at 39.8 km. A separate
positioned runner then records 120 individual conditional line times. The
replay checks the two contact positions against the road bands, every
rider's energy continuity, the positioned source, and final time and
energy against the conditional crossings. Tampered energy, contact, or line
records fail validation. The browser shows the paid road segment and its
conditional continuation separately; it does not infer individual wheels
before 39.8 km. Official places and awards remain withheld. This is one
playable two-manager configuration, not coverage of every attack/chase
combination or a classified result. The local browser case, replay unit
tests, lint and an isolated `.next-v91-preview` build passed.

The same two-manager browser flow now also replays a 260 km mountain race
with fatigue 30. In this branch both attackers meet the bunch before the
500 m boundary. Two exact contacts and the paid energy ledger are shown
through that boundary; the positioned runner then supplies each rider's
individual conditional crossing. The first contact's energy is labelled as
an observation because this replay excerpt has no preceding interval cost.
Its recorded contact, later energy debits, 500 m source and final line are
validated without changing the older road versions. A fixed 24-case audit
across M/F, 15/20 teams, flat/rolling/mountain routes and fatigue 0/15/30
returned 20 late-catch and four 500 m double-catch conditional lines, each
with 120 or 160 distinct crossings and points withheld. The replay audit
passed for all 20 late cases; a separate rerun passed for all four early
mountain cases after the new replay was added. Seven focused replay tests,
lint, an isolated Next build and the local browser flow through both roads
passed. These are still inferred source wheels and conditional results, not
an official classification or sporting-balance proof.

The playable result now exposes every recorded individual conditional
crossing, rather than stopping after the first ten. A team selector keeps
the original whole-field conditional order, last-kilometre time, gap and
line energy visible for each rider. Read-only point values appear on those
same rows only when the existing point projection supplies them; a caught
120-rider road with an unavailable projection has no point column. Local
browser checks cover a 32-rider bunch before and after a paid lead-out,
a 120-rider solo-to-catch comparison, and the two-manager paid replay at
mobile and desktop widths. The isolated build and lint passed. This improves
inspection of a conditional test result; it does not make the order official.

The preview can now follow a surviving front group and the bunch separately
from their already paid 500 m passages to every rider's conditional crossing.
The replay checks each group's source membership, 500 m energy, interval
clock, rider travel and energy, and final time/energy against the full-field
result. The group clocks are deliberately shown separately: the front may
pass 500 m before the bunch reaches the last-kilometre marker, and a shared
slider would imply positions the recording does not contain. Twelve fixed
40 km flat and 120 km rolling scenarios across M/F and 4/15/20 teams passed
with 32/120/160 crossings; changing a recorded energy or result value is
rejected. One 120 km, 15-team local browser run lets the player switch from
the 30-rider front group to the 90-rider bunch, scrub both paid continuations
and inspect the full conditional result. Replaying that same locked race
with you-6 as the front-group lead-out records two helper work intervals
and changes nominated you-7's crossing, while all 120 riders still reach
the line. Point awards remain withheld;
cross-band contact and inferred wheels still prevent an official placing.

The same opt-in group-local replay now accepts the separately versioned
three-band continuation on a tired 260 km mountain route. It takes the two
surviving groups and bunch from their recorded 500 m passage, checks every
rider's membership and energy against the paid source, and checks each
band's interval clock, travel and crossing against the 32/120/160-rider
conditional result. Eighteen fixed M/F, 4/15/20-team flat, rolling and
mountain scenarios passed, including the six mountain sources with two
front groups. A local browser run switched between the 5-rider first group,
3-rider second group and 24-rider bunch in the four-team mountain race and
showed all 32 individual times. All seven local v91 browser cases, lint and
an isolated Next build passed. Separate band clocks remain separate;
possible cross-band encounters and inferred wheels still withhold official
places and points.

The fixed 260 km, fatigue-30 chase case adds a different paid road shape:
31 riders remain in the bunch while rival-2-0 is already isolated. The
preview now lets the player inspect the bunch and that rider on their own
recorded 500 m passage clocks through all 32 individual conditional lines.
It checks the isolated rider's passage time, energy debit in each of five
100 m intervals, final position and line energy against the paid record;
the bunch retains its six paid intervals. Both M/F four-team sources and a
local browser playthrough passed, with an altered recorded energy value
correctly rejected. The rider is labelled isolated, never made into a
fictional road group. The earlier half-kilometre contact remains unresolved,
so the combined order and points remain conditional and withheld.

An optional helper can now fail at the paid 500 m decision without losing
the otherwise payable individual finish. The integrated preview removes
only that helper from the applied finale plan, records the rejected helper
and reason with zero work charged, and continues the same locked road and
finisher. Fixed M/F four-team 260 km mountain examples cover an exhausted
front-group helper and a helper isolated from the intended finisher. Their
32 individual crossings exactly match the corresponding no-helper runs;
the road recording is unchanged, while official points remain withheld.
The player can see the reason and the full conditional line in the local
browser. The 24 focused group/replay tests, the affected depleted-line
test, all eight local v91 browser cases, lint and an isolated build passed.
An additional run of the whole test-drive unit file was interrupted after
extended CPU work without a result; it is not counted as a passing check.
Older recorded versions and the saved event path are unchanged.

The integrated playable acceptance test now runs twelve complete locked
races: 40 km flat, 120 km rolling and 260 km mountain; M/F; four and twenty
teams; repeated attacks without chase and no attacks with full chase. Each
case checks the selected route and full field, conditional individual lines,
paid replay for every rider, exact line time and energy agreement, distinct
front-road and dropped-rider membership, and point values computed from the
calendar policy. It rejects an absent paid replay or missing rider and keeps
award rows empty. All twelve cases pass. This is a reproducible cross-layer
acceptance gate (`node --test tests/unit/engine-v2-playable-matrix.test.mjs`)
for the opt-in preview, not proof of an official classification
when separate road bands may interact before the finish. The separate
two-manager and helper tests cover orders outside this compact matrix.

An invalid new scenario no longer leaves the previous race's finish on
screen beside the rejection. The opt-in workbench clears the stale recording
and conditional result while showing the API error. A local browser check
first ran a paid 260 km mountain finish, then submitted a 40 km custom route
whose first 20% exceeds the allowed gradient; the rejection appeared and the
old 32-rider result table disappeared. All eight local v91 browser cases,
the isolated build and full lint pass.

The two remaining mixed-tactic mountain cases in the 66-scenario road audit
still cannot pay individual travel: in both categories six isolated riders
exhaust their reserve and the recorded slices require another 0.621 energy.
The preview now names those riders and displays the unmet demand instead of
leaving only a generic missing-replay warning. It keeps the individual result
and point illustration unavailable. Both cases are pinned in the full-race
acceptance matrix, and a local browser run checks the refusal between two
payable mountain races. All fourteen focused matrix cases, full lint, and a
fresh isolated build pass. This is a documented motor limit, not a completed
finish for those riders.

The acceptance matrix now includes the other two selectable route profiles:
40 km exposed flat road and a 120 km custom elevation profile. Across M/F,
four/twenty teams and attack/chase orders, all eight additional full races
produce paid individual lines whose final replay time and energy match every
result row and whose read-only points match the calendar policy. The test
also checks that exposed kilometres and the submitted custom elevations are
actually locked into the race. All 22 matrix cases, lint, an isolated build
and the local front-group browser replay pass. The result view explains that
times are relative to the bunch's last-kilometre marker; a negative front
time means that rider crossed before the bunch reached the marker. The older
kilometre recording has no paid whole-race clock, so a total elapsed stage
time is intentionally not fabricated from its separate provisional result.
The local browser now also runs both route choices as full opt-in races: a
40 km exposed chase with one paid final-kilometre replay and a 120 km custom
profile with an attack, two paid road bands and a group-local replay. In each
run the nominated finisher can be scrubbed to the line, all 32 conditional
crossings appear, and point values remain read-only. This closes the
route-selector-to-finish check for the five offered route profiles. All nine
local v91 browser cases and full lint pass together on the isolated build.

The wider offline road audit now includes the exposed and custom profiles at
4, 15 and 20 teams in both categories, with mixed, attack and chase defaults
plus independent manager choices. With a fixed read-only point context, 108
of 110 fictional full races record an individual line: 56 paid single-group,
30 conditional multiband and 22 conditional depleted lines. The only two
unpaid cases are the previously identified four-team mountain mixed plans in
M/F; both still withhold lines and point illustrations. The audit now fails
if any other scenario loses its paid line rather than silently counting a new
unsupported road. Its point illustration continues to match the existing
one-day policy for every recorded individual place, with no awards saved.

The paired integrated lead-out gate also now covers the 40 km exposed and
120 km custom routes. It holds the full kilometre recording fixed while
switching the nominated finisher's helper on, then checks paid helper work,
the altered finisher time, exact-contact replay and all riders' line time and
energy. Both routes retain a conditional line and withheld official points;
all 17 integrated acceptance cases pass.

Two further paired full races isolate one rival's manager choice. On 40 km
exposed M and 120 km custom F roads, changing only rival 1 from passive to
hard chase turns the named player's attack from a paid solo road into a paid
catch before 500 m. The locked route and all rider inputs stay identical,
while the approach groups and nominated finisher's crossing time change.
Both runs still record all 32 individual conditional lines and withhold
official places and points. All 19 integrated acceptance cases pass.

The local browser comparison now exercises the same one-rival change on the
40 km exposed route. It shows the solo road, then the paid 39.462 km catch on
the replay boundary after rival 1 switches to hard chase. The nominated
finisher's crossing changes, all 32 conditional lines remain visible, and
official points stay withheld. This ties the paired motor evidence to the
actual manager controls and replay rather than only an offline test call.

A second deterministic full-race gate varies five seeds per route and
category, rotating mixed, attack and chase defaults across 4- and 15-team
fields. In 48 of 50 runs, all riders have paid individual crossings whose
replay time and energy match the result, and every available point value
matches the one-day policy without saving awards. Only the two already known
four-team M mountain mixed runs have unmet energy and no line, replay or point
illustration. The seed gate replays these expectations from locked fictional
inputs rather than treating an unexpected refusal as a passing case.

The integrated competing-lead-out gate now orders two managers on the same
40 km flat road. Their source-lane pairs assemble without a fallback; both
helpers record positive work, both nominated finishers cross earlier than in
the identical no-helper race, and all 32 line times and energies match the
paid replay. Turning on either helper alone or both leaves the locked
kilometre race identical. The local browser exercises both manager controls,
both helper work totals, the finish replay and withheld official awards.
All eleven local v91 browser cases and full lint pass. This is still a
conditional preview, not an official classification.

The playable comparison now resets after a rejected race. A valid 40 km
finish, an invalid custom profile, and a return to the original route no
longer compare the last finish against a run that never happened; the next
two valid runs can form a fresh pair. The failed request also clears its
replay state. This was checked through the isolated production build and a
local browser. The new four-run browser case and the other eleven v91 cases
pass on separate fresh fixture servers; all twelve together exceed the
fixture's race-per-minute limit and return a deliberate rate-limit response.
Full lint passes. No production race or award path changed.

A cross-product gate now runs the full recorded race for each of the five
selectable terrains at 40, 120 and 260 km, in M/F fields with both attack and
chase defaults (60 cases). Each race locks the requested distance and terrain,
records a crossing for every rider, and matches each rider's final replay time
and energy to that crossing. The read-only point illustration matches the
existing one-day policy; official results and awards remain withheld. A
separate 30-race long-road gate tests mixed/selective plans at 260 km across
all five terrains, M/F and 4/15/20-team fields. The 15- and 20-team fields
record paid individual lines; the ten four-team cases consistently record
unmet energy demand and withhold line, replay and point illustration. These
are observations for the locked `cross-route-1` fixture, not a rule that every
four-team or mountain race fails. They clarify the earlier 50-seed audit's
two mountain exceptions: in that audit the tactic rotation sampled this
long, small-field mixed combination only twice. The current energy debt is
thus a long-road, small-field limit in this fixture, not an isolated mountain
profile bug. No physical crossing or official classification is invented to
hide it.

The source frames locate this debt before the short finale. In all ten
`cross-route-1` refusals the same six rival-1 riders first reach zero reserve
between km 231 and 247 (flat/exposed: 242-245; rolling: 240-247;
mountain: 231-240; custom: 240-246), then continue moving under the older
kilometre motor's zero-reserve clamp. The 0.62112 unmet demand is only the
recorded final-kilometre amount; it does not account for the earlier
zero-reserve kilometres. A fix confined to the final 100 m would therefore
claim a paid crossing while leaving the rest of that road unexplained. The
next motor version needs one explicit exhausted-travel rule and ledger from
the first exhausted kilometre through the line, with matching speed, group,
replay and result semantics. Preserve the older versioned recording and keep
the current refusal until that entire path is verified.

The full integrated preview also now keeps the expected response shape when
the underlying drive refuses an unsupported cooperative road before a paid
finale is recorded. With a fixed 260 km flat, fatigue-30 four-team source,
changing only rival 1 from hard chase to conserve/no chase creates one front
group whose last-kilometre action is unresolved. The workbench shows that
reason, the locked group, no individual crossing and withheld points instead
of failing while reading a missing summary. A paired run with the same
route, seed and roster but a steady chase produces 32 individual lines,
showing that this is a meaningful manager choice, not a generic long-distance
failure. The focused refusal and
integration tests, full lint, an isolated build and a local browser playthrough
pass. The broader test-drive file was started but interrupted because its
expensive legacy scenarios did not finish within the turn; the eight affected
integration/refusal cases completed successfully in a separate run.

The integrated full drive now retains the original locked kilometre source
when an expected refusal carries one. In a 120 km cooperative-road fixture this
lets the browser reuse the same 120 recorded frames for its handoff display
instead of starting a second simulation after the refusal. The older direct
test-drive refusal remains a plain summary by default; only the integrated
full caller requests the source. A focused test checks both shapes and the
source frame count. Refusals without a recoverable source remain explicitly
unsupported.

The 260 km flat cooperative-road refusal above is now superseded for a
specific payable case. Its sole external selective-chase team has no helper
at the minimum energy required to chase; the front team's active leader is
in that group under a protect-forward order. Version
`v91-conditional-race-final-13` records
that unavailable selective team, lets the group and bunch pay passive travel,
and reaches 32 individual lines with replayed time and energy. The same
bounded case pays and replays across all five selectable terrains in M and F
four-team fields (ten locked `cross-route-1` runs); point illustrations match
the one-day policy while official awards remain withheld. A separate 40 km
case with a potentially payable selective chase still refuses rather than
inventing the chase decision. The older unavailable all-out chase recording
retains version 12. Focused engine tests, the broader conditional-race gate,
the route/length gate, lint, an isolated build and both local browser paths
pass. This does not settle other active selective chases or the 260 km
zero-reserve debt documented above.

A separate, already engaged selective chase now has a bounded paid path in
version `v91-conditional-race-final-14`. The locked 39 km source records one
external team chasing a 17.51-second group under a `gap_over_limit` decision.
The same named helper pays work in every short slice; the recorded gap remains
above the selective safe-gap threshold, so every decision stays engaged and
the group survives. Ten 40 km route/category cases (five terrains, M/F)
retain all 32 individual lines, matching replayed times and energy and
read-only one-day point values. A future selective hold or catch is still
refused until its changed road is recorded. Official awards remain withheld.

Turning that rival's order to ignore produces a different separated road
with `you-7` alone in the first band at 500 m. Its paid individual
continuation is now `v2-finale-separated-individual-line-lab-3`: five
recorded road slices supply the singleton's passage time and reserve, and a
nominated solo sprint pays fresh work over the final 300 m. Without that
nomination it retains its exact road time and energy. The other group and
bunch keep their existing individual runners; a nominated bunch finisher
can still receive a paid same-band lead-out. All 32 crossings, replay
frames and read-only point values agree in ten 40 km route/category cases
(five terrains, M/F); cross-band contact stays gated and official awards
stay withheld. The older separated line versions remain replayable for
their original non-singleton roads.

The 120 km selective-chase handoff has a separate version,
`v91-conditional-race-final-15`. In the locked kilometre source, rival 1
chased a nearer group that was caught while another group remained 46.26
seconds ahead. The source therefore lists the chaser but no active
engagement with the surviving front group. At 119 km the selective order is
decided afresh against that recorded front gap, including the captain's
awareness and the one-kilometre safe-gap threshold. It engages; the named
helper spends energy in every subsequent slice, and each slice's decision
remains engaged. A hold, unawareness or catch still refuses the entire paid
continuation. Ten 120 km terrain/category combinations retain matching
individual crossings, replay energy and read-only points. This is an opt-in
preview recording; official awards remain withheld. The separate 260 km
zero-reserve refusal remains.

The 120 km browser path now also selects `you-6` as the front-group lead-out
for nominated finisher `you-7`. The paid runner records four lead-out rider
intervals and changes the finisher's crossing on the identical locked road.
That check exposed a replay-summary error: when every front-group rider had
already crossed in the final 100 m slice, its positioned tail was a valid
zero-time, zero-distance ledger frame. The multiband replay previously
rejected every zero-duration frame, returning a service error despite a
complete paid line. It now accepts only an all-finished final tail whose
positions and energy remain unchanged. A forged work debit in that tail is
rejected. The full 25-case multiband replay suite, lint, isolated build and
both local browser paths pass; the official awards remain withheld.
Four additional 120 km flat runs at starting fatigue 15 verify the same new
selective decision in 120- and 160-rider M/F fields, with complete crossings,
replay energy and read-only point agreement.

A committed 14-case full-race acceptance gate now compares the same locked
120 km recording before and after nominating `you-7` with `you-6` as lead-out.
It covers every selectable terrain in M/F four-team fields, plus 15- and
20-team flat fields in both categories. The helper pays recorded work and the
finisher reaches the line sooner; all riders' crossing times and energy match
the final replay, and the provisional point order uses the existing one-day
policy while official awards stay withheld. This checks an actual manager
choice through the complete selected race rather than another detached short
slice. The 260 km zero-reserve mixed-plan refusal remains in the same gate.

The two-manager path is now locked as six more complete 120 km tests: M/F
fields of 4, 15 and 20 teams choose a front-group helper for `you-7` and a
bunch helper for `rival-1-7` after rival 1's selective chase. Both helpers pay
and both finishers improve against the identical race without those orders.
The band overlap audit keeps the roads separate, every line time and reserve
matches replay, and the provisional point order remains read-only. A local
browser run against an isolated build and login fixture also selected both
orders, received a successful integrated API response with 32 crossings and
paid replay, and rendered both helpers, both road bands and the conditional
result with official points withheld. Rival 1's attack must be set to `none`
for this exact road; leaving its UI default at `selective` creates an extra
front group and correctly marks the nominated bunch helper unavailable.

The long-race two-manager acceptance matrix now covers 20 complete 260 km
runs: every selectable terrain, both categories, and 15- and 20-team fields
at starting fatigue 30. On this locked road, the previously nominated
front-group and rival-1 helpers cannot work at 500 m; their group or energy
is unsuitable. Instead, `you-5` leads out `you-4` and `rival-2-6` leads out
`rival-2-4` in the peloton while two front groups and an isolated rider remain
separate. Both helpers pay for their actual recorded distance, both finishers
cross earlier than on the same road without those nominations, all 120 or
160 rider energies and crossing times match replay, and preview points match
the existing one-day policy. The pre-500 m and final-band overlap audits find
no contact in these sources. Results and points remain explicitly provisional
and awards withheld; this matrix does not solve a mixed four-team 260 km
source with sustained zero reserve or contact in other road states.

An isolated local build and Playwright run also exercised the 260 km flat,
15-team, fatigue-30 case through the signed-in workbench and local API. The
UI selected two custom managers, default attack tactics for the others, and
both peloton lead-outs. The API returned 120 individual conditional crossings,
paid work by both helpers and a road-local replay whose final position, time
and energy matched every crossing. The browser rendered the helper work, all
121 table rows including its header, the recorded road-band selector and
official points withheld. This is one end-to-end case within the 20-case
motor matrix; it does not make the conditional result official.
Changing only rival 2's attack from selective to repeated in the same browser
run moves its nominated helper to a different road group at 500 m. The API and
UI then report that helper unavailable and charge it no work, while the other
team's helper still pays and all 120 conditional crossings remain replayable.

The full-race refusal now exposes a read-only source energy audit. It scans
the committed kilometre frames before the finale and lists riders whose
energy is zero in successive whole-kilometre snapshots, with the first pair
of kilometre numbers. Across the ten locked 260 km mixed-plan four-team
refusals, six riders meet that condition; accepted 40/120/260 km cross-route
cases have no such pair. A local browser run on an isolated build shows this
earlier exhaustion alongside the last-kilometre unmet demand, with no
individual result or point illustration. This audit diagnoses the missing
travel rule; it does not charge energy or change a versioned recording.

The isolated v92 candidate adds a read-only energy ledger for every rider in
every full kilometre. Each row records starting reserve, demanded work, work
paid from reserve, unmet demand, recovery, any cap adjustment and ending
reserve. The recording validator checks the arithmetic, roster coverage and
continuity with the road frames. Paired tests over 40, 120 and 260 km with
4, 15 and 20 teams confirm that stripping the new ledger and version marker
reproduces the exact v91 recording, including road groups and provisional
finish. The v91 workbench retains its original
source recording and only uses a v92 diagnostic replay when the complete
recordings match. In the ten locked 260 km mixed-plan four-team refusals,
that replay identifies unpaid whole-kilometre work before the finale and
shows the first affected kilometre and total unmet demand in the local UI.
The route/length cross matrix, a focused ledger test, lint, an isolated build
and a local browser refusal test pass. This is evidence of an unresolved
motor debt: no physical speed or road-group response to that debt has yet
been paid, so these sources remain unclassified and points are withheld.

The isolated v93 motor candidate tests a whole-kilometre exhaustion rule.
Energy here is a reserve for the ordered pace, not a rider's total ability to
move. If a non-breakaway rider cannot pay that pace, the candidate reduces
the actual work to available reserve and records the curtailed work and a
slower sustainable pace. The speed loss is bounded at 35%; the resulting
seconds are added to that rider's road deficit, so a rider unable to hold
the bunch drops rather than travelling a full kilometre at its speed. The
same time formula is used to validate the recorded delay, and the final
individual provisional result retains the final road group and energy.
Ten 260 km mixed-plan four-team cases across all selectable terrains and
both categories convert their previously unpaid whole-kilometre work into
recorded delays with no remaining energy debt. A further 40 long cases with
15/20 teams, attack/chase plans, both categories and all five terrains retain
complete, debt-free recordings. A 120 km well-funded comparison reproduces
the exact v92 road when no rider needs the rule. This candidate has not yet
been joined to the nominated finisher/lead-out short-step finale; its result
is provisional and no points are awarded or committed.
Focused v93 and v92 tests, the existing v91 route/length regression,
full lint and an isolated build pass. Two local browser regressions confirm
that the v91 refusal and the paid two-manager lead-out remain unchanged.

The next isolated v93 handoff carries those dropped riders from the recorded
259 km frame through a versioned 100 m last-kilometre clock. Each slice
starts with the actual rider deficit and reserve, caps reserve spending, and
reduces sustainable speed by the same bounded 35% unpaid-work fraction used
by the whole-kilometre v93 motor. Its passage clock, rider deficit and energy
can be replayed to the 260 km line. All ten locked four-team mixed-plan
260 km roads (five terrains, both categories, fatigue 30) cross this clock
without an unrecorded catch or new drop; tampered passages and a v92 source
are rejected. The older depleted-reserve recording keeps its original
unmet-work fields and replay. This is still a road-band clock: it does not
pay nominated finisher or lead-out orders, rank riders within a front group
or bunch, or unlock points on its own.

An opt-in v93 offline playtest now joins the locked 260 km source, coasted
last-kilometre clock, 500 m nominations and full-field individual line.
On ten mixed-plan four-team roads spanning every terrain and both categories,
all 32 riders receive replayable crossing times and line energy. Two
managers can simultaneously nominate different finishers and lead-out
helpers in the front group and peloton; both helpers pay for recorded work,
and both finishers gain time relative to the identical road without those
orders. Road-group identity and dropped rider deficits are preserved.
The default line receives read-only policy points only when every placing is
unique. In the two-helper example, two front riders tie; the point preview
is withheld rather than assigning either an arbitrary place. Cross-road
helpers and altered replay are rejected. Official classification and awards
remain withheld. Broader fields, lengths and attack/chase outcomes still need
end-to-end checks before the motor gate can be considered met.

The v93 line is now available through a separately gated mode in the local
fictional-race workbench. It reuses route, category, length, manager tactics,
finisher and helper controls, then shows kilometre road groups and exhaustion,
the last-kilometre passage clock, band-local paid rider replay and all
individual conditional crossings. Both `PELOTONIA_V91_PLAYTEST_ENABLED` and
`PELOTONIA_V93_COASTED_PLAYTEST_ENABLED` must be explicitly true; no production
endpoint or live event flow calls this candidate. An isolated build and local
browser login-fixture test selected the 260 km flat, four-team, fatigue-30
road, customized two rival managers and paid one lead-out in the front group
and another in the peloton. The API and UI showed 259 locked kilometres,
the 260 km clock boundary, 32 individual results and withheld official points.
Rerunning without helpers showed 32 read-only policy point rows where the
order was unique. Two existing v91 browser flows still passed with the v93
gate disabled. Other chosen settings may receive an explicit unsupported-road
response until their v93 finale state is covered.

The next v93 preview increment accepts a second, versioned road shape: at
the 259 km handoff, at least two separated front groups and no dropped
riders. It reuses the existing paid separated-group 100 m clock and
individual finale, but checks the v93 source recording and issues a distinct
v93 playtest and read-only point-preview version. The coasted branch remains
unchanged. In a 30-case 260 km attacking-road matrix (4, 15 and 20 teams;
five terrains; both categories), every rider has a replayable crossing,
recorded energy, and a road band. The policy projection requires a unique
placing and never creates award rows. A separate four-team attack case pays
simultaneous nominated lead-outs in the leading group and peloton; both
helpers expend recorded energy and both nominated finishers improve on the
same road without assistance. Shorter and less fragmented roads still
return explicit refusals. This extends the playable preview without
promoting either v93 branch to an official result.
Focused coasted and separated unit checks, lint, isolated build, and both
local browser fixture flows pass. A full unit-suite run was stopped after
roughly 20 minutes while existing long-running balance and test-drive
simulations were still active; it did not yield a full-suite verdict.

A versioned one-front-group v93 branch now extends the same local workbench
to short and medium attacking roads. It keeps the existing multi-group
recording format intact, while a new 100 m trace follows one surviving front
group and the bunch from the locked final-kilometre handoff. The paid 500 m
handoff reuses the individual band runner, nominations, lead-out work and
read-only point policy. Direct runs cover 60 combinations of 40/120 km,
4/15/20 teams, five terrains and both categories at fresh start; 40 more
four-team cases at fatigue 15/30 resolve through either this one-group or
the separated-group branch. The first 40 km flat case pays simultaneous
lead-outs in the front group and bunch, and both nominated finishers gain
time compared with the same road without helpers. At this point, a bunch-only
final-kilometre handoff remained unsupported, including the ordinary mixed-plan
short and medium roads tested here. The new branch remains conditional and
non-awarding.
The 20-case four-team short/medium replay matrix, prior v93 coasted and
separated playtest suites, 12 older separated-clock/line/point checks, lint,
an isolated build, and three local browser fixture flows pass. The full unit
suite was not repeated for this branch after its earlier long run was stopped.

A separately versioned v93 bunch-only branch now pays the remaining common
short/medium handoff: no front group, no dropped rider, the entire field in
the peloton. Seven recorded short-step passages carry its energy to 500 m
and the line; an inferred but fixed bunch position source feeds one paid
individual band. The existing nominated finisher and optional helper rules
then produce crossing times, energy, and a read-only policy projection when
the order is unique. The branch records no front group or cross-band audit
where none exists, and it still saves no classification or award rows.
Direct full-race checks cover 180 fresh 40/120 km combinations across
4/15/20-team fields, five terrains, both categories, and mixed/chase/neutral
rival defaults. Forty additional four-team mixed-plan cases at fatigue 15/30
also finish through this branch. Twenty default four-team cases replay their
clock, individual results and point illustration; a two-manager bunch test
pays both lead-outs on the identical locked source road. A changed passage
and an older motor recording are rejected. The older separated/depleted
clock, line and point tests remain green.
The 20-case replay matrix, 12 older separated/depleted checks, lint, an
isolated build, and four local browser fixture flows pass. The full unit
suite was not repeated after its earlier long run was stopped. At this
point, roads with no front group but one or more dropped riders still
returned an explicit refusal; all v93 points remained illustrative and
non-awarding.

The bunch-only v93 handoff now also accepts a final-kilometre source whose
last full kilometre recorded chasers before catching the front group. The
source has no front group or engaged chase target at the boundary; the old
no-front/dropped version keeps its stricter source guard. A fresh 120-case
260 km matrix (four teams, both categories, five terrains, four rival plans,
fatigue 0/15/30) completes and replays every road: 66 bunch-only, 30
separated, four single-group and 20 coasted. Six of the bunch-only cases
had a recorded chaser and catch in kilometre 259. A targeted 260 km browser
fixture follows such a catch through 32 individual crossings. Focused new
and legacy clock tests, lint, isolated build and all five v93 browser
fixtures pass.

A separate v93 coasted no-front branch now covers a bunch with already
isolated dropped riders at the final-kilometre handoff. It retains each
recorded source deficit, pays the peloton and dropped passages on one clock,
and reuses the individual active and isolated runners with pre-500 m and
final-500 m longitudinal audits. In the fixed 260 km tired four-team source,
one dropped rider remains behind the peloton across all seven passages and
all 32 riders obtain replayable individual crossings. The nominated bunch
helper spends recorded energy and improves its finisher without changing
that isolated rider's crossing. Ten such sources (both categories, five
terrains) replay with 32 policy-consistent read-only point illustrations.
A further 60-case 260 km matrix across 4/15/20 teams, fatigue 15/30, both
categories and five terrains completes and replays: 50 complete bunches
and ten no-front/dropped roads, with no errors. Older recording versions
retain their own validation and the branch saves no award rows.
The targeted new and prior coasted/no-front, positioned-source,
individual-line and point-policy unit checks, lint, and an isolated build
pass. All six v93 local browser fixtures pass in one run. The sixth test
uses a second local fixture user to remain within the preview API's
per-user rate limit. The full unit suite was not repeated.

The full-distance audit now includes 160 new 260 km cases in 15/20-team
fields (fatigue 0/30, both categories, five terrains, and mixed/chase/
neutral/attack rival defaults). All 160 produce a conditional finish: 120
complete-bunch and 40 separated roads. A separate 108-case four-team,
fatigue-30 multi-manager matrix varies the player's effort, attack and
chase across both categories and flat/mountain routes. It exposed a caught
front group whose earlier chasers remain in the source recording, plus
multiple already dropped riders. The v93 no-front coast now accepts that
historical chase when no chase target remains engaged, records the bunch
and all three isolated riders through seven passages, and replays all 32
individual crossings. The earlier version's stricter guard remains intact.
When the paid individual bands have potential longitudinal contact, the
read-only point illustration is explicitly unavailable and all awards stay
withheld rather than inventing a placing. With this increment, 78/108
multi-manager cases complete, including 52 point projections and 26
unavailable illustrations; 30 still refuse because an active or newly
exhausted rider lacks payable final-kilometre travel. The large-field and
multi-manager matrices are direct API-engine probes, not browser replays.
The targeted new and adjacent unit suites (12 tests), lint, isolated build,
and all seven v93 local browser fixtures pass. The seventh browser flow
tests this exact three-isolated-rider point-withholding case. Full unit
suite status is recorded separately when run. A full `pnpm test` attempt
was stopped after 30 minutes with the existing `engine-v2-test-drive`
matrix still active; this is not a full-suite pass.

Two additional local browser acceptance flows now cover larger fields.
On the default six-point custom elevation route, 15 teams race 260 km with
fatigue 15 and an attack-minded rival default. The locked road has one
front group and six isolated riders; the nominated player finisher is one
of those isolated riders at zero reserve. The preview shows eight replay
bands, 120 individual crossings and 120 policy-derived read-only point
entries. The exact settings and nomination also replay through the engine
validator. A second 260 km flow uses 20 women's teams, fatigue 30 and an
exposed route with chase defaults: all 160 riders reach the individual
bunch line, with 160 illustrative point entries. All nine v93 browser
fixtures pass together; lint and an isolated build pass. This broadens
playable UI evidence without resolving the 30 extreme energy refusals.

A separate 48-case, four-seed direct acceptance audit varies 40/120/260 km,
4/15/20 teams, both categories, all five route profiles, fatigue 0/15/30,
the four rival defaults, and player effort/attack/chase orders. Forty-seven
full roads finish: 33 bunch-only, eight single-front-group, three separated,
two coasted-with-front and one coasted-without-front. One 260 km, 15-team
custom-route case refuses at a newly exhausted rider, matching the known
unpaid-drop boundary. With point context, 46 successful cases produce
policy-consistent read-only projections; the remaining 20-team no-front
road has six isolated riders and potential overlap, so points are explicitly
unavailable. One representative from each of the five successful road
versions replays exactly. A fixed unit test now preserves the 20-team
six-isolated-rider point-withholding behavior; all five focused coasted
no-front tests and lint pass. This audit did not run through the browser;
the nine browser acceptance flows above cover the UI separately.

An opt-in, separately versioned no-front finale now records a rider who
exhausts at the final-kilometre boundary as a new isolated rider. The rider
leaves the bunch before that slice, pays independent coasted travel on the
same clock as the bunch, and reaches an individual line with recorded zero
reserve. The inferred bunch wheel is removed from the 500 m sprint handoff;
the earlier source recording and its version remain unchanged. Potential
contact with a newly isolated rider before 500 m is not yet resolved, so
this branch exposes conditional crossings but withholds even illustrative
points and all awards.

Repeating the 108-case four-team, fatigue-30 multi-manager matrix with
three effort, attack and chase choices across both categories and flat and
mountain routes now completes 96 cases: 52 policy-consistent read-only
point illustrations and 44 explicit point-unavailable outcomes. The 18
newly completed cases are all flat roads with recorded boundary drops; the
12 remaining refusals have a zero-reserve rider in a still-separated front
group. Four fixed flat/exposed, male/female replay checks cover the new
32-rider line. Fourteen focused and adjacent unit tests, lint, isolated
build and all ten local v93 browser flows pass, including the new women's
260 km multi-manager boundary-drop fixture. The separate 15-team custom
route seed-diversity refusal remains because its new drop is on a front
road shape. These checks do not establish a complete playable motor or
an official point result; the earlier full unit-suite attempt did not
complete.

A further opt-in front-drop version carries the remaining four-team
multi-manager refusals to a conditional individual line. In these 260 km
cases, two zero-reserve riders leave a four-rider front group at the
259 km boundary. The two remaining riders retain the recorded group ID;
each leaver coasts independently from the group's measured gap. The clock
records the peloton passing the isolated riders about 32 m into the first
mountain interval or 59 m into the first flat interval. It does not grant
them the bunch's shelter or silently place them back in the group. Because
the contact response and wheel order remain unresolved, illustrative and
official points are withheld for this version, while all 32 riders still
receive conditional energy-backed crossings and a replayable line. A
nominated zero-reserve rival can finish alone while an optional player
lead-out pays work in the surviving front group.

The same 108-case four-team multi-manager matrix now completes without
errors: 78 existing no-front, 18 dynamic no-front and 12 dynamic front
finishes. Fifty-two cases produce policy-consistent read-only point
illustrations and 56 explicitly withhold them; the 12 front cases record
24 solo/bunch passage events. Male and female flat/mountain replay checks,
the prior coasted/no-front/bunch checks (16 focused tests), lint, an
isolated build, and all eleven local browser flows pass. The 15-team
custom-route seed-diversity case still refuses when a rider newly leaves
the bunch while two front groups remain; that road shape and the contact
response remain open. No official results or awards are committed, and
the full unit suite has not completed.

The 15-team custom-route seed-diversity refusal now has its own opt-in
active-road drop version. In the 260 km chase-default road at fatigue 15,
two singleton front groups remain ahead while 12 riders are already
isolated. Six bunch riders exhaust at 259 km and four more at 259.25 km;
the final road has two front singletons, 96 bunch riders and 22 separately
coasted riders. All 120 riders have conditional individual crossings in
25 replay bands, with the first and final half-kilometre positions and
energy accounted for. The old coasted clock still refuses this shape,
preserving its recorded version. This version explicitly withholds point
illustration and awards because contact with the ten new isolated riders
before 500 m has not been resolved. Male/female custom and mountain
variants replay exactly; the custom case also passes through the local
browser with a 120-row result table. Nineteen focused and adjacent unit
tests, lint, an isolated build, and all twelve v93 browser flows pass.
This does not resolve every road shape: the same seed on a flat route has
two singleton fronts but no new bunch drops, and the older coasted line
still refuses that singleton handoff. The full unit suite has not
completed, and no official result or award has been committed.

The remaining flat variant of that seed now uses a separate singleton
coasted-line version. At the locked 259 km source it has two one-rider
front groups, 14 already isolated riders, and no new bunch drops. Each
front singleton receives its own paid 500 m sprint runner instead of an
unsupported multi-rider wheel position. The 15-team male and female
roads finish with 17 replay bands and 120 conditional crossings; both
replay exactly. A player may nominate one front singleton, or nominate a
bunch rider with an optional bunch lead-out that pays work. The isolated
riders have potential longitudinal overlap, so this branch explicitly
withholds the illustrative point table and all official awards. The new
flat browser fixture displays the nominated singleton in a 120-rider
conditional result. Twenty-one focused and adjacent tests, lint, an
isolated build and all thirteen local v93 browser flows pass. The old
versioned coasted roads retain their previous runner and replay output;
the broader full suite remains unverified.

The reproducible `scripts/engine-v2-v93-diversity-audit.mjs` rotates 48
synthetic combinations across 40/120/260 km, 4/15/20 teams, both
categories, five route profiles, three fatigue levels, four seeds and
different manager defaults and orders. It checks unique individual
crossings, read-only point values against the policy, award withholding,
and one exact replay per observed version. With the active-road and
singleton increments, 47 roads finish with 4,616 conditional crossings:
44 have policy-consistent point illustrations and three explicitly
withhold them. One 260 km, 20-team men's rolling road at fatigue 15
still refuses. Its locked source has one 40-rider front group and a full
bunch, with two zero-reserve player riders in that front group; the
single-group clock cannot pay their first 259 km finale slice. This is a
specific remaining source-road boundary, not evidence of a complete
motor. The audit is direct engine coverage; the thirteen local browser
flows remain the UI evidence.

The last refusal in that audit now has a separately versioned single-front
coast path. Its 40-rider source front group has two player riders at zero
reserve. They leave before the 259 km slice, pay independent coasted
travel, and remain ahead of the bunch at the recorded line while the
other 38 retain the group identity. The trace and final 500 m replay carry
all 160 riders to conditional individual crossings. With the relative
order and possible contact between surviving front riders and the two
leavers unresolved, the clock assigns one broad unresolved placing band;
the individual times remain visible, but no provisional placing, point
illustration or award is invented. Both categories across all five route
profiles replay this paid shape; nominated isolated finishers and an
optional bunch lead-out were checked on the same locked road. The 20-team
rolling case also passes the browser UI with 160 result rows.

Repeating the reproducible 48-case diversity audit now finishes all 48
roads and 4,776 conditional crossings. Forty-four cases retain
policy-consistent read-only point illustrations and four explicitly
withhold them; one representative of each of the seven observed preview
versions replays exactly. Twenty-three focused and adjacent unit tests,
lint, isolated build and all fourteen local v93 browser flows pass. This
still does not supply a classified result or a resolved contact order for
every finale, and the full unit suite has not completed.

The same 48-case audit now checks every displayed conditional crossing
against its own final road-band replay: rider identity and road band,
recorded line position, timestamp and energy must agree. All 4,776
crossings match. For the 44 scenarios with illustrative points, the
audited placing and line energy must also match the provisional order
used by the one-day point policy. This checks the full result/replay
surface without treating conditional times as official classifications.

The local v93 result table now opens the selected rider's paid finale
replay directly. It starts on the rider's road band and shows that rider's
position and energy after each recorded interval; at the line it also
shows the same time and energy as the individual conditional result. A
20-team rolling front-drop fixture checks the nominated isolated rider
and then switches to a bunch rider through the result table. All fourteen
v93 browser flows, lint and an isolated production build pass. This is a
replay inspection path, not an official result or award action.

For the single-front road with two newly coasted leavers, a read-only
projection now narrows the conditional road ranges without changing the
versioned race recording. Every paid passage after the split must keep the
38-rider front ahead of both leavers and both leavers ahead of the
120-rider bunch; the individual crossings must preserve those three band
separations. The result table then shows ranges 1–38, 39–40 and 41–160.
Order within each band and contact at the split remain unresolved, so
the provisional individual order stays null and point illustration and
official awards remain unavailable. Both categories on all five route
profiles replay the projection, and a tampered crossing is rejected.

The preview road panel now labels signed isolated-rider gaps relative to
the bunch as “ahead of bunch” or “behind bunch”. A rider who has left the
front but remains in front is therefore no longer displayed with a
misleading `+-` deficit. The 160-rider rolling browser fixture checks the
ahead case against its recorded paid passage.

The 48-road diversity audit now rotates all six calendar point tiers and
one-, two- and four-division contexts, including reduced division
multipliers. All 44 available point illustrations still equal the
existing one-day policy for each provisional placing; the other four
remain explicitly unavailable. The audit retains its 4,776
replay-matched crossings and seven exactly replayed preview versions.

The v93 playable page now puts the player's nominated finisher, recorded
road band, conditional crossing time and line energy in a compact finish
panel, with the helper's actually paid work and the available placing or
read-only point illustration. The two-manager 4-team browser fixture
shows withheld points while its helpers work, then a policy-consistent
illustration when the helpers are removed. The 20-team front-drop
fixture shows a 39–40 conditional range and withheld points for the
nominated isolated rider. Both checks run against an isolated local build.

The local v93 preview can also be opened manually with `pnpm
playtest:v93:local` from `calendar-release`. This builds the ignored
`.next-v93-local` directory and serves the existing protocol fixture on
127.0.0.1; its Supabase endpoint and keys are fixed to fixture values. Open
`http://localhost:3100/login`, sign in as `settings` or `bob` with
`fixture-password`, then visit `/team/v91-playtest`. Select the v93
road-to-line preview, choose a route, terrain and distance, edit tactics
for the available managers or use defaults, nominate a finisher and
optionally a lead-out, and run the race. The fixture resets when the
command stops. This is a read-only conditional preview: a road shape with
unresolved contact can show a placing range and no point illustration.
The new command completed the isolated build and served a 200 login page;
all fourteen v93 browser scenarios passed against its build and the
localhost-only fixture server. Lint and the launcher syntax check passed.

The 48-road diversity audit now identifies its four withheld illustrations
by index, preview version, reason and recorded road-band sizes. Cases 14 and
44 form 15- and 20-team fields with new bunch dropouts before 500 m; case
20 has possible contact between already separated bands; case 26 has two
front leavers with only a defensible 39–40 placing range. The clock's broad
bands for the new bunch dropouts cannot be promoted to individual places:
their contact with the active bunch before 500 m has not been resolved. The
audit still finishes all 48 roads and matches all 4,776 crossings to replay.

For one representative of each of the seven observed v93 preview versions,
the diversity audit now also changes the nominated finisher for every
manager, leaves lead-outs off, and runs the whole road-to-line preview again.
All seven variants retain their exact locked recording and kilometre clock,
but change conditional crossings (6–158 riders, depending on the road).
Every variant's line time and energy still match its final replay frame.
Where the road admits a unique provisional order, the recalculated
read-only points match the existing one-day policy; the three ambiguous
representatives continue to withhold an illustration. The separate local
browser flow still verifies optional paid lead-out work for two managers.

The v93 page now reads an unambiguous provisional result's `position` when
showing the nominated finisher and each conditional-result row. Previously
it read only the fields used by bounded unresolved finishes, so a valid
placing could appear as `undefined–undefined` beside a correct point
illustration. The browser flow asserts the displayed position against the
API's actual provisional order after removing two lead-outs; all fourteen
v93 local browser flows, lint and the isolated build pass. Placing ranges
for unresolved roads retain their separate display path, and official
results and awards remain withheld.

The result table now joins provisional places to conditional crossings by
`riderId`, not by their array index. Where a unique provisional order exists,
rows follow that order; otherwise they remain sorted by conditional time.
The browser check compares every displayed rider and place with the API's
provisional order after changing two managers' lead-outs. The isolated
build, lint and all fourteen local v93 browser flows pass.

Two of the 48 audit roads have one paid two-rider front and newly isolated
bunch riders whose contact with the bunch before 500 m remains unresolved.
The v93 summary now checks both paid first-half-kilometre passages, every
later front-to-rear band passage and the individual line crossings before
showing a conditional 1–2 range for that front. All other riders retain a
single unresolved 3–120 or 3–160 range; no individual rear order or point
illustration is inferred. The projection does not change the versioned race
recording, and a tampered crossing is rejected. The 15-team women and 20-team
men fixtures replay the bounds; the 48-case audit still has 4,776 matched
crossings, 44 point illustrations and four unavailable ones. Focused tests,
lint, an isolated build and all fifteen local v93 browser flows pass.

The remaining 4-team flat audit case now identifies the first potential
contact that blocks an illustrative point order: two isolated riders' paid
paths can meet at 259.020 km, during the first 500 m of the finale. The
v93 result page reports the time, distance and rider IDs from the existing
contact audit, with links to each rider's paid replay. This is a possible
longitudinal overlap on inferred source wheels, not a resolved meeting or
passing rule. The provisional order remains null and points and awards stay
withheld. The focused replay test, lint, isolated build and all sixteen
local v93 browser flows pass.

The contact witness is now shown even when the optional read-only point
illustration is off. Contact is a property of the paid road replay, so the
same two rider IDs and crossing remain available in the default result
view. The with-points and without-points unit cases replay identically;
the local browser check uses the default unchecked point option.

A v91 no-front depleted-reserve clock could validate successfully and then
fail while building its positioned 500 m source: the individual-line path
passed the v93 coast-only no-front flag instead of the already validated
no-front condition. The source now receives that same condition. The 260 km
mountain, four-team chase fixture again shows 31 bunch riders and one
independent dropped rider, with 32 conditional crossing times and a paid
solo replay. Seven previously failing integrated scenario assertions pass;
all 101 focused v91/v93 unit checks, the existing end-to-end browser case,
full lint and an isolated local build pass. This changes source selection
only for a valid no-front clock and leaves existing recording versions and
withheld-point policy intact.

The fresh 48-road v93 audit also finished all scenarios and matched all
4,776 conditional crossings to replay; 44 read-only point illustrations
remained available and four appropriately unavailable. A separate broad
unit-suite attempt was stopped at 129 completed passing checks with no
reported failure because long-running finale audits kept it open; it is
not counted as a full-suite pass.

The v93 preview now compares consecutive runs on the same route, category,
field, fatigue and seed. It reads both saved responses to show the recorded
road at the last-kilometre handoff, nominated finisher's paid crossing and
energy, helper work, conditional place and, when the same point context was
requested, read-only point illustrations. Different route conditions, a
failed run or a switch back to v91 clear this comparison. The browser case
changes two managers' lead-outs on one 260 km road and checks the displayed
time and point change against both API responses; a separate fixture user
checks that a 40-to-120 km switch cannot retain an unrelated comparison.
All 17 local v93 browser cases and two existing v91 comparison cases pass,
as do lint and the isolated local build. The motor recording, result contract
and official withheld-award policy are unchanged.

A v93 nominated lead-out who is already in another road group or has too
little energy at the paid 500 m boundary still fails closed. The preview API
now reports the recorded reason and asks for a different helper or none,
instead of showing only a generic assembly error. The four-team, tired
mountain browser flow nominates an isolated rival as helper, checks the 422
reason and absence of a saved preview, then removes that helper and replays
the same race with 32 individual times, a 31-rider peloton and the rider's
separate paid solo band. All 18 v93 local browser scenarios, lint and the
isolated build pass. No recording, point policy or production path changes.

A paired 260 km flat, four-team, tired-field browser scenario now holds the
route, seed, riders and all tactics constant except rival 1's chase order
(`ignore` to `all`). The recorded front-group IDs change; the nominated
`you-7` moves from `road-2` to the peloton and from conditional place 3 to
9. Both API responses retain 32 individual line times, the page shows the
paired place change, and the final rider replay matches the second paid
crossing time and energy. The read-only point illustration creates no award
rows; official points remain withheld. This is a tactical end-to-end check
of a road change reaching the result and replay, not a new tuning rule.
