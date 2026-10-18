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
   The complete-bunch trial now checks submitted finisher and helper IDs
   against the prepared fictional roster before running the kilometre tour;
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
the others use `defaultRivalPlan`. `finalePlans` can override any named
manager's finisher and optional helper while unspecified managers keep their
captain and no helper. `--full` includes the complete source and finale
recording for inspection. Output identifies road groups, chasers, energy,
paid lead-out work and conditional line times, or names an unsupported road
state with its recorded group and dropped-rider counts where the unmodified
kilometre source is available. A fixed 54-case diagnostic across three routes,
both categories, three field sizes and three tactics modes replayed 32
conditional individual lines, 12 paid group-band lines and 10 explicit
refusals, all on the tired mountain source with multiple groups or dropped
riders. This is coverage evidence, not a sporting success rate. The tool
withholds classification and point awards and has no account,
database or production path. This is an engine diagnostic, not the requested
browser test environment or a completed playable race.

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
general finale. The next motor integration must carry multiple last-kilometre
groups, dropped riders and valid manager actions on one clock through contact
and the finish; only then can a general result and point projection be
assessed against this gate.

The repeatable read-only audit
`node scripts/engine-v2-conditional-coverage-audit.mjs` fixes one fictional
seed across 36 combinations: 40 km flat with no starting fatigue, 120 km
rolling with 15, and 260 km mountain with 30; both categories; 4, 15 and 20
teams; mixed and attack-oriented default tactics. It independently replays
each accepted conditional finish against the same locked kilometre race.
Sixteen of 18 mixed sources reach a paid conditional individual line; the
two 4-team mountain sources have a road group and six dropped riders, so
refuse. Twelve of 18 attack-oriented sources now reach a paid group-band line
through the shared conditional entry. The remaining six have two road groups
and refuse. Each accepted recording replays against the locked kilometre
source, retains the complete field and withholds awards. None of these counts
is a target win rate. A time gap is never converted into an individual wheel
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
occurs. That status needs a versioned correction before it can be presented
as a manager-facing promise. The six actual pulls save 0.08–0.11 seconds for
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
