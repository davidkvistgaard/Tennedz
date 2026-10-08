# PELOTONIA — Arena, Economy & Supporter: Product Decisions and Codex Handoff v1.0

**Status:** Product-design handoff, 8 October 2026. **Not** an instruction to deploy real-money wagering.  
**Scope:** Decisions made in the ChatGPT conversation beginning with the Gold/Gems economy discussion, through Arena Sealed and Supporter subscriptions. Earlier calendar, atlas, rankings and engine work remain separate.

## 0. Instructions to Codex

1. Read the existing repository and current work queue before making changes. **Do not interrupt, duplicate or replace** ongoing calendar, engine, tactics, onboarding, jersey or viewer work.
2. Treat this document as the product-design source for Arena and monetization, not as proof that features are implemented.
3. **First deliver a gap analysis and phased implementation plan** comparing this design with the existing architecture. Do not independently launch payments, paid-entry contests, pooled rewards or irreversible account changes.
4. Reuse the **same simulation engine and order-setting model** as normal races. Arena is a new competition wrapper, not a second race engine.
5. Keep all speculative settings configurable; flag unresolved questions rather than silently deciding them.
6. Separate legally safe prototype functionality (free test lobbies, non-redeemable test credits, mock payments) from any actual Gems purchasing, stakes or prizes. Real-money-related features require jurisdiction-specific legal review and explicit approval before implementation or release.

## 1. Core philosophy — agreed

- **No pay-to-win in the persistent career game.** Money must not buy stronger riders, Gold, faster progression, superior scouting results, race-engine advantages or exclusive competitive tactics.
- Two currencies with different purposes, plus a separate subscription entitlement:
  - **Gold:** earned/spent in the persistent sporting economy (transfers, wages, facilities, talent development, etc.). Never purchasable for cash or Gems.
  - **Gems:** purchasable premium currency for optional experiences/features. Potential Arena entry and prizes, **subject to legal clearance**. Gems won in Arena should be reusable for later Arena entries if the eventual legal model allows it.
  - **Supporter:** a paid subscription granting extra features, never competitive strength. Not a third currency.
- No Gold↔Gems exchange. Arena rewards do not grant Gold or normal-career ranking points.
- Keep accounting, entitlements and reward records auditable and separated.

## 2. Arena concept — agreed

Arena is an optional, on-demand multiplayer race mode. Managers create or join lobbies configured by a host. Example: **Flat, 200 km, Women, maximum rider skill 50**. Players should be able to find open lobbies and race outside the normal Wednesday/Sunday calendar. Lobby browsing and sharing support spontaneous play and community streaming.

**Candidate host settings** (some numeric choices are provisional):

| Setting | Direction |
|---|---|
| Race terrain | Flat / Hilly / Mountain / Cobbles / Mixed; align with actual engine support |
| Distance | Host-selected; example 200 km; suggested options 100/150/200/250/300 km are provisional |
| Gender | Men or Women; **never mixed-gender racing** |
| Rider skill cap | Configurable, e.g. 30/50/70/100; define exact stat semantics with existing engine |
| Managers | Configurable; suggested 2/4/6/8/12/16, provisional |
| Rider pool size per manager | **8, 12 or 16 — agreed** |
| Race team size | **8 in current Arena design**, but reconcile with engine's configurable team size before implementing |
| Pool format | **Sealed in v1**; shared Draft is future scope |
| Start/deadline | Lobby launches into preparation, then locks at deadline or once everyone is ready; exact timings TBD |
| Entry | Free/prototype initially; paid Gems entries and payouts are legally gated |

Avoid an explosion of empty lobby combinations: a few standard quick-match formats alongside configurable custom/private lobbies is a proposed UX solution, **not yet an agreed mandatory feature**.

## 3. Arena Sealed v1 — agreed

- **Sealed pool**, inspired by Magic: The Gathering: each manager receives an individually generated temporary pool of riders, not a shared draft.
- Pool size selected by lobby creator: **8 / 12 / 16**.
- Manager enters **8** riders for the race:
  - 8-pool: all eight must race (subject to valid roster/race rules).
  - 12-pool: choose eight of twelve.
  - 16-pool: choose eight of sixteen.
