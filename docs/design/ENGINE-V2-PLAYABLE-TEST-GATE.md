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
Each accepted branch keeps its original source recording and riders,
and every crossing remains conditional: no inferred wheel order becomes an
official result or point award. Other valid attack combinations and existing
separated road groups remain outside this narrow entry.
