# Breakaway race dynamics: playable target

The 260 km Motor Lab mountain recording exposed a systemic problem: attacks recur, but the front usually stays only tens of seconds clear. This document defines the next bounded motor and viewer change. It does not change existing recordings or claim that the current motor already pays these dynamics.

A read-only baseline can be reproduced with `node scripts/audit-breakaway-dynamics.mjs`. Across three seeds, flat/mountain terrain, and fatigue 0/30 (twelve 20-team, 260 km runs), it records **51–312 attack attempts**, but no run reaches a one-minute front lead; the maximum lead over the matrix is **45.07 seconds**. These are diagnostic samples, not a calibrated distribution. The user's race log shows the same qualitative pattern.

A broader read-only check of the *current v93 guided motor* used 24
new synthetic seeds across flat/mountain 260 km routes and fresh/tired
20-team fields (96 races). The mean widest recorded road lead was
38.79 seconds on fresh flats, 38.11 on tired flats, 34.31 on fresh
mountains and 37.56 on tired mountains. Only three of the 96 had any
kilometre at or above one minute. Ninety-five paid an individual
finish; the fresh mountain `guided-finish-coverage-19` source road
validated but refused a last-kilometre contact with `road-14`, so no
official result is inferred for it. Individual widest leads ranged
from 1.49 to 94.63 seconds across the matrix. This confirms the
short-lead problem over more seeds without turning a particular
gap into a mandatory target.

## Observed causes in the current implementation

- Uncustomized rival tactics can assign repeated attacks for the whole race. A repeated plan attempts an attack every five kilometres, including after an early break has settled.
- A selective chaser regards at most ten seconds as a safe gap (`maxSafeGapSeconds`), then pays chase work. A fresh attack also triggers selective chase immediately.
- Passive front-versus-bunch drift is capped at 1.5 seconds per kilometre. Even a cooperating break cannot grow a several-minute lead at a credible early-race rate through that path.
- The engine has no explicit distinction between a fresh one-day race and a fatigued stage race when deciding who is content with the break, when pursuit starts, or how likely a break is to survive.

Changing only the commentary, the rival randomizer, or the ten-second threshold would hide one symptom while leaving the other causes intact.

## Versioned race model

Keep rider skills, energy, team roles and committed tactics independent of the stage. Supply race format, starting fatigue and the stage overlay as separate inputs. The stage supplies road, gradient and weather; race format and team intent determine decisions. Existing motor versions and saved results remain unchanged.

1. **Opening:** teams choose a bounded number of break candidates according to roles and goals. Several riders may establish one cooperative front. A team with a suitable rider ahead normally stops sending routine attackers and avoids leading the chase. Committed manager orders may override that intent.
2. **Settled break:** each team evaluates whether the front composition is acceptable, considering its rider ahead, captain objective, remaining distance and stage-race context. If enough teams accept it, the bunch eases. Break riders choose work sufficient to protect or grow the gap while saving energy; sitting on remains an explicit, costly-to-cooperation choice. Gap growth must be paid by separate front and bunch road clocks and rider energy, never assigned as a scripted five-minute bonus.
3. **Pursuit:** a team commits helpers according to a projected catch time and its own objective, rather than a fixed small gap. The target changes as the route, remaining distance, weather, group strength, fatigue and cooperation change. A fresh one-day peloton can coordinate a stronger pursuit; a fatigued stage-race field may fail to organize. Mountain routes can trigger earlier pressure and captain action.
4. **Finale:** front riders may stop cooperating and attack one another, while chasing teams can increase effort. The model must pay each action, energy change, road-group change and contact before offering a conditional line. It must retain explicit refusal where contact or wheel order is unresolved and must not invent official places or awards.

The useful outcome is not a mandatory 5–8 minute break in every seed. It is a distribution in which a credible early break can reach that range, sometimes be caught and sometimes survive for explainable reasons. Manager orders must be able to change that outcome.

## Research basis (26 October 2026)

- Olds' mathematical model identifies remaining distance, break and chase group size and speed, drafting, gradient, road surface and wind as determinants of the lead needed to survive. These belong in projected catch time and the two groups' paid road clocks, not in a fixed safe-gap threshold. https://pubmed.ncbi.nlm.nih.gov/9650732/
- Professional race observations found very hard, short surges to establish a break, followed by a lower but still demanding output. Model launch and settled cooperation as different efforts; do not leave every attacker in repeated launch mode. https://pubmed.ncbi.nlm.nih.gov/23539668/
- The empirical breakaway study reports a group-size/strength effect, with diminishing benefit as the group grows; its Tour stage-race sample is not a universal target distribution. It also reports that early breaks rarely succeed in the one-day races considered. We should compare one-day and stage-race contexts without making either outcome inevitable. https://doi.org/10.1016/j.joep.2018.08.001
- In a Tour de France team interview, Tim Wellens explicitly described the team accepting a break without GC contenders and conserving its objective across a long stage race. This supports a team-specific acceptability decision rather than an automatic chase of every gap. https://www.letour.fr/en/news/2025/tim-wellens-tadej-was-feeling-great-today/1327055
- The official Tour account of 2024 stage 14 records an early break that grew to 4:10 by km 70.2, a peloton acceleration, and captain action on the final climb. It is a concrete mountain-stage replay target, not a template to force onto every seed. https://www.letour.fr/en/news/2024/spectacular-pogacar-impresses-with-saint-lary-soulan-triumph/1322037
- A six-hour field simulation found different fatigue losses between elite cyclists, with sustained 5 km time-trial output declining over the race. Starting fatigue and accumulated work should affect the *capacity and willingness* to attack or chase, not be represented as a guaranteed breakaway victory. https://pubmed.ncbi.nlm.nih.gov/39011951/

The numeric gap range and roughly 50 km pursuit cue come from the manager's desired feel, not from a claimed universal scientific law. Race accounts also show exceptions, including days without a sustained early break. Model calibration should report distributions and counterexamples instead of forcing a fixed story.

## Motor Lab acceptance evidence

Run the same seeded route and roster under one-day/fresh and stage-race/fatigued contexts. The recorded replay must expose, at every relevant change, who attacked, who joined, who worked or sat on, which teams withheld or began pursuit, the gap, remaining distance, and energy paid by named riders. The viewer should turn those recorded causes into concise race commentary. Compare many seeds and report break size, maximum gap, first sustained pursuit, catch/survival, attack attempts and energy. Include the user's 260 km mountain scenario as a regression case; compare its event counts and gap timeline with the current recording. A short flat race and a mountain race need separate checks. Do not tune a single seed into a predetermined story.

The first implementation increment should be a separately versioned, opt-in race-context/intent path with its own recording contract and focused parity tests for old versions. Do not route it as the guided default until the full race replay and viewer can explain its decisions.

## Internal v94 candidate audit (26 October 2026)

The first candidate matrix varied three seeds, flat/mountain, fatigue 0/30,
one-day/stage contexts, and three explicit 20-team role mixes
(3 break/2 control, 5 break/2 control, 5 break/4 control): **72 synthetic runs**.
This is a constructed intent matrix, not a random-rival population or an
observed-race calibration. Roles are required input to the candidate; it is
not routed to guided Motor Lab or validated as a saved recording.

The candidate reduces these scenarios to 3 or 5 early attacks and can pay a
several-minute lead. But pursuit is still wrong: **all 72 runs retain a front
group at the line**. Five-break/two-control scenarios average about 479–560 s
maximum lead and 117–156 km above five minutes. Five-break/four-control
scenarios stay below five minutes, yet still finish with the front ahead.
One-day and stage results are also too similar. The gap comes from explicit
team intent, individual work/energy and a candidate pace conversion, not an
assigned five-minute bonus. The conversion and catch decision remain
uncalibrated. Do not publish the candidate as playable or infer an official
winner; next compare paid chase capacity with front work and obtain both
credible catches and survivals across seeds without scripting either result.

The next candidate lets *selective* teams assigned to protect a captain join
the final 50 km pursuit in a one-day race. They remain free to withhold on a
stage unless an existing GC/emergency or explicit order applies. The revised
`node scripts/audit-race-dynamics-v94.mjs` gives protective teams selective
plans and adds a 5-break/6-control mix: **96 runs** over the same routes,
seeds and fatigue levels. At least one front rider is recorded caught in
**33/48 one-day** and **3/48 stage** scenarios; this does not establish that
the entire original break was caught. With five break teams and two control teams, the mean
maximum lead is about **413 s one-day** and **524 s stage**; at least one catch
occurs in **3/12** of that harder mix. Flat/fresh one-day scenarios record at
least one catch in **12/12** across the four role mixes; mountain/fatigued
one-day scenarios do so in **9/12**. These numbers illustrate sensitivity to
explicit team intent and paid chase work, not a realistic race distribution.
The additional protective teams can spend more helper energy late, while
stage contexts more often retain a front. The candidate still lacks a
recording validator, a settled-break pacing decision and proof that a tired
front's unpayable work changes its road speed correctly; no guided routing or
official result should follow from this audit.

The 96 standard-role runs recorded **zero** front rider-kilometres with
unpayable energy demand. An intentionally hard-driving, fatigued 260 km
mountain probe exposed a separate edge case: its first front rider could not
fund the ordered work at km 136 (20 rider-kilometres of unpaid front demand in
the prior prototype). The v94 candidate now explicitly refuses that input;
the older v93 behavior is untouched. This is a safety boundary, not a paid
slowdown or a complete long-race solution. A front-specific road-clock and
contact transition remains necessary before broad playable routing.

An expanded read-only audit of the same 96 cases records role-specific helper
energy, actual team-kilometres in pursuit, and the lead at km 205/210/220.
For the twelve **one-day, five-break-team** cases per control-team count:

| Control teams | At least one rider caught | Mean lead at km 210 | Mean control-helper energy at km 210 | Mean protective-team pursuit in final 50 km |
| --- | ---: | ---: | ---: | ---: |
| 2 | 3/12 | 404 s | 28 | 591 team-km |
| 4 | 12/12 | 105 s | 29 | 208 team-km |
| 6 | 6/12 | 27 s | 36 | 28 team-km |

Adding a sixth control team does not fail through greater early helper depletion:
those helpers have *more* energy at km 210 than in the four-control cases.
Despite a smaller lead, the protective teams contribute much less paid final
pursuit. Their independent potential-catch decisions appear to free-ride on
control-team effort; the observed gap then sometimes remains positive at the
line. This is a candidate-model diagnosis, not a claim about real teams.
Future pursuit decisions should be checked against observed paid closing and
the remaining distance, with a stable leading front identity, before this
version can become playable. Do not force a catch by assigning a gap or an
unpaid speed bonus.

The next internal candidate checks whether the *same leading road group* has
actually been closing over five completed kilometres. A changed group ID or
rider roster makes that observation unavailable. In a one-day final 50 km, a
protective team becomes aware when the observed closing would not catch that
front comfortably before the line. It still has to supply eligible helpers,
pay their work, and produce a road-clock catch; no gap is assigned. This
corrects the previous path where a team could consider its own hypothetical
speed sufficient and never become aware enough to use it.

Across the same 96 constructed cases, at least one rider is recorded caught in
39/48 one-day and 3/48 stage runs, with no front exhaustion refusal or unpaid
front rider-kilometre. That broad count alone does **not** mean the original
break was wholly caught. A tighter 36-run, one-day, five-break-team audit tracks
the five riders in the first established front by ID:

| Control teams | Original five all caught | Original rider still ahead at line | Front at line (may be a new move) |
| --- | ---: | ---: | ---: |
| 2 | 3/12 | 9/12 | 9/12 |
| 4 | 12/12 | 0/12 | 9/12 |
| 6 | 12/12 | 0/12 | 3/12 |

The nine four-control cases with riders ahead at the line have a *different*
late front after the original five were caught. The audit does not call those
official winners. The candidate remains internal pending recording validation,
larger role/seed sampling, a paid front-exhaustion transition and viewer replay.

The next v94-only phase adds an actual settled-front work transition. Once the
same leading group has been recorded for five kilometres, there was no chase
in the prior kilometre, its observed closing does not project a catch before
the line, and every front rider has a steady effort order, cooperative riders
alternate maintenance turns. Explicit `drive` pullers stay on duty. The
non-pullers pay conserve baseline plus sit-on exposure; the active worker
roster also determines the group's road pace. A renewed chase or a threatening
closing trend returns the willing riders to full cooperation. No fixed time
gap is granted to the break. The v94 frame records the active and resting
rider IDs; older versions remain unchanged.