- **12 riders is a suggested default**, not an irrevocable decision.
- Randomness should produce different specialties and trade-offs while keeping competing pools **approximately balanced**. No guarantee of identical riders or the perfect lineup for the route. Balance method/limits remain a design/test question.
- Temporary Arena riders are isolated from permanent teams, transfers, Gold economy, career progression and normal ranking.
- **Shared Draft** (pick in turn from common pool, each rider only once) is expressly **later**, not v1.

## 4. Launch, information visibility and tactics — agreed

### Lobby and preparation flow

1. Host creates lobby with fixed criteria; other managers join.
2. At lobby launch, the actual route and each manager's sealed pool are generated/revealed for preparation.
3. Preparation screen shows **the route**, **my riders**, and **opponents' riders at a limited information level**.
4. Managers select eight riders, assign roles and enter tactics using the **existing** order UI.
5. Orders lock by the agreed start/deadline. If someone fails to act, safe default selection/tactics should prevent blocking, subject to existing eligibility rules.
6. The engine **fully computes the race at start/lock**. There are **no live tactical inputs** during the race.
7. Viewer replays the **already computed** race-state/events. Playback must not rerun the simulation.

### Opponent scouting visibility — explicitly agreed

During preparation, show **every rider in each opponent's generated pool**, with a high-level **rider archetype** (e.g. Sprinter, Climber, Rouleur, Puncheur, All-rounder). This lets managers infer likely approaches and counter-strategies.

**Do not expose during preparation:**
- exact numeric rider stats;
- which eight riders the opponent has selected;
- captain/helper roles;
- tactical orders or conditional instructions.

After selection lock, publish the **actual eight-rider start list and their archetypes**. Tactics remain hidden. Precise opponent stats remain private unless a separate future rule changes that.

Archetypes must derive consistently from actual rider attributes; do not invent an unrelated performance model. Their distribution should be useful without perfectly predicting the winning strategy.

### Streaming and spectators — direction agreed, specifics provisional

- A viewer/spectator experience should allow watching the precomputed race without having to manage a team.
- Streaming/social potential is a key reason for Arena. Spectators should not see secret orders during preparation.
- Concealing the result until playback reaches the finish is a desirable UX option, not a requirement to falsify or delay actual result persistence.
- Consider invitation links, shareable lobbies and spectator links when designing architecture.

## 5. Gems and entry pools — concept agreed, real-money mechanics unresolved

**User's desired concept:** buy Gems, spend Gems on Arena entry, win Gems from an entry-funded pool, reuse winnings to enter more Arena contests. Inspired by Magic Online drafts; a platform fee (rake) might be 0% or some percentage, but the user explicitly has **not decided**. Engagement may matter more than rake revenue.

**Hard compliance gate:** Purchasable Gems + entry stakes + outcome-dependent Gems prizes may constitute regulated gambling or another regulated paid-prize competition in Denmark and other target markets. A 0% rake or prohibition on cash withdrawal does **not** automatically remove the risk. Randomized rider pools/routes also matter. Before implementing or offering real-money Gems contests:

- Obtain qualified legal review for intended jurisdictions and payment-platform rules.
- Determine whether a licence, age checks, identity verification, AML controls, consumer protections, restrictions, reporting, etc. are needed.
- Do not implement production deposits, payouts, wagering, pooled prize distribution or cash-equivalent redemption without explicit approval following that review.
- For v1 prototype use **free entry / non-purchasable, non-redeemable test credits** and simulated reward distributions only.

**Still unresolved:** Gems purchase prices, packages, entry prices, prize curve, platform share/rake, Gems transferability/redemption, whether a Gems-only lobby is legal, whether Arena access is free or Supporter-gated, minimum participation, cancellations/refunds, deadlines, cheating/collusion safeguards.

## 6. Supporter — agreed

