# Race engine v2 — first isolated foundation

Status: **development prototype, not wired to the public race cycle**. The existing `recovery-one-day-4-orders` engine, stored race outputs, database schema and live site remain unchanged. This work starts a separate, versioned engine on top of the latest recovery code so the working cycle can remain the comparison baseline while the replacement is built and balanced.

## Product contract

- Managers commit their lineup, captain, optional road captain, preset, detailed phases and contingencies **before the deadline**. The server snapshots that exact input. The complete race is calculated once after the deadline, and everyone views the same recorded replay. No live manager action is required.
- Men and women have separate races and rankings. They can share stat names and tuning architecture, but balance must be measured separately.
- A simple preset must remain playable; expert orders at 10 km markers or authored route keypoints add depth. Repeated attacks and constant pursuit have energy costs. Several attacking teams can overwhelm one chasing team.
- Leadership affects how a road captain recognises a tactical threat and coordinates a response. It does not directly multiply the captain's physical speed. Future contingency rules may let a road captain switch to a preselected backup leader; a manager does not improvise after the deadline.
- Every kilometre carries elevation, gradient, terrain, surface and related weather. Explicit surface segments are required; a generic `COBBLES` race tag is not enough to invent precise cobbled kilometres.

## Current prototype

`lib/engine/v2/route.mjs` validates a stage and derives one deterministic environmental record per kilometre, including explicitly authored surface and wind-exposure segments. `orders.mjs` normalises simple presets, expert phase overrides and an optional precommitted backup-leader contingency. `tactics.mjs` models attacks versus finite chase capacity, including energy costs and a road-captain leadership response. `physiology.mjs` gives the proposed fourteen sporting skills specific terrain, effort and weather situations; five new skills are derived in memory for legacy riders, not written to the database. `tour.mjs` connects these into an immutable tactical trace; a stronger road captain notices an exhausted captain and executes the selected backup plan sooner. `groups.mjs` tracks per-rider deficits and provisional peloton, breakaway or dropped status. `finish.mjs` turns the final state into a deterministic **experimental** finish order. `tuning.mjs` keeps balance constants in one place. The group and finish calculations do **not** yet represent complete drafting, road positioning, crashes, true rider-by-rider time dynamics, stage standings or a production replay.

The trace records the actual riders ahead, limits one team's active breakaway contingent, prevents a rider from re-attacking while already ahead, and charges continuing energy cost for riding in the break. These are provisional race rules in the isolated model; they must be calibrated against complete group and finish simulations before release.

Inputs fail closed on unknown order fields, bad rider IDs, invalid stats, mixed race categories and missing seeds. Team and rider inputs are sorted before calculation, so database row order does not change the saved trace. This is necessary for reproducible results and later replay verification.

The existing feature-gated Race Lab now has a separate **Run kilometre prototype** action. It adapts the same fictional four-team cast to v2 and shows the saved kilometre trace and provisional finish order alongside the older flat-road experiment. Neither calculation reads player accounts or writes database rows; the two models stay visibly labelled so their outputs are not mistaken for live race results.

All input, event seed, route version, locked weather, order snapshot, tuning version and engine version must be stored with a future committed race. A replay should be rendered from stored simulation events, never rerun with current tuning after a balance change. New sporting stats must get explicit migration/default rules for existing riders; potential caps must remain server-owned and hidden.

## Next gates

1. Replace the initial group/finish approximation with per-rider sustained pace, drafting, terrain/surface/weather effects, energy recovery, road positioning and realistic group formation. Write scenario tests in which each visible stat changes the action it is meant to govern.
2. Expand precommitted contingencies beyond the first exhausted-captain rule, ensuring each has observable triggers, response delays and failure reasons. Balance leadership without making the captain's own speed depend on it.
3. Produce complete deterministic results and a recorded replay, then compare thousands of seeded races against the existing engine. Check role diversity, order impact, sensible energy use, upset rates and men/women separately. Tune constants centrally without rewriting the simulation.
4. Only after the new engine passes these gates: design a reversible database migration and isolated preview release. Do not change production data, the live race runner or scheduled jobs as part of this foundation.