In the same 96 constructed 260 km cases, the phase produces a mean 47.5
resting-front rider-kilometres per one-day run and 72.6 per stage run. All
initial front riders are subsequently caught in 37/48 one-day and 3/48 stage
runs; an initial rider remains ahead at the line in 11/48 and 45/48
respectively. Mean maximum leads are 259 s one-day and 337 s stage. No run
refuses or records unpaid front work. These are synthetic, chosen role mixes,
not calibration to observed race frequencies or proof of a credible full
sporting result. The hard-driving exhausted-front refusal still stands, and
the candidate still lacks independent whole-race replay and official results.

An internal v94 recording check now requires the committed one-day/stage role
map, reconstructs the prior five-kilometre front observation from completed
frames, and derives the settled front's pulling and resting riders from the
previous road groups and committed orders. It also checks the energy ledger
against each rider's recorded reserve and verifies which teams qualified for
bunch easing. A changed observation, work/rest roster, ease roster, energy
charge or incomplete role map is refused. In a 36-case five-break-team
synthetic subset, all candidate recordings passed this check. The full
96-case constructed matrix also passed the internal replay check. A later
v94-specific check requires paid bunch pace to name eligible helpers from a
committed front-work order; a forged helper roster is refused. This tests
internal consistency of paid frames; it does not independently re-simulate
the whole race, validate every v94 pursuit decision, certify a sporting
result, or make v94 ready for the guided Motor Lab.

The v94 frame now also retains each chasing team's named helper riders and
computed capacity. Validation checks team/order eligibility, unique helper
participation and that the contributions sum to the recorded chase power.
This gives a later commentator a paid basis to name which team actually
worked in the bunch. It does not by itself prove that the chase accelerated
the bunch or caught the break; the recorded road-gap transition must support
those claims separately.

A separate v94-only `paidRearGapSeconds` records the tactical road-clock gap
before later split, bridge, merge or finish processing. The recording check
recomputes this from the prior rear-group gap, recorded attack/chase
contributions, passive movement and the bounded final-kilometre rule. In a
simple surviving rear group it must also equal the road-group gap. All 96
constructed races passed the check; changing an attack contribution or this
paid gap is refused. The remaining limitation is that the one-kilometre road
model cannot prove each rider's continuous position or wheel contact.

The passive break/bunch drift calculation is now a shared pure function used
by both the motor and the v94 recording check. The check reconstructs each
prior rider's energy and committed skills/orders, the active break pullers,
the dropped riders, the route kilometre, paid bunch-front pace and the
validated bunch-easing decision. It rejects a forged passive gap even if the
forged final gap is made arithmetically consistent. All 96 constructed cases
passed. This still uses the version's coarse kilometre road model and does
not establish a continuous occupied-wheel trace or an official result.

The reproducible `node scripts/audit-race-dynamics-v94.mjs --summary` view
also separates starting fatigue within those 96 constructed cases:

| Format | Starting fatigue | Original front fully caught | Mean maximum lead | Mean resting-front rider-km |
| --- | ---: | ---: | ---: | ---: |
| One-day | 0 | 21/24 | 263 s | 50.1 |
| One-day | 30 | 16/24 | 255 s | 44.9 |
| Stage | 0 | 3/24 | 336 s | 75.5 |
| Stage | 30 | 0/24 | 337 s | 69.8 |

In this role matrix, starting fatigue reduces the number of original fronts
fully caught in both formats, while the mean maximum lead barely changes.
That is a useful directional check of the intended fatigue effect, not a
measured race frequency: the same three seeds, two terrains and four deliberately
assigned role mixes appear in each row. The stage/one-day difference also
reflects explicit team pursuit policy, so these figures do not isolate fatigue
as the sole cause or justify routing v94 into the guided game.

An additional `--stress --summary --validate` read-only audit holds five
assigned break teams and varies control teams outside the earlier matrix.
Each row has twelve 260 km cases (the same three seeds, two terrains and two
fatigue settings):

| Format | Control teams | Original front fully caught | Mean maximum lead |
| --- | ---: | ---: | ---: |
| One-day | 0 | 0/12 | 952 s |
| One-day | 1 | 0/12 | 567 s |
| One-day | 8 | 12/12 | 177 s |
| Stage | 0 | 0/12 | 1077 s |
| Stage | 1 | 0/12 | 698 s |
| Stage | 8 | 9/12 | 229 s |

All 72 recordings passed the current v94 consistency validator without a
refusal. This is a useful sensitivity check: control-team count changes the
paid lead and catch, rather than a hard-coded target gap. It is also a clear
limit on readiness. With no control team, the candidate allows a mean lead
of roughly 16–18 minutes; it cannot yet pick credible opponent roles or
claim that a typical race settles near any particular gap. The stress runs
are synthetic extremes, not evidence for real-world frequencies.

The static `mixed` test rival plans reveal a different problem. They are not
the guided Motor Lab's random rival generator. The
read-only `--mixed-defaults --summary --validate` diagnostic infers provisional
roles from those plans without changing any team orders: five attack/ignore
teams become `break`, five hard/all-chase teams become `control`, and the rest
protect or remain opportunistic. Across 24 seeded flat/mountain 260 km cases,
all recordings pass v94 validation but **none records a settled-front rest
turn**. The mean maximum lead is only 8 s for fresh one-day races, 23 s for
fatigued one-day races, 8 s for fresh stages and 74 s for fatigued stages.
The first chase is around kilometre 20; in every case the initial five-rider
front is caught. This diagnostic is deliberately *not* a default role planner
or a measurement of the guided default. It shows that merely applying v94 to
the static mixed orders would reproduce the rapid-fire, short-gap race. Before
routing v94, rival intent must be generated as a committed pre-race choice
and the manager must be able to inspect it in the workbench. A team explicitly
ordered to chase cannot silently be relabelled passive to manufacture a gap.

The separate `--guided-random --summary --validate` diagnostic samples the
actual guided rival-tactic resolver with the same seeded diagnostic generator
used for the old v91 baseline, then provisionally maps those recorded orders
to roles. The live UI draws its rival tactics with a fresh random source, so
these are reproducible samples of its policy, not the exact next live draw.
Across 24 seeded flat/mountain 260 km cases, the resolver assigns about 8–9
attack/ignore teams and 2–3 all-chase teams per race on average. The v94
candidate records settled-front rest and passes validation in all 24 cases:

| Format | Starting fatigue | Original front fully caught | Mean maximum lead | Mean resting-front rider-km |
| --- | ---: | ---: | ---: | ---: |
| One-day | 0 | 2/6 | 295 s | 125 |
| One-day | 30 | 0/6 | 459 s | 290 |
| Stage | 0 | 2/6 | 403 s | 125 |
| Stage | 30 | 0/6 | 595 s | 290 |

This is closer to a sustained break than the static `mixed` case, but the
original break is rarely fully caught, including in fresh one-day races.
It does not yet meet the intended end-to-end race dynamics. The inferred
role map is audit-only; future playable intent must be committed and visible
before the start, while manager overrides remain authoritative.

That wider rival mix also exposed an internal validation error: the same
paid road-group pullers appeared in a different list order after a later
road-group snapshot. v94 now validates the unique worker and resting rider
*membership*, including passive road movement, without interpreting array
order as occupied-wheel position. A changed or duplicated worker still fails.

An internal, separately versioned pre-race workbench experiment now creates
`prepareV94RivalIntent` from the synthetic roster, declared manager orders,
route category and race seed. It commits each generated rival role together
with a matching baseline order and reports whether the choice was generated
or supplied by a manager. Explicit tactics are left intact; a manager who
orders both an attack and a chase retains both, rather than being silently
turned into a protective non-attacker. This is a seeded design proposal, not
an empirically fitted team-goal model or a guided Motor Lab input.
The manager's directly selected `attack:none, chase:selective` order now
commits a `control` intention, so it can actually pay for a selective pursuit
in a stage. Previously it was inferred as `protect`, whose stage policy
withheld that same order on every kilometre in a locked 260 km case.
Generated or explicitly declared `protect` goals retain their separate
protective policy. Older recordings that committed the former manager
`protect` role still validate and source-replay from their saved inputs.
A direct `attack:selective, chase:selective` order keeps its
`opportunistic` role and may pay for selective pursuit on kilometres without
its own attack. A locked stage race records one attack attempt and 110 paid
chase kilometres for that team, with no same-kilometre overlap. Generated
opportunistic teams still have `chase:ignore`.
The read-only `scripts/audit-v94-preview-cross-boundary.mjs
--combined-order` runs this manager combination across two seeds, both
formats, flat/fatigued mountain routes and zero/one/eight rival controls.
All 24 complete validation and source replay; no manager attack and chase
occur on the same kilometre. Mean own paid chase spans 184.1 km with no
rival controls, 67.9 km with one and 52.4 km with eight. That long solo
workload is a reason to keep the preview experimental.
The same audit with `--alternate-routes` validates and source-replays 24
women's rolling/exposed 260 km cases with the combined order. No same-km
overlap occurs; mean paid chase is 186.8/64.6/46.6 km for zero/one/eight
rival controls, respectively. These are synthetic workload checks, not
observed race frequencies.
The internal planner also accepts a declared `rivalGoals` list. A goal
commits both the role and matching opening orders before simulation; a goal
for a rival whose tactics were explicitly edited is refused as conflicting.
A locked 40 km comparison verifies that declaring `break` leads to a paid
attack attempt while declaring `control` leaves that rival out of the attack
record. This provides a concrete future tactics choice, but it is not yet
connected to the guided interface.
The read-only `scripts/audit-v94-manager-goal.mjs` holds a 260 km course,
seed, weather, roster and every other team's plan fixed, changing only
`rival-1` between those two declared goals. Across three seeds, two terrains,
fatigue 0/30 and both formats, all 24 pairs completed and validated:

| Format | Break-goal attacks | Control-goal chase team-km | First control chase km | Break/control mean energy at km 200 | Break/control mean maximum gap |
| --- | ---: | ---: | ---: | ---: | ---: |
| One-day | 1.42 | 194.5 | 42.7 | 60.3 / 41.4 | 298 / 199 s |
| Stage | 1.00 | 190.0 | 60.7 | 61.6 / 46.0 | 427 / 281 s |