- **One Supporter tier**, not multiple paid ranks.
- Monthly subscription with discounts for **6-month and 12-month prepayment**. Same features across terms.
- **Provisional example prices, not approved final pricing:** 39 DKK / month, 199 DKK / 6 months, 349 DKK / 12 months.
- Supporter entitlement attaches to **manager account**, not a specific four-month Pelotonia season.
- No pay-to-win benefits. Possible cosmetic/convenience features: jersey/logo customization, team profile decoration, richer historical displays, race-following options, noncompetitive community features. Do not paywall essential tactical capabilities or materially better competitive intelligence.
- Supporter and Gems are **independent**: neither purchase should require the other by default.
- On subscription expiry, **preserve created assets and history** (e.g. jersey designs, historical records). Premium editing/viewing entitlements may lapse; do not destroy data.
- **Arena access as a Supporter benefit is undecided.** Full gating might reduce the active lobby population. A possible alternative is broad Arena access with Supporter-only cosmetic/private/community tools, but this is a proposal, not an agreement.

## 7. Gold economy — direction only; detailed design still pending

Gold should be earned and spent via sporting/manager systems: race prizes, wages, contracts, transfers, facilities, training/development, etc. Exact sources/sinks, inflation controls, starting balances, budgets, auctions, taxes, salaries, prize schedules and anti-abuse rules have **not** been agreed. Do not invent final numbers or deploy a new economy from this brief.

## 8. Implementation phases suggested for Codex (not a command to start now)

**Phase A — architecture/gap review:** inventory current rider, race, tactics, viewer, auth and ledger systems; identify schema and permissions requirements; propose milestones.

**Phase B — free Arena prototype:** create/join lobby, validate parameters, sealed pool generation, fair/bounded randomization, archetype-only opponent preview, select 8, deadline/auto fallback, engine run once, spectator-safe playback, results. No paid entry or redeemable rewards.

**Phase C — production quality:** permissions/isolation, idempotent launch, concurrent joins/locks, cancellation, no duplicate awards, seeded reproducibility, deterministic replays, accessibility, abuse controls, testing, performance, observability.

**Phase D — optional monetization:** Supporter subscriptions/cosmetic entitlements (after payment/security review), and **only after legal approval** any Gems purchase/entry/prize-pool design.

**Phase E — later:** shared rider Draft and more sophisticated tournament/spectator formats.

## 9. Acceptance criteria for initial free Sealed prototype

- Host creates a lobby with gender, route parameters, rider cap, 8/12/16 pool size and manager capacity.
- Participants can join without creating duplicate entries; lobby cannot exceed capacity.
- At launch each gets a sealed pool, sees the route and opponent rider names/archetypes but not exact stats or selections.
- A pool of eight requires all eight; larger pools allow selection of exactly eight.
- Tactics are set via the existing engine-compatible order workflow.
- Unready managers follow a documented safe fallback; no participant can indefinitely block the lobby.
- After lock, actual startlists become visible; secret orders stay private.
- One simulation produces immutable results and a viewer-compatible replay; retries never rerun for new results.
- No persistent career riders, Gold, regular ranking or economy balances are affected.
- No real-money Gems pool, wagering or redeemable prizes are active.
- Tests cover authorization, privacy, duplicate requests, race fairness constraints and replay consistency.

## 10. Decisions explicitly **not** made

- Whether Arena is open to everyone or Supporter-only.
- Final supporter price and premium feature list.
- Whether/where Gems entry with winnings is legally possible, and any rake or prize distribution.
- Exact timing of lobby launch, selection deadline, cancellation and refund.
- Exact sealed pool balancing algorithm and skill-cap meaning.
- Final list of lobby formats, distance increments and manager caps.
- Public display of stats after race; spectator replay privacy options.
- Gold earning/spending rates and detailed macroeconomy.

## 11. Request for Codex's response

Please return (1) what already exists in the repo, (2) conflicts with the current engine/calendar/auth, (3) recommended incremental implementation order, (4) what can safely be prototyped immediately without payments, (5) the unresolved decisions requiring product or legal approval. **Do not assume this handoff grants permission to deploy paid-entry Arena or modify existing live player finances.**