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

The mountain benchmark with a committed summit goal exposed an
unrecorded contact. Its first kilometre physically drops riders from
the bunch. Two separately paid solo roads have the same measured clock
at that boundary; the probe now stops at km 2 instead of letting them
continue as separate roads without contact resolution. The crossing
guard checks every pair of existing roads, including two solo roads,
and reports their start and end clock difference. This exposed the
need for a paid boundary contact and rear-group leader choice.

`physical-first-rear-boundary-contact-1` now resolves exact
co-timed solo finishes only when each rider's preceding solo road has
a paid decision, full-distance finish, matching clock and settled
reserve. It records the common distance and time, origin roads, paid
approaches, member IDs and one leader plan for the next kilometre.
The leader must be permitted by `breakWork`, able to pay, and slow
enough that the other members can hold lower-cost shelter through the
kilometre. `sit_on` never volunteers a leader. A `drive` order
adds its existing ability bonus and extra reserve cost, and cannot
be silently replaced by a slower worker when its pace would break
the group. No group arises from matching
source labels or a scripted gap.

With a committed summit goal and no attack orders, the 120 km,
20-team mountain probe now settles 19,200 rider-kilometre decisions
and five paid rear contacts. It reaches the finish with 160 rider
records. Its relative finish audit still differs from the historical
source for 66 riders, maximum 419.07 seconds. The old source keeps
these riders in the bunch; the physical run records early paid drops
and rear contact. This is a measured limitation, not a reason to
import source gaps. Contact with an existing rear group or the
peloton, attacks, active chases, within-kilometre splits and
a separate replay were the next gates.

`physical-first-whole-race-replay-1` now independently walks the
experimental recording. From the committed route, teams, stakes,
start reserve and seed, it recomputes the ordered bunch leader,
every paid road and start drop, each rear contact and leader, and
each rider's boundary clock and energy. It refuses altered contact
approaches, road payments and finish states. The flat control
validates 1,280 rider-kilometres and the mountain control validates
19,200. This is replay of the constrained physical-first scenarios;
the historical V94 source still disagrees on 66 mountain finish
gaps, and unresolved tactical features remain outside this replay.

`physical-first-attack-choice-1` begins the missing attack path at a
measured bunch boundary. It reads the actual team order, sporting goal,
named attacker or committed specialist, helper policy, current rider
contact and reserve, then records either a candidate attempt or a
specific hold decision. It selects only a rider who can cover the
existing attack initiation cost and minimum reserve. A named manager
attacker overrides the general helper guard; generated attempts need
an attack-oriented sporting goal. The choice does not move a rider,
charge a full kilometre or award any gap. At this stage the whole-race
probe still refused attack orders. The flat and mountain controls
remained the calibrated scenarios; neither validated attack finishes.

`physical-first-attack-road-1` now prices a selected attacker's first
solo kilometre from the measured bunch boundary. It verifies the
choice against current committed orders, pays the terrain-priced solo
road work plus the existing attack initiation cost from that rider's
reserve, uses the attack phase for perceived speed, and records a
zero-gap launch, full-distance finish, energy debit and cap. This is
an isolated paid event contract; simultaneous bunch movement and
resulting catches were not yet integrated at this stage.

The version 5 whole-race probe and version 2 replay now validate
every new solo road created by a start drop against its measured
departure from the source road. A launch must remove exactly that
rider, start at the source distance and clock, and finish a paid full
kilometre. It may diverge from its shared source, but cannot pass or
tie a different existing road without recorded contact. Co-timed
departures from the same source remain eligible for the existing paid
rear boundary contact at the next kilometre. Both same-seed control
races still complete with their previous relative finish audits.

The version 6 whole-race probe and version 3 replay now apply every
team's boundary attack choice each kilometre. Attempting riders leave
the measured bunch at zero gap, pay a full attack kilometre on their
own road, and are removed from the simultaneously paid bunch. The
version 2 rear boundary contact accepts a paid attack solo receipt
when exactly co-timed solo riders can form a payable rear road.
Independent replay recomputes the choice, attack road, reserve debit,
launch and finish. The one-kilometre attack fixture replays exactly;
both no-attack whole-race controls retain their earlier audits.

On a same-seed 40 km, four-team flat race with one committed break
team, the experimental runner now reaches km 6. It stops at km 7
because two paid solo roads would cross during that kilometre without
a recorded contact event. The historical source recorded one attack,
but its gap is not adopted. This is the next concrete contact case;
attack finishes and whole-race calibration remain unvalidated.

The crossing guard now derives the meeting's distance and clock from
the two measured start clocks and paid full-kilometre speeds. It
reports that projection with the refusal instead of inventing a
checkpoint gap. In the fixed attack race the two solo roads meet at
6,098.75 m. The projection locates where a resolver must split
and reprice the riders' work; it does not itself merge roads, grant
shelter or settle a finish.