The declared goal materially changes paid actions and energy rather than
just commentary. It also exposes a problem: the single control team begins
chasing early and works for roughly 190 km, including about 166 team-km
before the last 50 km in one-day races. This is not yet convincing manager
behavior for a peloton that deliberately lets a harmless break settle.
The next pursuit revision should explain when a control team shares, pauses
or resumes work using recorded gap, rival contributions and remaining
energy, not simply weaken chase with an arbitrary distance rule.
The audit's optional `--timeline` trace gives a concrete example in the
first flat, fresh one-day pair. Three control teams chase continuously from
about km 50 to km 200, while the recorded lead grows from 187 to 218 seconds.
The selected control team's mean energy falls from 96.85 to 50.01. The
recorded chase is paid, but it is not closing; the present selective rule
keeps spending because a single team's hypothetical catch projection is
unsafe. This is the decision failure to address. A candidate pause or shared
pull must be judged against subsequent *observed* gap movement and all
teams' charged work, with no free catch or assumed wheel order.
A discarded v94 experiment let one of three prior chasing control teams rest
when a stable front was not closing. In the same 24 paired cases, control
work fell only from 194.5 to 189.5 team-km in one-day races (190.0 to 184.3
in stages), while mean maximum gaps increased from 199 to 216 seconds
(281 to 295 in stages). Mean control-team energy at km 200 improved only
from 41.4 to 42.5 (46.0 to 46.9 in stages). It did not solve the persistent
ineffective pursuit, so the experiment was removed. A future model needs
to pay and control the whole bunch/front pace over time, then audit the
actual gap and rider energy, rather than rotate a cosmetic rest turn.
The next v94-only change instead lets a stable leading group share its own
maintenance work while an active chase is *not measurably closing* over the
same five-kilometre, same-membership front. Once the recorded gap starts
closing, every puller works again; explicit drive orders always keep working.
In the 24 paired manager-goal cases, mean maximum lead fell from 298 to 248
seconds for the one-day break-goal runs and from 427 to 380 in stages. The
control-goal cases fell from 199 to 181 and 281 to 266 seconds respectively.
All 48 recordings validated and replayed. The broader 96-case constructed
role matrix also validated with no refusals: original-front catch counts
remained 24/24 and 21/24 in fresh/tired one-day cases and 3/24 and 0/24 in
stages. Mean settled-front rest rose substantially, to 183–204 rider-km per
case across the four format/fatigue sets. This is paid energy conservation,
not a scripted lead or proof of realistic front pace. Control teams still
chase for roughly 190 km in the paired audit, so that separate problem remains.
The next internal v94 energy step separates *passive riders sitting in* from
the road-clock easing of the whole bunch. Once the same leading group has
survived long enough to measure its five-kilometre trend, non-attacking,
non-chasing steady teams can conserve behind an active paid chase. The
recording names those `pelotonRestTeamIds` independently of
`bunchEaseTeamIds`; the latter still changes bunch road pace only when the
field collectively eases with no chase. Workers, attackers, rotating front
helpers and explicit all-out orders do not receive this rest. The validator
derives the eligible teams from committed orders, actions and prior road
state and rejects a forged rest roster. This is still internal and does not
authenticate who occupies a particular wheel.
The 24 paired goal cases all validated and replayed: one-day control-team
chase fell from 193.7 to 172.3 team-km, with its mean energy at km 200 rising
from 41.5 to 46.4; stage control chase fell from 189.7 to 173.8 team-km and
energy rose from 46.1 to 51.1. These teams still spend much of the day
chasing. In 96 held-out synthetic planned-intent cases, original-front full
catches were 19/24 fresh and 17/24 tired one-day, versus 2/24 fresh and
0/24 tired stages; all validated. In 96 held-out samples of current guided
random rival orders, the counts were 10/24 and 4/24 one-day versus 7/24 and
4/24 stages. Their mean maximum leads were only about 195–206 seconds in
one-day cases, with roughly nine break-role teams per sample. This still
does not establish the intended race experience or an empirically typical
break. The unresolved work is credible opponent intent and selective
long-range control, not a prescribed gap target.
The read-only planned-intent audit now also counts *which riders* attempt
break-role attacks. Across its 24 validated races, all four attempts
in each stage-format set come from team captains; the break teams' later
one-day attempts include roughly 6–7 helpers and four captains per race.
This is not a dedicated breakaway-rider role. A quick v94-only exclusion of
captains changed the first unpayable-front-work refusal in the locked
fatigued mountain case from km 136 to km 135, so it was reverted. A future
break specialist should be a distinct, committed rider choice, with named
manager attacks and existing exhaustion/contact refusals preserved.
The internal planner now records a version-2 break-specialist rider for
generated or declared break goals, chosen before the stage from acceleration,
endurance and repeatability among noncaptains. Automatic v94 moves try that
rider if available, then retain the existing candidate fallback; explicit
manager orders and helper reservations take precedence. Version-1 intent
recordings remain valid. In the same 24 planned-intent races, all four
stage-format break attempts per case now come from helpers, with zero captain
attempts, and all recordings validate and replay. Mean maximum leads changed
from 556/550 to 534/529 seconds in fresh/tired stages; this is a tactical
composition change, not evidence of calibrated gaps or official outcomes.
The twelve-new-seed holdout can be run as three four-seed batches with
`--extended-seeds --planned-intent --validate --summary` and one
`--seed-batch=N` flag, with N set to 1, 2 or 3.
All 96 specialist-plan races validated, with no refusal or unpaid front-rider
kilometre. Every recorded break-role attack in the stage sets came from a
helper, while later one-day fallback attempts still included captains.
Initial fronts were fully caught in 21/24 fresh and 18/24 fatigued one-day
cases, versus 3/24 fresh and 1/24 fatigued stage cases. Mean maximum leads
were approximately 281, 266, 394 and 382 seconds in that order. These
figures are synthetic role-policy diagnostics, not target frequencies; the
remaining captain fallback and prolonged control chase need further work.
The paired goal audit was rerun after the specialist change, with identical
courses, rosters and all other team orders in each break/control pair. All
48 recordings across 24 pairs validated and replayed. In one-day cases the
selected break-goal team attempted 3.83 attacks and rode 246.75 front
rider-km on average; under a control goal it made zero attacks, chased for
143.17 team-km and had mean team energy 52.52 rather than 75.05 at km 200.
Stage cases had one break attempt and 256 front rider-km versus 169.42
control chase team-km, with km-200 energy 75.08 versus 51.94. The goal has
a paid, inspectable effect, but the control team still spends much of the
day chasing. In one flat fresh one-day control replay, three teams chase
around km 50–200 while the lead only falls from roughly 181 to 98 seconds;
the selected team's mean energy falls from about 98 to 51. A larger paid
coalition joins after km 210. This is evidence to revise the control
decision, not a licence to award a free catch or a predetermined gap.
The read-only `--control-tempo` counterfactual adds a standing `rotate`
front-work order to the selected control team, without changing its roster
or any other team's plan. This is deliberately outside the committed intent
planner. All 24 paired 260 km cases validated and replayed. In one-day races
the team chased for 127.75 km and paid bunch-front work for 132.17 km on
average, versus 143.17 km of chasing without the front-work order. Its mean
maximum lead fell from 177.79 to 111.65 seconds, but mean team energy at km
200 also fell from 52.52 to 42.90. Stage cases were similar: 169.42 chase
team-km without the order versus 132.67 chase and 127.33 front-work km with
it; maximum lead fell from 243.86 to 138.76 seconds while km-200 energy
fell from 51.94 to 45.31. One locked race had zero kilometres with both
actions charged to the same team. This buys road-clock control, but does not
solve the long-day energy problem: the team works in nearly every kilometre.
It should not become an automatic rival order based on this experiment.
The separate read-only `--all-control-tempo` audit gives every generated
control-role rival a committed `rotate` bunch-front order while retaining
its selective-chase order; it omits the rival-intent manifest because the
planner does not yet generate that combination. Across the same 24
20-team/260 km planned-intent cases, all recordings validate. Fresh
one-day controls pay a mean 117.33 bunch-front team-km and 171.83 early
chase team-km, versus zero front work and 315.83 early chase team-km under
the existing plan. Mean maximum lead is 367.56 versus 397.94 seconds and
control-team energy at km 210 is 49.83 versus 49.58. Fatigued one-day
cases pay 112.83 front and 188 early chase team-km, with energy 36.84
versus 35.25. Stage cases likewise replace about half the early chase
with paid rotating front work and slightly improve control energy, while
the original front still often survives. This is a plausible shared-work
direction, not a final plan: a collective control team still works through
much of the race, and no-control extreme role mixes remain implausible.
Reproduce with `node scripts/audit-race-dynamics-v94.mjs --planned-intent
--all-control-tempo --validate --summary` and compare the run without
`--all-control-tempo`.
An internal opt-in planner `controlTempoVersion: 2` now commits this
combination as rival intent manifest version 3. It records each team's
front-work choice along with its role and opening attack/chase/effort orders;
an explicit manager tactic keeps its own front-work order. The existing
manifest versions remain replayable. In 24 planned-intent 260 km cases, the
new manifest, every frame, and deterministic source replay validated. Fresh
one-day control roles paid a mean 128.17 bunch-front team-km and 144.5 early
chase team-km instead of zero and 315.83, with km-210 team energy 51.82
instead of 49.58. Mean maximum lead was 337.11 instead of 397.94 seconds;
five of six initial fronts were fully caught, versus six of six before.
Stage controls also divided work between front and chase with modestly
higher remaining energy, while the initial front usually still survived.
The same committed policy passed recording validation in 96 new-seed
20-team/260 km holdout cases without refusal or unpaid front work. The
initial front was fully caught in 22/24 fresh and 19/24 fatigued one-day
cases, versus 4/24 fresh and 2/24 fatigued stage cases. Mean maximum leads
were 189/185 seconds in the one-day groups and 265/264 seconds in the stage
groups; no lead target was assigned. Mean control-team energy at km 210 was
51.54/38.40 for fresh/fatigued one-day and 52.87/39.69 for stages. These
compare with the same holdout without committed control tempo: zero front
team-km, 389/409 early chase team-km in one-day races and 381/400 in stages,
with control energy 49.30/35.89 and 50.06/36.68 respectively. The new plan
used 168/162 paid front team-km and 155/180 early chase team-km in one-day
cases, or 171/164 front and 136/162 chase in stage cases. Front and chase
never charge the same team in one kilometre. The pacing reduces maximum
leads and some early break opportunities; it may begin front work too early.
These are synthetic role-policy cases, not an empirical race frequency or a
player-facing release. The guided full-race flow is still needed.
An uncommitted follow-up withheld generated control front-work until the
same leading roster had five prior recorded kilometres with no closing.
Across 24 paired planned-intent races it raised mean maximum lead only
8–10 seconds, reduced the control team's km-210 energy by about one unit,
and increased one-day initial-front catches from five to six of six in
both fatigue groups. The extra rule did not solve premature control work;
it was reverted. Explicit manager front-work orders were never changed.
The read-only audit now counts when a generated control team first pays
bunch-front work. In the original 24-case planned set it starts at km 1,
but only 2.67 control-team kilometres on average precede the first front
group. Most paid control tempo occurs after a move has formed; delaying it
until formation alone cannot address the sustained-work problem.
The same 24-case audit finds zero captains in the first front group, but
by km 100 the leading group accumulates mean 108 captain-rider-km in
one-day races and 216 in stages. Every such early captain belongs to a
generated opportunistic team; no control team chases a captain-free front
through km 100 in these cases. A blanket "accept a helper-only break"
rule would not alter this pursuit. Any composition-aware decision must
consider opportunistic intent and the paid later join, while preserving
explicit named attacks.
An internal opt-in `opportunisticSpecialistVersion: 2` now lets generated
and declared opportunistic rivals nominate a noncaptain specialist for
their automatic opening moves. The manifest is version 4, binds that
nomination to the committed roster, and leaves explicitly managed and
named attacks unchanged. Older manifests retain their original attacker
choice. In 24 paired planned-intent 260 km races with committed control
tempo, the early opportunistic captain exposure falls to zero. Their mean
captain energy at km 210 rises from 75.45/63.39 to 84.80/72.80 in
fresh/tired one-day races, and from 66.65/54.61 to 84.62/72.62 in stages.
The same-model replay passes. A further 96 new-seed cases pass recording
validation without refusal; initial-front catch counts and maximum leads
move only slightly, so this is a captain-reserve and intent correction,
not a solution to control workload or a player-facing calibration.
Combining the opt-in control pursuit, paid one-worker settled rotation,
front-exhaustion contact, control tempo, and opportunistic specialist
policies passed validation and same-model replay in 24 original cases.
The original seeds averaged maximum leads of 295/283 seconds in
fresh/tired one-day races and 391/386 seconds in stages. But 96 new-seed
holdout cases also validated and averaged only 141/136 seconds one-day
and 213/210 seconds stage; initial fronts were fully caught 22/24 and
18/24 one-day versus 1/24 and 0/24 stage. The variability is material.
No target gap was imposed, and this bundle still needs broader role and
guided-flow checks before players can rely on it.
A second, rejected v94-only control-decision experiment projected whether
the available control teams together could close a stable front after the
current route's passive break advantage. It changed only when selective
controls would start chasing; all road gains still had to be paid. The
same 24 paired cases completed validation, but one-day control chase rose
from 143.17 to 175.25 team-km, km-200 energy fell from 52.52 to 47.52,
and mean maximum lead rose from 177.79 to 290.20 seconds. Stage chase was
166.75 versus 169.42 team-km, with little energy benefit and a larger
mean maximum lead (279.36 versus 243.86 seconds). The candidate motor,
planner and audit changes were reverted. Coalition capacity by itself is
not a sufficient trigger for a sustainable control strategy; it misses the
cost of sustaining the chase after it starts.
An optional v94-only, versioned intent manifest can now be committed to the
race recording. It retains each team's role, opening order and whether the
planner labelled it generated, manager-goal or explicit-manager input.
Validation rejects a manifest that disagrees with the committed roles or
orders; deterministic source replay retains the same manifest. The label is
declared provenance inside this internal workbench, not proof of a user's
identity or a public revelation of rival strategy before the race.

