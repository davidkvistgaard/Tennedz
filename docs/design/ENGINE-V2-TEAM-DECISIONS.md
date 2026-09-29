# Race engine v2 — team intent and rider autonomy

Status: design contract for the isolated engine, **not implemented race behavior**. Managers submit orders before the deadline. The race then runs once from those committed orders and a fixed seed, and viewers read the saved result. None of these decisions require live manager input.

## Team intent across groups

Each team evaluates its riders' realistic winning chances in each group, rather than treating the peloton as one cooperative actor. A rider up the road normally removes that team's incentive to chase from a group behind. A teammate joining a chase group may follow the wheels, conserve energy and deny that group an extra contributor while still protecting the forward rider. This must be an actual participation state: the rider gets group shelter but contributes no pulling power. The behavior can change when the forward rider's chance collapses or another team objective clearly becomes more valuable; an absolute “never chase a teammate” rule would create implausible outcomes.

The team must not control opponents. Every group has a separate count of willing workers, their rotating exposure, their energy and their pace. Other teams may chase, cooperate briefly, refuse a turn or wait for someone else to take responsibility. Sitting on cannot generate free acceleration for the sheltered rider, and an isolated rider cannot gain the drafting benefit of a group.

## Captain, helpers and free riders

The manager names a captain, optional backup and helper priorities before the deadline. A helper protects or paces the captain when they can physically ride together and the expected team benefit exceeds the helper's own chance. If the captain is distanced, a helper in front may wait or drop back only when the groups are close enough to reconnect and the delay is worth the support; no rider may teleport between groups. A helper that drops back spends time and energy and can lose its own opportunity.

A rider may pursue their own result when the committed plan gives them freedom, when the captain's objective becomes unattainable, or when a specific precommitted contingency releases them. Conversely, a rider with a promising personal chance can still sacrifice it for a viable captain under an explicit team-first plan. The road captain's leadership affects how quickly the team recognises these changes and coordinates the response; it does not directly increase physical speed.

## Conditional orders without live intervention

Simple plans should set sensible defaults; expert managers can set priorities and contingencies such as “protect captain while within reach”, “sit on a chase when we have a rider ahead”, “release the backup if the captain is out of contention”, or “wait for the captain if reunion is feasible”. The engine evaluates these conditions using information available to the riders at that kilometre, not knowledge of the eventual winner. Every switch, failed trigger and group transfer belongs in the recorded replay.

## Required scenario checks

1. With a viable teammate ahead, a team behind does not provide chase power; its rider in a pursuing group can shelter without taking pulls. A rival team can still catch the front group.
2. If the forward teammate fades badly while the protected captain remains viable, the team may change its priority under a precommitted rule. The decision and energy costs are visible.
3. A helper in the same group gives measurable protection to a captain. A helper in a different group cannot do so until a physically possible reunion has completed.
4. A released rider can race for themselves; a team-first rider sacrifices a personal opportunity only when the selected priority calls for it. Neither decision is forced for all teams.
5. Reordering input teams or replaying the same seed does not change decisions. Changing one team's plan can alter its own work and the race, but cannot rewrite the opponents' submitted plans.

## Implementation dependency

The present v2 prototype has only a partial approximation: a team with a rider in the one tracked break does not chase that break, and available helpers can shelter a leader in the peloton. It has no sustained second break or chase group, no explicit sit-on participation, no physical drop-back/reunion, and no rider-level freedom policy. Build independent groups and positions first, then implement these team policies against that group state. Central balance constants and paired scenario tests must precede any production migration.
