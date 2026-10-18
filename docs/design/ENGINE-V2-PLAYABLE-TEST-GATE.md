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