The `--planned-intent --summary --validate` audit over the same three seeds,
flat/mountain routes, fatigue 0/30 and one-day/stage formats generated a mean
four break teams and 2.33 control teams per race. All 24 complete recordings
passed the v94 consistency validator. But only 2/6 original fronts were
fully caught in fresh one-day races, 2/6 in fatigued one-day races, and 0/6
in either stage-race fatigue set. Mean maximum leads were approximately 499,
490, 580 and 574 seconds respectively. The roles yield a sustained break,
yet the fresh one-day pursuit remains too weak for the intended experience.
Do not route this planner to players or tune it from one seed; next audits
must vary seeds and team goals and inspect actual paid pursuit and energy.

An additional v94-only pursuit experiment asks whether the *eligible
protective teams together* could close a stable leading gap if they committed
their available helpers. That projection can advance their decision to chase;
it never changes the gap directly. The observed same-front trend and an unsafe
gap are still required before the last 50 km. In the 24 planned-intent cases,
the original front is now fully caught in 4/6 fresh and 3/6 fatigued one-day
races, against 0/6 in either stage set. Mean maximum leads are 439, 420, 580
and 574 seconds respectively. Early protective pursuit costs a mean 201 and
238 team-km in the two one-day sets, versus zero in stages. A 24-case sample
of the existing guided random rival policy gives 1/6 fresh and 0/6 fatigued
one-day original fronts fully caught, with mean maximum leads of 231 and 302
seconds. The full 96-case constructed role matrix passes validation without
refusal; its original front is fully caught in 24/24 fresh and 21/24 fatigued
one-day races, versus 3/24 and 0/24 in stages. These are synthetic policy
checks, not empirical frequencies or proof that the chase is calibrated.

A separate `--extended-seeds` holdout uses twelve new seeds, two terrains,
two starting-fatigue levels and both formats, with no parameter changes after
seeing the earlier three-seed matrix. Each row below contains 24 validated
260 km simulations:

| Rival intent | Format | Fatigue | Original front fully caught | Mean maximum lead |
| --- | --- | ---: | ---: | ---: |
| Committed synthetic plan | One-day | 0 | 16/24 | 323 s |
| Committed synthetic plan | One-day | 30 | 13/24 | 308 s |
| Committed synthetic plan | Stage | 0 | 3/24 | 453 s |
| Committed synthetic plan | Stage | 30 | 0/24 | 449 s |
| Sampled guided random orders | One-day | 0 | 6/24 | 207 s |
| Sampled guided random orders | One-day | 30 | 4/24 | 226 s |
| Sampled guided random orders | Stage | 0 | 3/24 | 427 s |
| Sampled guided random orders | Stage | 30 | 4/24 | 476 s |

No run in this holdout refused or failed the current recording validator.
The sampled guided policy has about nine break-role teams, versus 5.67 in
the committed synthetic plan, so the formats are not a controlled comparison
between those rows. The fresh one-day catch remains uncommon under guided
random orders even though its maximum gap is smaller. Opponent intent, team
composition and the race clock still need end-to-end work before v94 can be
offered to players.

v94 recordings now keep a separately versioned copy of their original stage
and locked weather input. The internal `replayRaceDynamicsRecording` check
validates the recorded ledger, re-runs the race from those committed inputs,
and compares the route, every kilometre frame and provisional finish. A
changed stage source or an unaccounted frame value is refused. The original
24 planned-intent simulations passed this deterministic source replay. It
uses the same motor implementation, so it checks repeatability and recording
integrity rather than providing independent evidence that the sporting model
or contact handling is correct. Older recording shapes remain unchanged.
The simulator-free recording validator also rebuilds the v94 route from its
committed stage, weather and seed, and refuses a source that disagrees with
the recorded route before the more expensive source replay begins.

### Why a later chase decision alone is insufficient

The reproducible `node scripts/audit-v94-manager-goal.mjs --single --timeline`
case fixes the same 20-team, flat, fresh one-day field and gives `rival-1` a
declared control goal. Three control teams are already paying chase work from
km 50 through km 200. The recorded leading gap falls from 180.72 to 98.30
seconds, but the selected team's mean energy falls from 97.84 to 51.01.
At km 50 the frame records 150.85 chase-capacity units and a 2.91-second
passive gap gain; by km 200 these are 83.35 units and 1.91 seconds,
respectively. These
are paid frame values, not an inferred wheel trace or a claim that any one
team caused the change. The 0/1-control stress audit also shows that simply
postponing all work can let a front reach a mean maximum gap of many minutes
beyond the intended race experience.

The remaining design problem is to make an accepted break and the peloton's
maintenance pace economical for the riders doing the work, while preserving
a later coalition's ability to close on a fresh one-day field. A selective
control policy should be evaluated together with the resulting road clock,
helper energy, stable group membership and final catch, across seeds and
roles. Re-labelling a chase as rest, adding a free gap adjustment, or using
a fixed desired breakaway lead would not meet that test. Any new policy must
be separately committed/versioned so existing v94 recordings replay exactly.

### Opt-in front rotation experiment

The separately committed internal `raceContext.frontObservationVersion: 2`
compares the leading group's rider **membership** across completed frames,
regardless of incidental array order. A reordered roster is not evidence of
an occupied-wheel change or a new break. Duplicate or changed rider IDs still
invalidate the five-kilometre observation. Omission retains version 1 so
earlier v94 recordings replay under their original rule. The recording
validator derives the observation with the committed version before using it
for pursuit or settled-front decisions; no gap is awarded by this change.

`raceContext.frontRotationVersion: 2` is an internal, separately committed
experiment. Omission still means version 1 and replays earlier v94 recordings
unchanged. After five observed kilometres with the same leading group, no
measured closing and no prior chase, cooperative riders can all sit on for
one kilometre; an active but non-closing chase leaves one rotating maintenance
worker. A measured closing gap restores all willing workers. A declared
`drive` rider never rests. The road-group pace and every rider's energy are
then recalculated from this actual worker roster; the policy does not assign
a gap or a catch. It is available only through explicit internal inputs and
the `--front-rotation-v2` audit flag, not the guided Motor Lab.

In 24 same-source manager-goal pairs with validation and deterministic replay,
one-day control chase fell from 143.17 to 137.17 team-km, its mean energy at
km 200 rose from 52.52 to 54.63 and the mean maximum lead fell from 177.79
to 166.28 seconds. The stage control case moved the other way: chase rose
from 169.42 to 183.92 team-km and km-200 energy fell from 51.94 to 49.81.
The original break-goal team's maximum lead fell in both formats. This is not
a general control solution.

Across 96 *new-seed* planned-intent cases, all recordings validated with no
unpaid front rider-kilometres. The initial front was fully caught in 21/24
fresh and 17/24 tired one-day cases, compared with 3/24 fresh and 4/24 tired
stage cases. Mean maximum gaps were approximately 227, 210, 322 and 304
seconds respectively. These are synthetic role mixes, not measured cycling
frequencies. The 72-case 0/1/8-control stress audit also validated without
refusal, but no-control mean maximum gaps remained 625 seconds one-day and
909 seconds stage; one-control one-day cases caught the initial front 12/12.
The extreme mixes are not yet credible enough for player-facing defaults.
No whole-race result, occupied-wheel order or official award follows from
this bounded motor experiment.

The further opt-in `frontRotationVersion: 3` keeps one cooperative rider on
the front even when no one chased in the prior kilometre. Version 2 can have
zero cooperative pullers, which is a poor maintenance model on a flat road;
versions 1 and 2 remain available for exact replay. The selected worker pays
the same road-group exposure and the gap is recalculated from that roster.
All 32 new-seed planned-intent cases in seed batch 1 validated without refusal
or unpaid front rider-kilometres. Versus version 2 in that *same batch*, mean
maximum gaps rose from 213/196 to 227/210 seconds for fresh/tired one-day
races, and from 325/303 to 339/321 seconds for fresh/tired stages. Initial
front catch counts remained 7/8, 5/8, 0/8 and 0/8 respectively. Control-team
energy at the finale start fell by about 2.6–3.2 units. Keeping a paid puller
improves the physical accounting but does not fix prolonged control chasing
or establish a suitable player-facing race model. Reproduce with
`node scripts/audit-race-dynamics-v94.mjs --planned-intent --validate --summary --extended-seeds --seed-batch=1 --front-rotation-v3`.

A further 72-case 0/1/8-control-team stress audit for version 3 validated
without refusal. It also exposed the remaining range: with no declared
control team, mean maximum leads were 804 seconds one-day and 1,086 seconds
stage; with one, 359 and 515 seconds; with eight, 174 and 226 seconds. These
are constructed role extremes. Requiring a paid pull alone cannot choose a
credible opposing-team composition or sustain an economical pursuit.

A read-only pursuit-timing counterfactual imposes a 100 km tactical marker
on **all** synthetic control teams while leaving the same teams, riders,
route and declared manager goal in each paired case. They pay no selective
chase until km 101, then use the ordinary v94 chase and energy rules. Across
the original 24 pairs, all 48 recordings validate; there are no refusals.
One-day control-goal cases average a maximum recorded lead of 462.5 seconds,
150 paid chase team-kilometres for the selected team, mean selected-team
energy 56.96 at km 200 and 1.08 riders still ahead at the line. The
corresponding stage cases average a 458.58-second maximum lead, 158.33
selected-team chase kilometres, energy 56.77 and 6.83 riders still ahead.
This is evidence that the existing *paid* road and energy clocks can produce
a substantial lead and a materially different finish when pursuit timing
changes. It is **not** a proposed km-100 rule or a calibrated 5–8 minute
target: the audit chooses the marker by hand, omits the generated intent
manifest for the counterfactual order and does not show that a team could
make that decision from information available during the race. Reproduce
with `node scripts/audit-v94-manager-goal.mjs --delay-controls-to=100`.

A separate **rejected** opt-in control-policy experiment used only paid
observations: after a stable front failed to close during a recent chase,
one-day control teams paused their selective chase while any paid pursuit
remained in the previous five recorded kilometres. Across 96 new-seed paired
cases, all recordings validated and none refused. In the 48 one-day
control-goal races, the selected team averaged 98.35 paid chase kilometres,
71.18 mean energy at km 200, a 568.58-second maximum lead and 0.88 riders
still ahead at the line. The stage races were unchanged by the one-day guard.
But the locked flat one-day decision trace revealed a repeated **one km
chase, five km pause** cycle from km 42 into the middle of the race. That
rhythm is an artefact of the five-kilometre lookback, not a credible tactical
choice. The motor, context, validator and test changes were reverted; these
figures are negative design evidence only. The next pursuit policy must
avoid a clock-driven retry cycle and explain how teams judge the cost and
effect of collective, paid work from information available during the race.

An **internal, separately committed** `controlPursuitVersion: 2` tests a
different decision. A selective control team estimates possible help from
other committed control teams using the square root of their squared current
helper capacities. This discounts uncertain cooperation as more teams are
counted; it is a decision heuristic, **not** measured sporting behaviour.
The estimate never changes the road clock or energy. A team begins work only
when the estimated catch approaches the race distance remaining; after it
begins, it needs a substantially safer estimate before resting. These two
distance margins prevent a fixed observation-window retry. An explicit
manager order, GC response or fresh attack retains its existing precedence.
Omitted version 1 preserves all earlier v94 recordings.

The 96-case new-seed planned-intent holdout validates with no refusal or
unpaid front rider-kilometres. The initial front is fully caught in 22/24
fresh and 19/24 tired one-day races, versus 2/24 fresh and 1/24 tired stages.
Mean maximum leads are 409/386 seconds one-day and 509/489 seconds stage;
these are synthetic outcomes, not a target gap. In a separate 72-case
0/1/8-control stress audit, mean maximum leads are 820/447/447 seconds
one-day and 1,077/574/506 seconds stage. All 72 validate without refusal
or unpaid front work; the no-control case remains implausibly wide.
The 24 original paired manager-goal cases validate: the selected control
team averages 166 paid chase kilometres one-day and stage, with 3.5 and
1.58 chase episodes respectively. A locked one-day trace shows continuous
paid work after its first start at km 75, with no five-kilometre pause cycle.
The policy still asks a control team to work much of the day and is not a
complete pursuit solution. Combining it with `frontRotationVersion: 3` in
the first 32 new-seed planned races also validates without refusal: maximum
lead means are 347/323 seconds one-day and 454/429 seconds stage, with
initial fronts fully caught in 7/8, 5/8, 0/8 and 0/8 cases respectively.
The prior rotation versions remain distinct.

