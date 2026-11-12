# Agent-manager V7 entry contract

The nine ChatGPT Work-created managers for Sunday's Milano-Sanremo have
accounts, teams and entered lineups, but no verified running Work jobs.
The player continues to use the authenticated game form. For this one pilot,
Tennedz can submit an explicit, versioned tactical plan for each tagged
agent team. This deterministic game policy is not an independent Work
agent decision.

## Automatic Sunday policy

`winter-agent-tactics-v1` reads each agent's entered eight riders and
captain, actual rider ratings, saved flat route and club kit. It retains
that lineup and captain. The strongest support rider by
leadership/endurance/flat becomes road captain. A sprint captain gets a
`sprint_finish` goal, early conservation and unnamed helper rotation from
the start, then a selective chase from about 50 km to go. The engine selects one
available paid leader at a time. A captain better at hills than sprinting
gets an explicit `none` goal and conserves on this flat route. Both plans
switch to steady effort at 5 km to go. An order is not a recorded attack,
contact or result. The cautious policy is a Sunday test choice, not a
general model of agent-manager personalities.

The production cron calls `/api/cron/winter-agent-tactics` daily at 02:00
UTC. It requires private `CRON_SECRET`,
`PELOTONIA_WINTER_AGENT_TACTICS_ENABLED=true`, the existing exact-event
physical-entry flag and game-write setting. It checks that the specific
men's event is open before its deadline and verifies each owner has Auth
`app_metadata.pelotonia_agent = winter-2026`. It never touches a human team
or replaces committed tactics. The database rechecks the unchanged lineup
and saves the version, reason, orders and stake atomically with V7 input.
Repeated runs skip saved teams. This schedule and policy apply only to
event `109a9235-44e6-d390-1fa9-aec19b65cf3b`, not later races.

## Read-only whole-race check, 2026-11-12

The calibration script `scripts/audit-winter-agent-pilot-v1.mjs` used a
private read-only snapshot of the ten entered teams, their 80 selected
riders, current route and event data, plus a private list of the nine
Auth-tagged agent teams. The human team's uncommitted order was replaced
by a plainly synthetic conserve/sit-in scenario. Its first
attempt with a selective break order for the hills captain failed at km
151 on an uncommitted front pass. A named worker also became absent from
the peloton, and ending every rotation at 5 km to go left no payable
leader. The tested policy therefore uses no break attack and an unnamed
helper rotation that continues through the finish.

With the agent plans providing early rotation and the human team sitting in,
the recorder completed 298 km, 23,840 paid rider-km decisions and 80 line
crossings. Independent replay matched; the viewer document contained 367
frames and 980 contact events. It observed 14 unresolved finish ties and
assigned no official results. The race took about 66 seconds locally,
replay about 33 seconds. These inputs can change
before Sunday, particularly the human tactic and game date. This check
does not authorize invented official placings or guarantee a hosted run.

## Server-to-server agent route

`POST /api/agent/physical-entry` accepts the same
`physical-entry-request-v1` JSON body as the player endpoint. It is enabled
only for the configured physical-entry event. An agent sends
`Authorization: Bearer v1.<64 lowercase hex characters>` without browser
cookies or an `Origin` header. The token is a SHA-256 HMAC of the exact
event and team IDs under a server-only signing key; each team receives a
different token. The route refuses a missing or short signing key.

Before writing, the server checks that the team is already entered in this
event, its Supabase Auth owner has
`raw_app_meta_data.pelotonia_agent = 'winter-2026'`, and the submitted
eight riders and captain exactly match the existing entry. It reads the
game's saved club kit and route, uses `preparePhysicalEntryV1` to validate
and normalize the explicit order and sporting goal, then calls
`recovery_join_agent_event_physical_v1`. That wrapper locks and rechecks the
existing lineup in the same transaction before calling the player's
`recovery_join_event_physical_v1` RPC. The database still checks owner,
deadline, category, rider eligibility and fee atomically.
No endpoint permits an agent token to edit the human entrant.

The server requires a randomly generated
`PELOTONIA_AGENT_ENTRY_SIGNING_KEY` (at least 32 characters) in its
deployment environment. With that variable and the configured event ID in a
private operator shell, `node scripts/issue-v7-agent-token.mjs <team-id>`
derives one agent's token. The key and derived bearer tokens must never be
placed in the repository, a browser bundle or a ChatGPT message. Provision
each token to its corresponding Work agent by a private secret mechanism.
Work must call the route before the deadline and check the successful
response. The game does not currently provide a Work agent scheduler or
token-provisioning UI. The Sunday policy above supplies automatic orders
for this test event. Do not mark the race ready until the database has nine
tagged-agent inputs plus the player's separately saved input.

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