`physical-first-solo-contact-1` now resolves an isolated meeting of
two paid solo roads inside one kilometre. It verifies each full solo
receipt against the committed rider, route and order, locates their
meeting from measured clocks, then reprices the distance to contact
and the remaining distance. The riders share one payable exposed
leader and one lower-cost sheltered rider after contact; `sit_on`
does not volunteer a leader, and a `drive` order carries its extra
speed and reserve cost. The result records one road, two complete
energy debits and a common finish clock. This contract is not yet
connected to the whole-race crossing guard or replay at that stage,
so the fixed attack race stopped at its measured km 7 contact.

The version 7 whole-race probe and version 4 replay now settle one
crossing pair of previously paid solo roads within a kilometre. The
settlement recomputes both solo approaches from committed input,
replaces their provisional full-solo finishes with the repriced
shared finish, and checks that the new road does not cross any third
road before or after contact. The fixed attack race now pays and
replays all 32 riders through km 8 (256 rider-kilometres), including
the contact at 6,098.75 m. At km 9 the field reaches a separate solo
rider at 8,097.744361 m. The field-to-solo catch had no paid resolver
at that stage, so the full 40 km attack calibration stopped there.

`physical-first-bunch-catch-1` now handles a faster paid bunch reaching
one slower paid solo rider within a kilometre. The solo rider pays the
approach to the measured contact. If that rider can hold the bunch's
single paid leader through the remaining distance, the rider pays
lower-cost shelter and joins the bunch at its finish clock. Otherwise
the rider keeps the fully paid solo road and slides through the bunch;
the pass is still a recorded contact. The version 2 contact settlement
checks other roads for unrecorded crossings, and version 8 probe and
version 5 replay include the catch receipt and final energy.

The fixed 40 km, four-team same-seed attack race now reaches the
finish with 32 rider records and 1,280 independently replayed
rider-kilometres. The km 9 caught rider joins paid bunch shelter. The
historical V94 relative finish audit differs for 8 of 32 riders,
maximum 116.327831 seconds; source finish claims were only comparison
data. This is a complete constrained attack race, not whole-race
calibration across mountain, chase, multi-contact and stage scenarios.

`physical-first-attack-choice-4` now records a hold on kilometres
outside the existing ordered repeated/selective attack windows;
an explicitly named attacker or a committed phase start can still
launch immediately. It counts only teammates physically ahead of the
bunch for the existing two-rider break limit. If one teammate is
already forward, an unnamed attacker compares the measured gap and
both riders' perceived sustainable solo speeds against the remaining
committed route. The helper holds when the estimated bridge would
leave less than the existing reciprocal pull interval for shared
work. This estimate affects the rider's choice only; actual contact
still requires measured, paid roads. The version 9 probe and version
6 replay record and recompute the choice.

On the fixed same-seed 40 km break scenario, the generated team now
pays one attack at km 5 and holds a second that would provide too
little shared road. All 1,280 rider-kilometres still finish and replay.
The historical relative finish mismatch falls from 8 of 32 riders
(maximum 116.327831 seconds) to 1 of 32 (60.4232 seconds). The
remaining rider's old source lead is comparison evidence, not a
physical gap or an official result.

The same-seed 120 km, 20-team selective-attack mountain scenario now
also reaches a paid finish. Its one historical attack is paid once;
all 160 riders finish and all 19,200 rider-kilometres replay from the
committed inputs. The relative finish audit disagrees with the old
source for 67 of 160 riders, maximum 419.07 seconds. The matching
no-attack mountain control disagrees for 66 of 160 riders. A complete
replay therefore establishes physical accounting, not mountain
calibration. The large discrepancy begins on km 1, a hill rather
than a climb: the only ordered front worker has perceived ability
89.57 and 66 of 160 riders cannot hold that paid pace even with the
existing hill shelter benefit. They leave at the measured start
boundary; five sets of those riders make paid rear contact at km 2.
The old source keeps these riders with the bunch. Changing their
pace or shelter solely to match that source would invent a road
outcome. The mismatch needs a source and sporting review before
guided-race use.

## Source-independent recording boundary, 9 November

`physical-first-race-record-1` is the experimental motor entry point for
the paid whole-race recorder and its independent replay. It accepts the
committed route, riders, orders, stakes, start reserve and seed. It refuses
a replay mismatch, incomplete rider-kilometre coverage, missing rider,
unpaid final distance or invalid final clock and reserve. It returns every
measured finish crossing sorted by paid clock, with equal clocks left tied.
It assigns no place, points, award or official result. No V94 checkpoint
group or gap is an input. A supplied recording must replay against the same
committed inputs; changed abilities and altered finish clocks are refused.
This boundary is ready for the viewer exporter to consume, but still needs
official result policy, full-race attack calibration and game-cycle
integration before replacing the historic source.