Sampling the **current guided random rival orders** exposes a remaining
integration problem: in the first 32 new-seed cases, those orders create
about eight to nine break-role teams and can leave control helpers depleted
well before the finale (mean control-team energy at the finale start is about
10 fresh and 7 tired). Every recording validates, but
changing the pursuit decision alone would not make those rival plans
credible. Reproduce with `node scripts/audit-race-dynamics-v94.mjs
--planned-intent --extended-seeds --collective-control --validate --summary`,
`--stress --collective-control --validate --summary`, or
`--guided-random --extended-seeds --seed-batch=1 --collective-control
--validate --summary`. This version remains internal and is not routed to
Motor Lab; team intent, front exhaustion and full end-to-end behaviour still
need resolution.

### Rival intent alone does not repair the live race

`node scripts/audit-v91-rival-intent-counterfactual.mjs` applies two
pre-race rival plans to the *same live kilometre motor*: the guided random
orders and the internal v94 intent planner's baseline orders. It holds the
three seeds, flat/mountain route, fresh/tired field, 20 teams and 260 km
constant across 12 pairs. The internal motor version and its dynamics are
not used in either run. The current random plan produces 51–312 attack
attempts, and the planner's orders produce 150–295; neither produces a
recorded lead of even 60 seconds in any of the 12 races. In several planned
cases, no front group establishes a positive lead at all. The planned
orders are synthetic and sometimes have as many break-role teams as the
random orders on these particular seeds.

This counterfactual rules out simply switching the guided default to the
internal intent planner as a solution for sustained modern breaks. A player
facing change needs both a credible, inspectable opponent plan and a motor
that pays an accepted break, energy and eventual pursuit over the full
field. It must retain explicit manager orders and be tested end to end before
routing a new recording version to the viewer.

### Paid solo-front exhaustion experiment

The internal opt-in `raceContext.frontExhaustionVersion: 2` preflights a
single rider in the only road group before moving it. If that rider is not
pulling and cannot fund the ordered kilometre, the unpaid fraction reduces
that solo group's road lead through the existing coast-speed formula. The
recording names the rider, group and paid delay; energy is capped at the
available reserve. If the solo rider falls behind the bunch in the same
kilometre, the remaining delay becomes their recorded deficit. A locked hard,
fatigued mountain case now pays 21.849, 51.767 and 51.781 seconds of solo
delay on kilometres 136–138 and is caught and dropped at kilometre 138 instead of
publishing unsupported front movement. The complete 260 km recording passes
the simulator-free validator and deterministic source replay. Omitted
version 1 still refuses at kilometre 136, preserving older recordings.

Version 2 is deliberately narrow. An exhausted puller or a rider in a shared
group still refuses before road movement because that version cannot
determine an independently paid change of pull roster and group contact.
The ordinary planned-intent audit may show zero such solo coast events; it
does not establish their frequency in real racing or solve opponent intent
and pursuit. Reproduce with `node scripts/audit-race-dynamics-v94.mjs
--planned-intent --validate --summary --front-exhaustion-v2`.

The separate internal `frontExhaustionVersion: 3` covers one bounded shared
case: an exhausted non-puller leaves a two-rider leading group whose other
rider is actually taking a paid pull. The worker keeps the group's paid road
clock. The sitter's coast delay places them in a named chasing group behind
that worker or, if the bunch reaches them, records a catch and any residual
drop. Subsequent solo coast is paid against that rider's own road clock.
In the locked 260 km hard mountain case the pair separates at kilometre 139;
the worker remains ahead while the sitter is caught and dropped at kilometre
146. The full recording validates and replays, including an independent
check of the detached group's relative gap. This does not support exhausted
active pullers, larger shared groups, contested same-kilometre attacks or
shared-front exhaustion during the final 50 km. Those cases still refuse before
road movement. Omitted version 1 and opt-in version 2 retain their recorded
behavior. Reproduce with `node scripts/audit-race-dynamics-v94.mjs
--planned-intent --validate --summary --front-exhaustion-v3`.

The separate internal `frontExhaustionVersion: 4` extends that paid transition
to one exhausted non-pulling sitter in a larger front group with another
actually paid puller. If a chasing road group is already present, the sitter's
delay either creates a named group between them, contacts that group, or
records a bunch catch and residual drop. A solo rider in the rear or middle
of up to three road groups can also pay a coast delay against its own clock.
Only one shared detachment is permitted per kilometre; exhausted active
pullers, simultaneous unsupported separations and more complex road-group
arrangements still refuse without publishing a frame. Earlier versions retain their
recorded behavior. In 32 long 20-team boundary runs spanning format,
terrain, fatigue and four own opening orders, all 32 recordings validated and
source-replayed. Under version 3, four extreme hard/repeated/all cases refused
before movement. The version 4 audit shows paid coast in those cases, including
contact with an existing chase group and a middle-group solo coast. This is
evidence of bounded accounting, not race calibration or a guided release.
The separate experimental whole-race preview now uses version 4 by default,
while the normal guided race stays on its earlier motor. It names paid coast
delays and recorded group contact at each affected kilometre, without
publishing official standings. In a further 48 new-seed 20-team, 260 km
preview-boundary races, all version 4 recordings validated and source-replayed
without refusal; batch mean widest leads were 97.15, 165.36 and 115.84 seconds
(126.11 across all 48), effectively the earlier preview boundary mean. Reproduce
with `node scripts/audit-v94-preview-orders.mjs --front-exhaustion-v4` and
`node scripts/audit-v94-preview-boundary.mjs --batch=1 --front-exhaustion-v4`
(repeat batches 2 and 3).

A cross-boundary audit combined two new seeds, both formats, flat/fatigued
mountain routes, calm or hard/repeated own orders, and 0/1/8 committed control
teams: `node scripts/audit-v94-preview-cross-boundary.mjs`. An initial run
refused five of 48 whole recordings at kilometre 226. The pre-movement coast
used the exact work demand, while the energy ledger stores that demand to six
decimals; this particular valid 18.624-second coast recalculated as 18.623
seconds from the rounded ledger. The version-4 validator now checks only
three-decimal coast times attainable within the ledger's six-decimal rounding
interval. A forged time outside that interval still fails, and full source
replay still compares the exact frame. Older coast policies retain their
previous comparison. All 48 cross-boundary recordings now validate and
source-replay, with zero refusals; ten hard-order cases record paid coast.
This fixes a recording precision mismatch, not the extreme role mix: no
control teams still produced mean maximum leads near 910–918 seconds in
these synthetic races.

The same audit with `--alternate-routes` holds the seeds, formats, explicit
role mixes and own orders while using women's fields on rolling (fatigue 15)
and exposed (fatigue 30) routes. All 48 additional 20-team, 260 km recordings
validate and source-replay without refusal; 18 hard/repeated cases contain a
paid coast. Mean widest leads for 0/1/8 control teams were 906/142/85 seconds
with calm own orders and 909/290/217 seconds with hard repeated own orders.
This broadens the accounting boundary and again exposes strong role-mix
sensitivity. It does not establish typical race frequencies or a target gap.

### Gate before a player-facing race-dynamics version

- Commit an inspectable pre-race goal and order for every team. Preserve any
  explicit manager tactic exactly. Audit the generated rival mix alongside
  the orders the guided viewer actually uses; the present guided random mix
  creates too many break-role teams and can exhaust controls before the
  finale.
- Pay every rider's work, recovery, movement and group contact through the
  same race. An exhausted front rider must either receive a paid slowdown
  and contact transition or cause an explicit refusal before a frame is
  published. A late energy correction to an already moved group is invalid.
- Demonstrate that an accepted break, economical maintenance and a later
  chase arise from recorded team decisions and road work across varied
  seeds, routes, fatigue and opponent roles. Inspect both lead and helper
  energy, the start and duration of pursuit, catches and survivors. Neither
  a fixed chase kilometre nor a prescribed five-to-eight-minute gap passes
  this gate.
- Validate and replay the complete recording, then run the guided tactics
  through viewer and conditional result in a browser. Commentary may name
  only recorded actions and measured changes. Keep official places, points
  and awards withheld until their separate finish contracts are satisfied.

The current v94 experiments satisfy parts of the recording and paid-work
checks but not this whole gate. Until they do, the live guided Motor Lab
continues to use its existing kilometre motor.

A read-only eight-case compatibility probe tried to feed complete v94
recordings into the current v93 individual finish path (4 and 20 teams,
flat and mountain routes, one-day and stage formats). All eight refused:
the single-group and coasted last-kilometre clocks explicitly require a
v93 source; the remaining separated stage case lacked a recorded
last-kilometre response or front rotation. The temporary adapter was
fully reverted. A player-facing v94 race therefore needs its own paid
finish handoff and validator, not a version label change or a v93 finale
attached to the new road clock.

### Isolated experimental whole-race preview

`createV94RaceDynamicsPreview` runs the committed v94 policies behind a
separate Motor Lab page and API mode. It validates the full recording and
replays the same committed source before returning each kilometre's road
groups, rider reserves, paid workers and chase. The page exposes every team's
committed opening goal and orders. The player can give any fictional rival
an explicit break, control, protect or opportunistic goal for that preview;
each chosen goal commits matching opening orders, while unchosen rivals keep
their seeded plans. The preview rejects unlisted tactic inputs rather than
silently relabeling a manager order. It reports only measured group gaps and a
conditional group ending; it provides no individual classification, points
or awards. A responsive gap timeline plots only the recorded leading-group
time gap at each kilometre, with the one-minute line and inspected kilometre
marked; it does not imply mapped distance. The existing guided race keeps
its older motor and result path.

`node scripts/audit-v94-preview-boundary.mjs --batch=1` (then batches 2
and 3) exercises twelve new seeds across one-day/stage and flat/fatigued
mountain 20-team, 260 km races. All 48 recordings validated and replayed
without refusal. Widest measured lead ranged from 35.59 to 392.61 seconds;
the range is large and is **not** a calibrated distribution. The page's
unchanged default seed gave a 93.78-second widest lead and no front group
at the last kilometre. Other seeds can yield much shorter or longer leads.
This boundary check supports a truthful experimental preview, not promotion
of v94 to guided races or a claim that the race-dynamics goal is solved.

After correcting the manager's direct selective-chase role, those same 48
cases still all validate and source-replay. Their widest leads now span
35.22–307.24 seconds, with a 115.54-second mean instead of the earlier
126.11-second mean. This is a changed manager policy on the same synthetic
inputs, not evidence of an empirical improvement. The separately committed
old protective-manager recordings remain replayable.

The same audit now prints generated role counts, each control team's paid
chase and bunch-front kilometres, and mean control-rider energy at km 210.
The seed with the largest lead in this set (`preview-boundary-6`, fatigued
mountain stage) committed nine break roles and one control. Its control team
paid 151 chase kilometres and 81 bunch-front kilometres in the matching
one-day run, with mean reserve 28.73 at km 210; the mountain stage paid 144
and 93 kilometres, with reserve 30.13. Conversely, `preview-boundary-4`
had only one control but a maximum one-day lead near 36 seconds, despite
four break and five opportunistic roles. Role count alone does not explain
the road. One generated control can work through almost the entire race;
the model still needs a credible way to accept a break and preserve helpers
for later pursuit without an imposed chase kilometre or free movement.

A separate same-source role-composition boundary deliberately overrides all
19 fictional rival goals while preserving the route, roster, seed and own
orders. Across two seeds, both formats and flat/fatigued mountain terrain,
all 24 whole races validated and source-replayed. With 0/1/8 declared
control teams, mean widest one-day leads were 766.78/116.04/66.35 seconds;
stage means were 1013.65/194.56/99.35 seconds. One control team paid about
88–92 chase team-km plus 164–167 front team-km, reaching mean rider reserve
near 44 at km 210. With eight controls the paid work was shared and mean
reserve was near 56. These intentionally extreme synthetic goals show why
one fixed gap or a hidden role mix cannot define credible races; they are
not empirical race frequencies. Reproduce with
`node scripts/audit-v94-preview-role-mix.mjs`.

