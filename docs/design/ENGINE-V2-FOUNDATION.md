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

An attempted attack now has a separate admission event. If the peloton's chase overpowers the new move, that rider pays the attack cost but cannot appear in an older break that still has a positive gap. Race Lab and the recorded frame show attempted attacks separately from riders who joined; the frame also retains attack and chase pressure so replay validation can check that distinction. This changes tactical outcomes and is balance version `v2-prototype-12`.

When a chase closes the break's gap, the frame records which riders were caught. A later attack can establish another break under its precommitted orders, with the earlier riders' spent energy preserved. Replay validation checks the catch against the preceding kilometre.

For provisional dropped groups, the reference pace comes from riders still attached to the bunch. Riders already distanced cannot lower that reference when many fall behind together. This changed group outcomes in balance version `v2-prototype-11`; it still needs broad seeded calibration before release.

Effort now changes immediate attack and chase pressure as well as the continuing energy bill. The stronger `hard` setting can create or close a gap sooner, but leaves less energy for later kilometres. The multiplier is a central balancing parameter, not a public percentage shown to players.

Selective chase now remembers a detected break while it remains ahead. The road captain's leadership still affects the initial recognition; the team does not abandon an already committed pursuit merely because it has reduced the gap below the original trigger threshold. This pursuit state is part of the deterministic simulation trace, not a mid-race user input.

The `protect` preset now commits saved helpers to a progressively stronger sprint-train chase in the final ten kilometres, paying a matching energy surcharge. This gives a fresh sprint team a real counter to late attacks without making every late break automatically fail. Its balance still needs broad scenario checks before release.

Outside a break, available helpers on `protect` can also shelter their active leader. The leader saves some baseline energy while those helpers spend extra energy; helpers selected for chase work in the same kilometre cannot provide shelter. Positioning, strength, handling and wind skills influence which helpers are effective. This is a first draft of team protection, not a complete drafting or road-position model.

A rider following `conserve` can now recover a little energy after several uninterrupted quiet kilometres in the bunch on calm, flat roads. Higher endurance improves that recovery. Attacking, chasing, sheltering a leader, riding ahead, hard effort, rough terrain and difficult weather interrupt the rest streak. Recovery cannot exceed the rider's starting race capacity after pre-race fatigue; it is not a free refill to 100.

Tactical attack and chase pressure now uses the same kilometre environment as rider movement. Cobbles, gravel, rain, exposed wind and temperature can favour different specialists, rather than changing only the displayed pace. Descending uses the explicit descending skill, and extreme heat or cold lowers ability and raises energy cost with endurance providing partial resilience. These are centrally tuned prototype relationships, not published percentages for players.

Attack candidates and chase helpers now need enough remaining energy, and riders marked dropped cannot contribute to the peloton's chase or launch a new front-group attack. An exhausted helper therefore cannot keep producing chase power after its energy has reached zero; another available rider may take its place. This makes finite team work an actual limit rather than only a cost on paper.

Managers may optionally name a specific attacker in their baseline order or change that choice at a 10 km marker or authored keypoint. `null` returns to automatic selection. A named rider is not silently replaced when already ahead, dropped or exhausted; the recorded trace keeps a reason for the blocked attempt. Simple presets still choose an available rider automatically.

Inputs fail closed on unknown order fields, bad rider IDs, invalid stats, mixed race categories and missing seeds. Team and rider inputs are sorted before calculation, so database row order does not change the saved trace. This is necessary for reproducible results and later replay verification.

The existing feature-gated Race Lab now has a separate **Run kilometre prototype** action. It adapts the same fictional four-team cast to v2 and shows the saved kilometre trace and provisional finish order alongside the older flat-road experiment. Neither calculation reads player accounts or writes database rows; the two models stay visibly labelled so their outputs are not mistaken for live race results.

`recording.mjs` validates every saved kilometre against the final rider list, verifies that breakaway membership follows the previous frame and that team/chase events name actual entrants, and checks that provisional placings agree with the last frame. The recording now includes the race category derived from its validated, single-category entrants, the race seed and the normalised locked weather that shaped the kilometre conditions. Men and women remain separate race outputs; the prototype uses the same physical coefficients for both until category-specific balancing has evidence. Playback reads a copy of an existing frame; it has no simulator dependency and does not rerun the race when the viewer seeks. This is an in-memory contract only. Server-side storage, source-roster verification, integrity signatures, access control and production replay are still outstanding. A stored category label alone cannot prove that a later writer did not alter it.

All input, event seed, route version, locked weather, order snapshot, tuning version and engine version must be stored with a future committed race. A replay should be rendered from stored simulation events, never rerun with current tuning after a balance change. New sporting stats must get explicit migration/default rules for existing riders; potential caps must remain server-owned and hidden.

## Next gates

For repeatable balance diagnostics, run `node scripts/engine-v2-balance.mjs 100`. It compares the four plans using the same 100 seeds and reports wins, placings, energy, breakaways, dropped riders, attempted attacks and successful admissions. This is a fixed fictional flat-road cast; its rates are diagnostic, not a target distribution for the full game.

1. Replace the initial group/finish approximation with per-rider sustained pace, drafting, terrain/surface/weather effects, energy recovery, road positioning and realistic group formation. Write scenario tests in which each visible stat changes the action it is meant to govern.
2. Expand precommitted contingencies beyond the first exhausted-captain rule, ensuring each has observable triggers, response delays and failure reasons. Balance leadership without making the captain's own speed depend on it.
3. Produce complete deterministic results and a recorded replay, then compare thousands of seeded races against the existing engine. Check role diversity, order impact, sensible energy use, upset rates and men/women separately. Tune constants centrally without rewriting the simulation.
4. Only after the new engine passes these gates: design a reversible database migration and isolated preview release. Do not change production data, the live race runner or scheduled jobs as part of this foundation.
