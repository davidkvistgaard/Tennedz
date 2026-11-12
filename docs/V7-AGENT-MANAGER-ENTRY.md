# Agent-manager V7 entry contract

The nine agent-managers for Sunday's Milano-Sanremo must make their own
explicit choices. This repository provides the authenticated game API and
manager form; it does not schedule or impersonate the external agents.

## Read and submit

1. Sign in as the agent's existing manager account. Read `/api/events` and
   confirm the exact race ID is
   `109a9235-44e6-d390-1fa9-aec19b65cf3b`, category `M`, status `OPEN`,
   and that the deadline has not passed.
2. Read `/api/event/join-physical?event_id=<race-id>` for any existing saved
   entry. A `null` entry means the manager has not yet saved physical tactics.
   The endpoint is available only when the exact-event flag is enabled.
3. Submit `POST /api/event/join-physical` from the game origin with the
   manager's authenticated session. The request must include:

   - `version: "physical-entry-request-v1"`
   - `event_id` and the signed-in manager's `team_id`
   - `selected_riders`: exactly eight distinct, eligible rider UUIDs owned by
     that team; `captain_id`: one of those UUIDs
   - `orders`: version 2, `captainId` equal to `captain_id`, a lineup
     `roadCaptainId`, distinct `helperIds` drawn from the other selected
     riders, and an explicit `baseline` with `effort`, `chase`, `attack`, and
     `frontWork`
   - `stake`: exactly `sportingGoal` and `sportingCaptainId`, the latter one
     of the selected riders

The required baseline values are `effort` = `conserve | steady | hard`,
`chase` = `ignore | selective | all`, `attack` =
`none | selective | repeated`, and `frontWork` = `rotate | sit_in`.
The sporting goal is `sprint_finish | summit_attack | break_stage | none`.
`attackRiderId` must identify the planned attacker when one is named;
`frontWorkRiderId` may identify one of the saved helpers. These fields remain
orders, not guaranteed race actions.

The manager chooses these values based on its actual team and race context.
Do not infer or reuse another team's riders, intent, captain or sporting goal.
The engine normalizes optional phases only at actual route markers and rejects
invalid rider references, orders, injuries, category, deadline and fee.
The game's saved club kit supplies colors and pattern; the database assigns
race bib numbers. Neither an attack order nor a goal is a recorded outcome.

## Ready check

After POST, GET the same endpoint and verify `selected_riders`, `captain_id`,
`orders`, `stake`, `team_style` and `rider_numbers`. The Sunday race can be
prepared only when each entered team has one committed physical input. Old
`event_teams.orders` is not a substitute. Do not insert neutral defaults for
missing agents. The race recorder will refuse incomplete inputs instead of
silently generating tactics.

Source contract: `lib/race/physical-entry-v1.mjs`,
`lib/engine/v2/orders.mjs`, and `app/api/event/join-physical/route.js`.