### Opt-in impossible-pursuit withdrawal audit

The `preview-boundary-6` fatigued mountain stage exposed a specific control
decision error: its only control team chased for 144 recorded kilometres even
though its projected catch was impossible before the line on every one of
those kilometres. During km 100–200 it chased continuously while the observed
gap grew and the team's mean reserve fell. The prior selective rule treated a
null catch projection as a reason to keep chasing.

Committed `controlWithdrawalVersion:2` lets a selective control team withhold
work when that same leading group is measurably nonclosing, its projected
catch remains impossible, and there is no fresh attack. The decision uses
current paid helper capacity and recorded gap; a new attack or improved
collective prospect can resume paid pursuit. A named per-kilometre withdrawal
roster binds the recording and validator. Omitted/version 1 inputs and older
recordings retain their previous behavior. The experimental preview exposes
it only as an optional comparison; the guided race does not use it.

The locked stage case shifts from 144 paid chase kilometres to three under
the current fresh-attack guard, while the selected team's km-210 reserve rises
from 30.13 to about 58. The widest gap also grows, about 393 to 813 seconds.
In a matching one-day case the team resumes chase when other paid pursuit
appears. Across 96 new-seed planned-intent cases, all recordings validated
without refusal: mean widest leads rose from about 141/136 to 176/178 seconds
in fresh/tired one-day races and from 213/210 to 335/339 seconds in stages;
mean control reserve at finale start rose by roughly 3–7 points. A separate
72-case 0/1/8-control stress also validated, but no-control races still show
implausibly large gaps. These are synthetic checks, not empirical frequency
or evidence that the player-facing release gate is met.

`node scripts/audit-v94-withdrawal-road.mjs` checks the recorded road-clock
consequence for the locked seed. From km 100 through 200, the stage control
previously paid chase on all 101 kilometres with no bunch easing; under
withdrawal it paid no chase, sat in for all 101 kilometres, and all 101
recorded kilometre frames carried the committed bunch easing. Mean passive
gap change rose from 1.60 to 4.41 seconds per kilometre while team reserve
at km 200 rose from 33.40 to 57.28. The observed lead at km 200 changed
from 248.86 to 625.76 seconds. The validator and source replay check those
paid work, energy, easing and gap fields, but this large single-case effect
requires broader sporting calibration before any preview routing.

The separate experimental preview therefore keeps its prior pursuit as the
default and offers withdrawal only as an explicit comparison choice. Its
response commits the chosen policy, validates and replays the full race,
and continues to withhold official results. The guided race is unaffected.

The optional choice also passed the same 48 preview-boundary races (twelve
new seeds, both formats, flat/fatigued mountain), with no refusal and full
source replay. Against those exact seeds, mean widest lead changed from
102.61 to 165.93 seconds in one-day races and from 149.62 to 321.24 seconds
in stages. Mean control-team paid chase fell from 129.00 to 106.08 team-km
one-day and from 175.08 to 5.04 stage; paid control bunch-front work stayed
near 200 and 191 team-km respectively. Mean control-rider reserve at km 210
rose from 49.67 to 55.20 one-day and 50.73 to 59.19 stage. These are
same-source synthetic comparisons, not evidence that the changed pursuit
timing or final lead is calibrated.

An attempted chase-only withdrawal variant allowed a control team to retain
its committed paid `frontWork:'rotate'` order when withholding a futile
selective chase. In the locked `preview-boundary-6` fatigued mountain stage,
the widest lead fell from 810.36 seconds under full withdrawal to 488.77,
but the sole control team paid bunch-front work on 259 of 260 kilometres
and chased once. Its mean reserve at km 210 was 43.94. This replaces one
near-continuous job with another, so the variant was rejected and its motor,
validator and API changes were reverted. It is not a preview option.

### Explicit own-team bunch-front work

The experimental preview now accepts a separate, explicit standing
`ownFrontWork:'rotate'` order. It is committed to the user's opening plan,
validated and source-replayed; leaving the choice at `none` preserves prior
preview behavior. The UI reports each team's actual paid chase and
bunch-front kilometres through the selected race kilometre, rather than
implying that the order itself guarantees a road-clock benefit.

`node scripts/audit-v94-own-front-work.mjs` compares both choices on the
same three seeds, two formats, and flat/fatigued mountain 20-team, 260 km
races with the user's attack and chase orders held at none/ignore. All 24
recordings validated and replayed. The standing order paid a mean 123
one-day or 124 stage bunch-front team-km, with mean own-team reserve at
km 210 falling from 78.25 to 54.04/54.26. Mean widest one-day lead stayed
near 130 seconds; stage lead moved from 171.33 to 156.60 seconds. These
selected synthetic cases show that taking a paid turn can move work onto
the user's helpers without proportionate benefit when other teams already
pace or chase. They do not establish a general effect or a calibrated race.

### Additional preview holdout

`node scripts/audit-v94-preview-boundary.mjs --batch=4
--front-exhaustion-v4` adds four previously unused seeds across both race
formats and flat/fatigued mountain routes. All 16 whole-race recordings
validated and source-replayed without refusal. With the preview's default
pursuit, the widest recorded leads ranged from 80.51 to 227.15 seconds
(mean 165.58). In one seed with six break-role and five control-role teams,
the one-day race spent 191 recorded kilometres above a one-minute lead,
while its widest lead was only 212.21 seconds. The paired stage spent 239
kilometres above one minute and peaked at 227.15 seconds. A persistent
small lead is therefore possible in this synthetic goal mix; it is not
evidence that the overall lead size or pursuit is empirically calibrated.

On the identical 16 sources, explicitly enabling
`--withdrawal-v2` also validated and source-replayed every race. The widest
lead range became 80.51–584.27 seconds (mean 317.45, versus 165.58 under
the default policy). In two stage seeds the control coalition paid only
four or ten chase team-kilometres and recorded roughly 488–584 seconds of
maximum lead. This optional rule saves pursuit work but can leave a long
stage break largely unchallenged. It remains an experimental comparison,
not a new default or a prescribed lead target.

### Paid front-rotation comparison for the Motor Lab preview

`node scripts/audit-v94-front-rotation-choice.mjs` compares the same four
seeds, two formats and flat/fatigued mountain 20-team, 260 km races under
two already versioned front-work policies. Each of the 32 complete
recordings validates and source-replays. Active rotation (version 1) pays
more cooperative front-rider turns and reaches a measured one-minute lead
in all 16 paired scenarios; economy rotation (version 3, the previous
preview default) does so in 11. For `sample-flat-finish` on a fatigued
mountain one-day route, the active policy pays 1,296 front rider-km,
reaches 126.85 seconds and is caught by the line; economy pays 672 and
peaks at 39.2 seconds. The extra lead is an outcome of the paid roster
and road clock, not a target assigned to the group. These synthetic pairs
do not calibrate either policy to real racing. Active rotation is now the
single policy in the experimental preview; the comparison remains
read-only, while the guided motor and saved results remain unchanged.

### Guided Plan & Race route orders

The guided Motor Lab now uses the recorded route profile as the tactic
timeline. A 5 km slider selects where a change begins; any number of
effort, chase or bunch-front-work changes may be placed on that route.
`managerTacticalOrdersV5` commits those changes as explicit phase orders,
while older V2–V4 inputs and recordings retain their own parsers.
The guided starting attack order is `none`. A user-selected break window
commits `selective` at its start and `none` at its end; V5 rejects an
unclosed, repeated or overlapping attack interval. Selective attempts
are only considered at the motor's 20 km cadence and route keypoints,
subject to rider position and available energy. The UI offers windows
that contain at least one 20 km opportunity. No attack or gap is
guaranteed. The separate experimental v94 race-dynamics preview is
unchanged.

### Current guided v93 gap diagnostic

`node scripts/audit-v93-guided-gap-mechanics.mjs` replays twelve seeded
20-team, 260 km guided-style rival draws on the paid v93 road across flat
and mountain terrain and fresh/tired starts. Every recording validates.
There are 51–312 attack attempts per race and zero recorded kilometres
with a lead of at least one minute; the widest leads range from 8.95 to
45.07 seconds. Ten of the twelve races include many short-lived front
runs. Even the fatigued mountain case with no rival on an `all` chase
order records 348 total chasing team-km from other orders, a mean 1.38
chasing teams during front kilometres, and a widest lead of 43.91
seconds across 219 continuous front kilometres. Thus a draw with no
`all` chase team does not mean the bunch is resting. The current
selective-chase work and small paid relative-pace gain warrant a systemic
review. These cases are synthetic diagnostics, not an empirical
one-minute target or a reason to multiply a road gap after the fact.
The same-source diagnostic with **all** chase orders changed to `ignore`
records widest leads of 322.41–460.95 seconds and 209–237 kilometres
at or above one minute in each race. That artificial all-passive field
is not a proposed default: it isolates the active chase decision as a
major cause of the short current leads. In the ordinary guided draw,
paid chase also targets captain-free road groups (0–529
team-km across the twelve runs), while other front groups contain
captains. A rule that merely ignores helper-only fronts would therefore
leave much of the measured suppression untouched.
Separating the actually paid chase team-kilometres during front-group
kilometres by the teams' committed baseline orders shows why a planner
change alone is insufficient: `selective` orders account for 21–889
team-km per race, versus 0–206 from `all`. In the locked fatigued
mountain case with no `all` chaser, selective teams still pay 332
team-km while a front exists. The audit classifies the recorded chase
roster rather than counting orders as work; the numbers do not imply
that all selective chases are mistaken. A candidate must change the
decision to spend energy in response to the observed front and preserve
direct manager, GC and emergency responses.
The recorded reason labels split those 4,170 selective chase team-km
into 1,078 against a fresh attack and 3,092 after the existing gap
exceeded the current safe guard. None of these twelve synthetic inputs
had a GC or road-captain response. The established-gap branch dominates
the work, so changing only the first-kilometre attack reaction cannot
resolve the observed short leads. This labels the paid decisions; it
does not prove which individual chase kilometre changed the outcome.

The road-scale comparison is also material. In the locked fresh flat
`sample-flat-finish` run, the front gains a mean 0.45 seconds per kilometre
from its recorded passive pace while the actually paid chasers have mean
capacity 303.45 during front kilometres. The v93 chase conversion of
0.025 seconds per capacity point gives those workers a potential 7.59
seconds of closing per kilometre, subject to the available gap. This is
an order-of-magnitude difference between the model's normal front gain
and paid coalition closing, not evidence that the front should receive
an artificial time credit. The separate v94 road uses a larger ability
to seconds conversion and can produce multi-minute leads on the same
kind of generated rival draw, but its sampled controls can finish with
very little reserve. A successor must test both road-clock scale and
actual paid control energy in the same complete race.

A separately versioned v93 *economic selective chase* experiment used
the current front's unpaid relative pace and the root-sum-square of
available selective helpers to estimate whether a coalition could catch
later. An already chasing team needed a safer projected catch before
resting; a captain ahead prompted an earlier response. All road gains
and rider energy still came from actually paid work. The experiment was
rejected and its motor, validator and audit code fully reverted: on the
same twelve guided rival draws, only one race reached a one-minute
lead (135.76 seconds on the no-`all` fatigued mountain case); the other
eleven still peaked below 60 seconds. Merely converting every generated
`all` rival order to `selective` alongside that policy yielded a minute
in ten cases, but erased dedicated all-out pursuit and is not a credible
default. Applying the existing synthetic v94 goal planner's opening
orders on the same v93 road alongside the policy yielded a minute in
only four cases; some role mixes had no front at all. The next motor
change needs inspectable team intent and pursuit economics together,
not another one-dimensional selective-chase threshold.

