# Race engine v2 — team intent and rider autonomy

Status: design contract for the isolated engine, **partly implemented**. Managers submit orders before the deadline. The race then runs once from those committed orders and a fixed seed, and viewers read the saved result. None of these decisions require live manager input. The implemented subset includes separate road groups, a basic teammate-ahead sit-on rule, bounded captain-helper drop-back, and an in-memory replay. Conditional team priorities, individual freedom, cumulative classification and production persistence remain future work.

## Team intent across groups

Each team evaluates its riders' realistic winning chances in each group, rather than treating the peloton as one cooperative actor. A rider up the road normally removes that team's incentive to chase from a group behind. A teammate joining a chase group may follow the wheels, conserve energy and deny that group an extra contributor while still protecting the forward rider. This must be an actual participation state: the rider gets group shelter but contributes no pulling power. The behavior can change when the forward rider's chance collapses or another team objective clearly becomes more valuable; an absolute “never chase a teammate” rule would create implausible outcomes.

The team must not control opponents. Every group has a separate count of willing workers, their rotating exposure, their energy and their pace. Other teams may chase, cooperate briefly, refuse a turn or wait for someone else to take responsibility. Sitting on cannot generate free acceleration for the sheltered rider, and an isolated rider cannot gain the drafting benefit of a group.

## Captain, helpers and free riders

The manager names a captain, optional backup and helper priorities before the deadline. A helper protects or paces the captain when they can physically ride together and the expected team benefit exceeds the helper's own chance. If the captain is distanced, a helper in front may wait or drop back only when the groups are close enough to reconnect and the delay is worth the support; no rider may teleport between groups. A helper that drops back spends time and energy and can lose its own opportunity.

A rider may pursue their own result when the committed plan gives them freedom, when the captain's objective becomes unattainable, or when a specific precommitted contingency releases them. Conversely, a rider with a promising personal chance can still sacrifice it for a viable captain under an explicit team-first plan. The road captain's leadership affects how quickly the team recognises these changes and coordinates the response; it does not directly increase physical speed.

## Conditional orders without live intervention

Simple plans should set sensible defaults; expert managers can set priorities and contingencies such as “protect captain while within reach”, “sit on a chase when we have a rider ahead”, “release the backup if the captain is out of contention”, or “wait for the captain if reunion is feasible”. The engine evaluates these conditions using information available to the riders at that kilometre, not knowledge of the eventual winner. Every switch, failed trigger and group transfer belongs in the recorded replay.

## One-day races versus stage races

A one-day race ends with that day's result. A stage race has at least two distinct objectives on every stage: the stage result and the cumulative general classification (GC). A manager may value an overall top-ten finish even when winning the GC or the current stage is unrealistic. The engine must therefore evaluate threats to a defended place and opportunities to improve a place, not only whether a rider can win today.

The race context needs the committed classification standings and time gaps **before** the stage, the stage's scoring and timing rules, and each team's precommitted priorities. During simulation, teams estimate the *provisional* overall standing from current road gaps. That estimate can change as groups split or rejoin; it is not final knowledge. A GC team may let a harmless stage break go, while chasing a rival whose gain would cost its captain tenth place. A team in eleventh may spend more energy to move into the top ten; a team defending seventh may reject that risk. A sprinter team can have the opposite incentive on the same road.

Stages also carry forward fatigue and other defined rider state. Saving a helper or captain for later stages may be worth more than an extra place today. Event-specific time bonuses, classifications and finish-time rules must be explicit inputs to the event and versioned; they must not be guessed by the engine. Men and women retain separate events and standings.

## Required scenario checks

1. With a viable teammate ahead, a team behind does not provide chase power; its rider in a pursuing group can shelter without taking pulls. A rival team can still catch the front group.
2. If the forward teammate fades badly while the protected captain remains viable, the team may change its priority under a precommitted rule. The decision and energy costs are visible.
3. A helper in the same group gives measurable protection to a captain. A helper in a different group cannot do so until a physically possible reunion has completed.
4. A released rider can race for themselves; a team-first rider sacrifices a personal opportunity only when the selected priority calls for it. Neither decision is forced for all teams.
5. Reordering input teams or replaying the same seed does not change decisions. Changing one team's plan can alter its own work and the race, but cannot rewrite the opponents' submitted plans.
6. In a one-day race, a team has no phantom future-GC objective. In a stage race, a team defending tenth responds to a direct GC threat but need not chase a stage break that cannot change its standing.
7. Teams in tenth and eleventh can choose different energy/risk tradeoffs on the same stage. A stage-win team and a GC team may pursue opposite tactics without either being forced to work for the other.
8. A stage's result updates cumulative standings exactly once. The next stage starts from those saved standings and carried rider state, while replay of an earlier stage remains unchanged after later stages are simulated.

## Implementation dependency

The present v2 prototype supports up to 40 independent road groups (the current two-riders-per-team ceiling across 20 teams), records actual pulling versus sitting on, and bounds a captain helper's immediate reunion by road gap. The optional `chase_if_fading` order lets a team chase when its own rider in the rearmost break has low energy and is close to being caught; its default protects the forward rider. This threshold rule does not yet evaluate each rider's full winning chance. The recorded sit-on rule remains unconditional. The drop-back is a simplified same-kilometre transition rather than per-rider travel. There is no rider-level freedom policy, between-group finish catch, or multi-stage GC context. Develop conditional team objectives and rider timing before persistent stage-race state. Central balance constants and paired scenario tests must precede any production migration.
