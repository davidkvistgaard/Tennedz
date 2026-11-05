# Physical-first race kernel migration

## Why the V94 replay is not the next source recorder

The opt-in V94 replay now completes every rider kilometre in ten
whole-race cases. Its decisions expose the committed effort, sporting
goal and perceived ability, and its clocks, contact and energy are
replayable. The source recording still creates a new break gap from
abstract attack pressure before the physical roads move. In the
120 km mountain seed-1 case, source road-1 is 27.76 seconds ahead at
km 5, while the best individually paid rider lead is 0.31332 seconds.
The source also treats riders as a group before paid contact. The
physical replay must keep that group label separate from its roads.

Changing a conversion constant or copying the source gap into a road
would not establish paid movement. The V94 physical replay also uses
source frames to choose fresh attacks, front turns and rest, so its
completed trace cannot simply replace those frames as the next
kilometre's independent input. Historic recordings remain replayable
and are never rewritten.

## One state that advances the race

The successor kernel must own one immutable boundary state per
kilometre. Each rider has a measured distance, clock, reserve, team,
physical road ID and active decision. A road has a leader, a start
clock and distance, paid turns, and members who can hold its speed.
Solo roads remain separate even when two riders share a checkpoint
clock. A rear group is created only by a contact event with time,
distance, leader, shelter eligibility and paid work for every member.

For each kilometre, the kernel should:

1. Read the route, weather, committed manager and emergency orders,
   sporting stakes and the prior physical boundary state.
2. Record each rider's perceived ability, energy, permitted role and
   versioned choice. Select one payable leader at a time; price less
   reserve for sheltered work.
3. Advance roads through measured turn and contact events. A rider
   who cannot hold the front continues on a priced solo road, including
   an early climb drop. A caught break rider receives a new decision
   and can slide through the bunch only after measured contact.
4. Settle every rider's distance, clock and energy at the boundary.
   The next kilometre reads this result, including physical road
   membership and observed gap. No source checkpoint gap supplies
   speed, membership, position or a group.

The source recorder and independent replay then consume the same
versioned event contract. The recorder emits the decisions and paid
work; the replay recomputes clocks, contact and reserve from the
committed inputs and event choices. Exact same-seed agreement at
every kilometre and finish is required before a guided-race switch.
The old V94 recordings remain comparison fixtures, with their
historical gaps and results reported as differences, not adopted as
physical facts.

## Migration order and release gate

First, define and validate the physical boundary state and a single
road-step contract without source-frame group labels. Then move the
start bunch, solo launch, chase turns, drops, catches and rear contact
to that contract. Only after full races replay should the successor
recorder become an experimental preview. Preserve old manager and
emergency order semantics and all refusal guards throughout.

The gate remains whole-race coverage and exact recorder/replay clocks,
energy, contact, road membership and finish for the same seed, with
focused refusal tests, lint, isolated build and authenticated browser
checks. No official places, awards, GC stakes, stage plans, time
limits, wheels or positions are inferred. Production promotion needs
the separate READY and rollback checks.

The first boundary-state projection now runs over the opt-in V94
physical trace. It groups riders solely by their paid road ID and
clock, carries each rider's boundary distance and reserve, and
derives leads from paid clocks. It rejects a shared rear road without
a matching paid group receipt and exactly one named paid leader.
Changing a historical source checkpoint
gap leaves this projection unchanged. This is a migration seam; the
current V94 choice scheduler still reads source frames and cannot yet
serve as the physical-first recorder.

`physical-first-road-step-1` is the first source-frame-independent
movement contract. Given an already connected road, an explicit
versioned leader plan, the committed teams and stakes, route segment
and prior rider clocks and reserve, it prices one kilometre with a
single exposed leader and cheaper sheltered work. Each rider records
the resolved order, perceived ability, goal, choice and energy
settlement. A rider who cannot hold shelter or pay the work causes a
named refusal. The step neither chooses the leader nor silently
creates a group or a drop. Those decisions need explicit event
contracts before the kernel can advance a whole race.

`physical-first-start-drop-1` now records a rider who cannot hold the
leader's speed at the kilometre boundary leaving the connected road.
It records the common distance and clock, the two perceived abilities
and the new solo road ID. The original road and each detached rider then
advance independently through the paid road step; an existing solo road
cannot be silently reused. This covers an early climb drop at the start
of a kilometre. A rider who loses shelter partway through the kilometre
still needs a measured within-kilometre split event, and the kernel does
not yet connect these steps into a whole-race recorder.

The first composed bunch kilometre selects a payable front worker from
committed `frontWork: rotate` orders. A named helper stays named and
requires the exact committed emergency replacement if absent; a named
helper who cannot pay is refused. An unnamed rotation chooses a present
helper using perceived ability and quoted work. Multiple working teams
alternate by kilometre in stable team order. A sitting-in team supplies
no invented worker. The selected plan and start-drop events are stored
with the paid road result. Break leaders, chase reactions and physical
contact still need their own planners and receipts.

`physical-first-whole-race-probe-1` now carries those paid roads,
individual reserves and team decisions into the next kilometre. It
refuses an unresolved attack order, an unpayable worker, an unsupported
rear group, an unrecorded crossing or a missing rider finish. A
committed four-team, 40 km control scenario with no attack orders
completes 1,280 rider-kilometre decisions. This is a constrained
diagnostic run, not a calibrated new race: tactical attacks, active
chases, within-kilometre drops and catches, full event replay, and
finish validation against the historical same-seed run remain open.

The control scenario now has an explicit same-seed finish audit. It
binds the probe to the recorded route, teams, sporting stakes, emergency
orders and initial reserve; source finish group claims are comparison
data only. With the original leader plan, on the fixed 40 km seed,
6 of 32 relative rider finish
clocks differ from the historical source claims, with a maximum
absolute difference of 147.354 seconds. This failed calibration is
reported rather than corrected by adopting historical gaps. The
result cannot be used for official places or a guided-race release.

The first leader plan chose the highest perceived solo ability for an
unnamed rotation. In the flat control it selected a worker whose km 1
pace six riders could not hold even with shelter. All six were recorded
as paid solo drops, while the old source kept them in the bunch. The
version 2 plan now uses the actual `sprint_finish` stake to choose the
quickest payable helper with the fewest predicted start drops; a
committed named helper still stays named, and an `all` chase still
selects the fastest worker. On the same flat 40 km seed, all 32 riders
remain physically connected and the relative finish mismatch count is
0. This improves that constrained scenario, but says nothing about
absolute elapsed time (the historical source records no absolute bunch
clock), attacks, mountain splits, chases or contacts.