A second isolated `goalPlanVersion:2` experiment ranked generated rivals
by the captain's terrain-relevant ability, assigned roughly three
one-day or two stage control goals in a 20-team field, then distributed
other goals by strength. Explicit manager tactics and rival goals stayed
intact. The trial was versioned, validated, source-replayed and tested
for manager-order preservation, but its code was fully reverted after
the same-source comparison. Across 96 new-seed 260 km races, the
previous planner's mean maximum leads were 209.64/205.72 seconds for
fresh/tired one-day and 282.07/276.93 for fresh/tired stages. The
strength-ranked planner reduced these to 97.37/98.93 and
173.23/184.35 seconds. All 192 paired recordings validated and
source-replayed without refusal. One-day control reserve improved by
roughly four units at km 210, but the large loss of break opportunity
outweighed it; stage control reserve barely changed. Ranking the
strongest captains into early control made those teams too effective at
suppressing breaks. A credible field needs differentiated goals and a
sporting reason for *when* each team spends its helpers, not merely a
fixed stronger-control mix. These are synthetic comparisons, not a
claim about real-world race frequencies.

A further opt-in v94 control-duty sharing trial estimated the current
front's unpaid relative pace and allowed generated control teams to
withhold a chase turn once already paid chasers covered the projected
catch need. The first version merely moved the withheld team into
paid bunch-front work, leaving every widest lead and catch unchanged
in 24 paired 260 km cases. A corrected trial recorded a separate
sit-in roster and excluded those teams from the front pace, with
energy, road work, recording validation and full source replay still
balanced. It also left every widest lead and catch unchanged:
fresh/tired one-day maxima averaged 353.27/343.90 seconds, and stages
450.94/450.43 seconds under both policies. Early control chase fell
by only about 1.67 team-km in one-day races, with negligible energy
change. The existing catch-projection policy had already withheld
almost every turn this rule would save. Both versions were fully
reverted. More useful work must change a consequential team decision,
not duplicate an existing hold condition.

The v94 road clock previously compared a front group with the bunch at
0.24 seconds per ability point (bounded at 4.5 seconds per kilometre),
but compared two road groups ahead at the older 0.07 and 1.5 scale.
`roadGroupPaceVersion:2` is an internal, committed opt-in that uses the
v94 scale for the latter comparison too. Omitted/version 1 recordings
retain the exact older calculation. The same paid riders and prior
energy feed both transitions; validation of coast/contact and full
source replay use the committed version. This aligns the model's
relative time units; it does not award a prescribed break gap.

In 96 paired new-seed, 20-team, 260 km planned-intent races, all
recordings validated and source-replayed without refusal. One-day
races were effectively unchanged because almost none had two groups
ahead. Stage mean widest leads rose from 212.95/209.88 to
243.81/244.15 seconds (fresh/tired), with unchanged mean control-team
energy near km 210; the initial front was fully caught in 1/0 versus
2/1 of the 24 fresh/tired stage cases. The earlier 24 planned cases
also validated and replayed. A separate 72-case 0/1/8-control stress
matrix had no multi-group kilometres and therefore unchanged outcomes;
the no-control stage mean still exceeded 1,000 seconds. Forty-eight
more 260 km cross-boundary races with women's rolling/exposed routes,
explicit rival goals, calm/hard repeated own orders and the newer
paid-coast contract all validated and replayed; 18 had paid coast.
These synthetic checks support an internal clock correction, not
empirical race calibration or guided release.

A same-source check with the *current guided random rival orders* and
the internal v94 road clock, control pursuit, front rotation and paid
front exhaustion policies gives a different warning. All 24 sampled
20-team, 260 km recordings validated and source-replayed without
refusal. The random draw assigned a mean 8.33-9 break teams and only
2-3.17 control teams. With the existing opening orders, the controls
had no committed bunch-front work; their mean reserve at km 210 was
12.55 fresh and 6.41 tired. Mean widest leads were 193.80/271.61
seconds in one-day races and 364.53/546.82 in stages, with an individual
stage as high as 965.71 seconds. The longer natural lead does not solve
the field dynamics while the few control teams are depleted. A guided
successor needs credible committed team goals and paid workload across
the whole race, including the finale. These are synthetic inputs and
cannot establish real-world calibration.

Adding paid `frontWork:rotate` to all generated control-role rivals in a
read-only counterfactual on the **same 24 guided random draws** did not
restore their reserve. All recordings again validated and source-replayed.
Fresh/tired mean control energy at km 210 changed only 12.55/6.41 to
12.17/6.40. Control teams took just 48/10.33 additional bunch-front
team-km on average; early paid chase remained about 300/222 team-km.
Mean widest leads also barely changed: 193.80/271.61 to
195.66/276.57 seconds in one-day races, and 364.53/546.82 to
363.30/553.10 in stages. This uncommitted counterfactual is not a
planner proposal. It shows that adding front rotation alone cannot
resolve the existing random field's sustained paid chase and depleted
control reserves.

The same 24 original recordings expose the paid chase roster directly.
Fresh control teams averaged about 310 chase team-km (615 rider-km),
and the busiest control team worked 115 km; tired controls averaged
223 team-km (445 rider-km), with the busiest at 97 km. The chase used
19 distinct control riders per fresh race and 12 per tired race on
average. Yet the control helpers' mean reserve at km 210 was just
4.60 fresh and 0.38 tired, versus 12.55 and 6.41 for whole control
teams. This is a field-wide depletion of actual paid helpers, not just
one repeatedly selected worker or a display-only energy issue. The
audit now reports these roster, rider-km and helper-reserve measures.

One accounting mechanism merits a versioned test. During an active v94
chase, `pelotonRestTeamIds` excludes the entire chasing team, although
only two helpers normally earn chase capacity and pay its action cost.
The other riders still pay their steady base effort and cannot receive
the conservative bunch-rest treatment on that kilometre. This is a
code-level hypothesis for part of the team-wide depletion, not proof
that changing it produces a believable race: the active helpers must
still pay all work, and any saved reserve may alter later decisions and
road contact. Test a rider-specific rest rule on the same complete
recordings before changing the experimental preview or guided motor.

That opt-in `chaseShelterVersion:2` trial was implemented and then
rejected. It kept the two active chase helpers fully charged for their
work, allowed only nonworking teammates to receive the existing bunch
rest treatment, and recorded/validated the team roster with source
replay. A locked test passed. But in the same 24 guided-random 260 km
cases, every recording validated and replayed, and mean control energy
at km 210 stayed 12.55/6.41 for fresh/tired races; helper energy stayed
4.60/0.38. Mean widest leads moved only 193.80/271.61 to
193.19/269.50 seconds in one-day races and remained 364.53/546.82 in
stages. The complete candidate code was reverted. This narrow rest
eligibility does not solve the field's paid helper workload.

The paid chase reasons identify the stronger cause in these guided
random draws. All mean 309.83 fresh and 223.33 tired control chase
team-km were recorded as `ordered_all`; **zero** were selective control
chase or emergency response. The mean 3.17 fresh/2 tired control teams
were exactly the randomly generated rivals given unconditional `all`
chase orders. Consequently the v94 selective catch projection never
governs those teams, and neither a selective hold rule nor extra front
rotation can fix their workload. The audit records the reason split and
asserts that every paid control chase is classified. A future generated
team goal must be committed and inspectable, with manager-given `all`
orders preserved; changing the random order alone on the older v93
road did not produce a convincing race.

A labelled read-only v94 counterfactual preserved the same random role
map and teams but changed **generated** `all` control orders to
`selective`; it did not alter manager orders or the playable planner.
All 24 same-source 260 km cases validated and replayed. The fresh
one-day mean widest lead rose from 193.80 to 327.13 seconds and mean
control reserve at km 210 from 12.55 to 18.90, while paid control chase
actually increased from 309.83 to 378.67 team-km. Tired stages rose
from 546.82 to 614.86 seconds, with reserve only 6.41 to 8.78. The
front also changed substantially: fresh break-role attack attempts
fell from 81.5 to 9.83, and the resulting front was captain-heavy.
This demonstrates an interaction between opening attack suppression,
front composition and pursuit, not a safe default order swap. In
particular, the controls still had little reserve for a credible finish.

Another read-only comparison retained those same randomly drawn **role
counts**, but committed each as an inspectable v94 goal and let the
existing specialist policy nominate noncaptain opening attackers. This
is a *combined policy* counterfactual: generated baseline orders,
specialists, paid control tempo and selective pursuit all change
together. All 24 same-route/seed 260 km recordings validated and
source-replayed. Fresh one-day controls finished km 210 with mean
energy 56.59 (helpers 54.59) and paid 93.17 selective chase plus 206
bunch-front team-km; mean widest lead was 104.23 seconds, with two of
six original fronts fully caught. Tired one-day mean lead was 153.76
seconds and control energy 41.86. Stage mean leads were 180.01/356.05
seconds fresh/tired, with control energy 57.24/43.01; one tired stage
still reached 1,052.08 seconds. This exposes a workable paid workload
redistribution and less captain-heavy opening, but the large spread
and short fresh one-day leads fail a calibration claim. It does not
authorize routing v94 to the guided race or rewriting explicit orders.

Ninety-six additional new-seed 20-team, 260 km cases of that same
committed-goal counterfactual all validated and source-replayed without
refusal. Across the three equal holdout batches, mean widest leads
were about 119/108 seconds in fresh/tired one-day races and 193/200
seconds in fresh/tired stages. Fresh one-day batch means ranged
111-124 seconds, but individual one-day cases still peaked below one
minute (minimum 38.60 seconds); one tired stage reached 1,037.88
seconds. Control energy near km 210 remained roughly 55-58 fresh and
42-48 tired across batches. Thus preserving the random role counts
while committing coherent goals and paid specialist/tempo work solves
the immediate energy collapse in these synthetic cases, but does not
produce a stable believable gap distribution or justify the guided
release. The audit is a combined-policy comparison, not a hidden
change to the player's explicit tactics.

The extreme tired-stage holdout (`race-dynamics-holdout-2`, flat) had
**zero** control-role teams and zero paid control chase; its widest
lead was 1,037.88 seconds. The paired one-day case on that field also
had zero controls and reached 396.14 seconds. At the other end,
`race-dynamics-holdout-4` fresh flat one-day had three controls, only
36 paid control chase team-km, a front present for 242 km, yet a widest
lead of just 38.90 seconds. Thus role count explains the largest
outlier, but the short-lead case cannot be fixed by simply reducing
control chase. Inspect front and bunch road work in that case before
changing the motor's economics.

A paid-road comparison of four fresh flat one-day holdout seeds clarifies
that short case. In holdout-4 the front was present for 242 km and paid
988 leading-worker rider-km, while the bunch paid front work on 230 km.
Its mean passive relative gain was only 0.26 seconds/km, versus
1.16-1.38 in the three longer-lead peers. Mean chase power was lower,
not higher, at 29.67 versus roughly 51-56; paid control chase was only
36 team-km versus 184-202. The control team's continuous, fully paid
bunch tempo, rather than its chase, kept this front close. Removing
generated control `frontWork:rotate` in a read-only paired run raised
holdout-4's widest lead from 38.90 to 338.31 seconds, but also caused
462 paid control chase team-km instead of 36 and moved its mean passive
gain to 2.65 seconds/km. The other three flat fresh leads similarly
rose from about 125-138 to 294-371 seconds. This is another workload
tradeoff, not a safe instruction to remove tempo or force a target gap.

Across the full 96-case new-seed guided-role-goals holdout, only two
cases have zero control-role teams and eight have exactly one. Ten cases
never reach a one-minute lead, while just one exceeds ten minutes. The
only over-ten-minute case is the tired flat stage with zero controls;
the other zero-control case on the same field is its paired one-day race.
This identifies an uncommon but severe no-control failure mode. It does
not explain the ten short-lead cases, so simply ensuring one control
team cannot settle the motor's wider pursuit and tempo balance.

The first 32 fully validated/replayed new-seed guided-role-goals races
also expose a decision mismatch. Fresh one-day controls paid a mean
204.5 bunch-front team-km, of which 196 occurred in kilometres when
their selective chase was explicitly held. Tired one-day: 156.75 and
150; fresh stage: 193.63 and 189.63; tired stage: 152.63 and 149.13.
Thus roughly 96–98% of their paid front work took place while the same
team's catch projection chose to wait. The front work is real and paid,
but the declared economic wait has no effect on the separate tempo
order. A separately versioned rule that lets *automatically generated*
control tempo rest on held-chase kilometres is worth a paired audit;
explicit manager front-work orders must still execute. This is a
diagnosis, not yet a motor change or a claim about real races.

