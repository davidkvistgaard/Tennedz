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