That versioned trial was run and rejected. It kept explicit manager
front-work orders, withheld only automatically committed control tempo
when the same team's selective chase was held, and checked the paid
worker roster, energy ledger, intent source and full replay. In 24
same-source 20-team/260 km races, both versions validated with no
refusals. Fresh/tired one-day mean widest leads rose from 295.16/283.42
to 462.54/437.83 seconds; stages rose from 403.42/399.01 to
608.26/596.91. Control front work fell from roughly 145–163 to 3–9
team-km, but paid chase climbed from 36–108 to 350–386 team-km and
control reserve at the finale start fell by about 16 points. A binary
“rest whenever chase is held” rule merely exchanges sustained tempo
for a longer, more costly pursuit. All trial code and tests were
reverted; only this diagnostic remains. A useful policy needs a more
credible way to share work and reassess the break over time.

A second read-only counterfactual kept generated control front work but
changed its effort from steady to conserve throughout the same 24
guided-role-goal races. All recordings validated and fully replayed.
It was an intermediate tempo reduction, but still shifted work into
pursuit: in the fresh one-day cases, mean widest lead rose from 295.16
to 329.99 seconds while control chase climbed to 405.67 team-km and
control front work fell to 101.17 team-km. Fresh stage lead rose from
403.42 to 444.56 seconds; tired stage lead from 399.01 to 557.87.
The temporary audit switch was removed. A fixed lower effort order
does not solve the coupled tempo and chase decision.

A later read-only zero-control coverage counterfactual changed only the
two no-control races in the first 32 new-seed guided-role-goal cases. It
gave the strongest already protective generated team a committed control
goal; all 32 recordings validated and source-replayed. The tired flat
holdout-2 one-day widest lead fell from 396.14 to 48.52 seconds and its
stage lead from 1,037.88 to 128.86 seconds. That removes the extreme
unopposed stage in this sample but compresses the paired one-day break
below a minute. One extra control goal is therefore too sensitive to
claim as a general remedy. The temporary audit switch was removed; no
playable planner or explicit manager order changed.

A separate read-only paired-motor audit now holds the prepared route,
20 teams, riders, fatigue, seed and every committed order fixed while
running v93 and v94 (`scripts/audit-v93-v94-same-orders.mjs`). In 48
paired one-day/stage cases from six seeds across flat/mountain and
fresh/tired starts, every recording validated and each v94 recording
source-replayed. V93 means of the widest lead were 34.18/35.95 seconds
for fresh/tired starts; v94 one-day means were 210.70/265.79 and stage
means 419.16/522.96. V93 had zero kilometres at or above one minute,
while v94 averaged about 99–133 per race. No source committed bunch
front-work orders, so paid bunch-front kilometres were zero in both.
Although total paid chase fell from roughly 662/725 to 589/650
team-kilometres in one-day and 314/270 in stages, generated control
teams paid *more* chase under v94: about 217/199 to 314/270.
Among races with a generated control team, its helpers' mean energy
at km 210 fell from 11.90/2.99 to
3.44/0.37 in one-day and 3.46/0.37 in stages. These are differences
between complete versioned motors, including road and decision policy;
they do not isolate one coefficient or establish realistic race gaps.
They show that a longer front under current rival orders can coexist
with even less control helper reserve. The guided v93 route and the
experimental v94 release boundary remain unchanged.

Extending that exact paired audit to twelve seeds (96 format-paired
cases) preserved the direction. Mean widest leads were 29.98/37.41
seconds in v93, 170.89/241.19 in v94 one-day, and 358.59/465.26 in
v94 stages for fresh/tired starts. V93 still had no kilometre at or
above a minute. Paid control chase grew from 237/229 to 336/308
team-kilometres, while the mean km-210 control helper reserve among
control-bearing fields fell from 14.26/3.58 to 5.99/0.83. The result
reinforces the coupled gap-and-energy problem; it does not isolate a
single road or pursuit coefficient.

The random guided rival draw also commits its generated control teams
to both `chase: all` and `effort: hard` for the entire route. A read-only
paired audit changed only those generated teams' effort to `steady`,
retaining their all-out chase order and every seeded role/team/route.
On the original 24 internal v94 guided-random 20-team, 260 km cases,
all recordings validated and source-replayed with zero refusal.
Fresh/tired one-day mean widest leads fell from 193.80/271.61 to
137.40/223.77 seconds; stage leads fell from 364.53/546.82 to
280.83/453.63. Control teams paid *more* chase (about 310/223 to
381/285 team-kilometres) because their helpers could keep working;
km-210 helper energy rose from 4.60/0.38 to 16.11/3.31. The hard
whole-team effort is therefore a real contributor to depletion, but
simply lowering that generated order also intensifies pursuit and
shortens the front's lead. It is a diagnostic, not a playable default
or a repair of the coupled work/road balance. Explicit manager orders
were not changed in this comparison.

The same validated/replayed 24-case comparison now splits the control
helpers' recorded paid reserve through km 210 by whether each helper was
named in that kilometre's paid chase contribution. For fresh starts,
the hard order charged a mean 767.71 energy units on chasing helper
kilometres and 965.62 on other helper kilometres; steady charged
852.94 and 575.45 respectively. The paid chasing helper roster grew
from 592.33 to 727 rider-kilometres, while non-chasing helper exposure
fell only from 3,397.67 to 3,263. For tired starts, paid chase/other
charges changed from 579.73/472.46 to 670.54/345.48, with chasing
helper exposure growing from 444.67 to 568 rider-kilometres. Neither
order recorded recovery for these helpers. One-day and stage values
through km 210 match because their route and early orders are identical.
This identifies substantial paid control-helper load outside the
recorded chase, and explains why saving that load enables more pursuit.
It is a ledger partition by observed chase participation, not a causal
decomposition of the effort coefficient or a calibrated policy.

Splitting that non-chase ledger further by the recorded road at each
kilometre gives another useful boundary. In fresh races, generated
hard controls paid a mean 554.96 reserve units from helpers who were
not chasing on kilometres with **no front group at the frame end**,
and 410.67 on kilometres with a front. With only their generated
effort changed to steady, those values were 320.59 and 254.86.
The corresponding non-chasing helper exposure was 1,857.33/1,540.33
rider-km under hard and 1,823.67/1,439.33 under steady. Tired starts
had less no-front exposure: 70.58/401.88 paid under hard, versus
34.01/311.46 under steady. This shows that the generated hard order
can charge helpers heavily even when no break is recorded at the end
of a kilometre. The frame-end classification does not establish
whether an attack briefly existed within that kilometre, and this
read-only partition does not justify an uncommitted automatic easing
rule or predict its whole-race consequences.

The no-front partition can be split again at each race's first recorded
front. For fresh starts under the generated hard order, non-chasing
control helpers paid 340.73 reserve units before the first front and
214.22 on later no-front kilometres, across 1,144.67 and 712.67
helper rider-km respectively. With only the generated effort changed
to steady, the same seeded cases paid 258.13 and 62.46 units across
1,476 and 347.67 helper rider-km. Tired starts paid 14.71/55.88
under hard and 8.65/25.36 under steady. The time spent before the
first front and after it was caught changes too, so this is not a
fixed set of kilometre states with only a cheaper effort charge.
It strengthens the case for auditing a complete, committed control
work decision over time rather than applying a static cost discount.

The read-only ledger now isolates an even narrower subset of those
non-chasing control-helper kilometres: no front group at either the
start or end of the kilometre, and no recorded attacker during it.
Across the same 24 validated/replayed guided-random V94 cases, fresh
starts under the generated hard order paid a mean 469.94 reserve units
over 1,574 helper rider-km in this subset through km 210. Changing
only that generated effort to steady paid 270.99 units over 1,543
helper rider-km. Tired starts paid 54.97 over 178 rider-km under hard,
versus 25.69 over 142 under steady. One-day and stage early values
match because their routes and early orders do. This closes the
within-kilometre attack caveat for this explicitly recorded subset:
the hard whole-team control order charges helpers even when neither
a front nor an attacker is recorded. Different road histories still
change exposure, so these are observed whole-race ledgers, not a
per-kilometre causal effect or a safe policy replacement. The
steady-only counterfactual already produced more chase and shorter
leads; the generated control workload and pursuit decision must be
designed and audited together.

A read-only `--generated-control-package` comparison combines three
*committed generated-control order* changes on the current guided
random rival draws: hard to steady whole-team effort, all to
selective chase, and paid `frontWork:rotate`. All other seeded teams,
routes and riders remain fixed; manager-given orders are outside this
diagnostic. The 24 original and 96 independent new-seed 20-team,
260 km V94 recordings validated and full source-replayed without
refusal. In the 96 new-seed format-paired cases, the unchanged orders
had mean widest leads of 194.72/205.98 seconds for fresh/tired
one-day starts and 409.08/468.25 for stages. The generated-control
package yielded 157.50/141.63 and 227.58/250.09 seconds respectively.
The control helpers' mean reserve at the final-kilometre handoff
rose from roughly 1.28/0.85 fresh/tired to 41.07/31.15 in one-day
races. This is a coupled paid tempo-and-pursuit result, not a claim
that any individual order change caused it.

The package still failed both ends of a useful distribution. One tired
one-day case never reached a one-minute widest lead (56.07 seconds),
while `race-dynamics-holdout-2` tired flat stage retained a 961.88-second
lead: that field has nine break-role teams, zero control-role teams and
zero paid control chase, so a control-only package cannot affect it.
All nine initial front riders in this particular guided-random source
are their teams' captains, and all nine remain ahead in the recorded
line groups. The audit records zero protective-team chase through
km 210 and in the final 50 km under the current stage-format decision
path. That identifies an unopposed
captain-heavy front in this synthetic source; it does not by itself
justify assigning a control team or making every protector chase.
In the same seed under the separate committed-role-goal conversion
(`--guided-role-goals --extended-seeds --seed-batch=1 --validate --replay`),
the initial nine front riders contain *no* captains, yet the field
again has zero control teams and records zero protective chase through
km 210 and in the final 50 km. Its widest recorded lead is 1,092.11
seconds under that audit's policy settings. The two recordings change
more than captain selection, so this is not a causal comparison; it
shows that a captain-only response would leave a no-control failure
mode unresolved.
The stage result is a group road recording, not an official winner.
This static package remains read-only and uncalibrated; it does not
justify a guided default or a fixed gap target. A future control
planner must address both whether any team has a sporting reason to
control and how its paid tempo, selective pursuit and reserve evolve.

The no-control stage outlier also has a structural decision boundary.
Generated `protect` teams carry a committed selective-chase baseline,
but the V94 `protectiveRisk` decision is currently confined to
`one_day` races. In a stage, a protect team without a separate GC,
break-response, fading-teammate or manager reason is withheld by the
role gate even when its helpers are available. The nine-break,
zero-control holdout therefore cannot be fixed by adjusting control
tempo alone: there is no generated control team to receive that work,
and the remaining protect teams do not take up a stage-result pursuit.
This is a code-path diagnosis, not evidence that every protector should
chase. A stage response needs an inspectable committed sporting stake
and a paid work decision that remains viable across the field.
These synthetic stage audits pass no completed GC classification to
`simulateTacticalTour`; its existing contract rejects a GC objective
without one. Assigning `defend_top_ten` or `target_top_ten` to the
generated protect teams would therefore fabricate a missing race
context rather than supply a justified pursuit goal. A stage-result
response needs its own committed, testable incentive.

A temporary read-only counterfactual tested the existing, explicit
`chase_if_threatened` road-captain order on **all generated protect
teams in stages only**, leaving the seeded riders, roles, other orders,
road and energy model fixed. In 32 format-paired cases from the first
four holdout seeds (flat/mountain, fresh/tired), all recordings
validated and fully source-replayed. The 16 one-day controls were
unchanged. Fresh stage mean widest lead fell from 348.45 to 67.75
seconds and tired stage mean from 511.15 to 152.56; the stage ranges
became 40.05–126.95 and 27.14–349.89 seconds. Paid protect-team chase
on kilometres with a front rose from zero to 299.75/324.63 team-km
per fresh/tired stage. The zero-control tired-flat outlier fell from
961.88 to 279.74 seconds, but paid 421 protect-team chase-km against
the front. This broad response trades an unopposed race for short
leads and heavy pursuit elsewhere. Its temporary audit code was
removed; neither generated orders nor the guided/default motor changed.
