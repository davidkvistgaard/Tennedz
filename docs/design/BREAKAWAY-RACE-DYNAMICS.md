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

The same tired-flat zero-control stage was isolated with the audit's
bounded `--seed=race-dynamics-holdout-2` filter and full source replay.
Its nine initial front riders were all captains and all nine were still
ahead at the recorded line. A front was present for 256 km; the source
records 622 paid front-worker rider-km and 398 settled-rest rider-km.
Mean passive front-gap growth on front kilometres was 3.71 s/km,
with zero paid chase power, zero protect chase-km and zero control
chase-km. The bunch-easing decision also records 2,652 team-km across
the race, roughly ten teams per front kilometre. The extreme is
therefore a recorded, partially rotating front with no opposing paid
work, rather than free or uncharged work
by all nine riders. These measurements remain synthetic and do not
calibrate a realistic lead.
As an external check on a tempting size-only fix, Brouwer and Potters'
[professional-race breakaway study](https://pure.uvt.nl/ws/portalfiles/portal/76857262/1-s2.0-S0167487017307596-main.pdf)
reports a concave benefit from group size, turning negative only above
26 riders in its sample. A nine-rider front is below that reported
turnover. The inference for this simulator is limited: penalizing this
outlier solely because it has nine riders would have no direct support
from that result. Its missing paid opposition and team incentives
remain the clearer recorded discrepancy.

An independent V93 guided-random check used seed numbers 97–120,
20 teams, 260 km and each flat/mountain × fresh/tired combination
(`scripts/audit-v93-guided-finish-coverage.mjs`). All 96 source roads
validated; 95 paid an individual finish and one kept its honest
last-kilometre refusal with a source-replayed group-road preview.
Mean widest recorded leads were 32.23 s on fresh flat, 45.40 s on
tired flat, 40.31 s on fresh mountain and 37.01 s on tired mountain.
Only six of 96 races ever reached a one-minute lead. The disjoint
sample shows somewhat more variation than the first 96-case baseline,
but confirms that the ordinary guided V93 motor usually compresses
breaks. It does not validate an isolated chase, tempo or role change;
the short-lead problem remains open while V94 stays experimental.

### Break threat matrix, first read-only version

`lib/engine/v2/break-threat-matrix.mjs` now forecasts one named leading
road group against an explicitly supplied set of teams with a sporting
reason to consider pursuit. It reports four separate inputs: the number
and work of front riders, their terrain-specific ability and energy,
the potentially payable chase helper roster and energy, and every remaining
route kilometre. It also reports the current gap and the maximum
closing produced by a shadow continuation of the existing road rules.
Neither a role label nor a manager order is changed by this module.
The shadow continuation is not an official clock or a committed chase.

The six focused tests include the two qualitative cases from the user.
A 30-rider strong flat front with three minutes at 30 km and only one
chasing team remains ahead in the current clock. A weak-climbing front
loses more of its lead on a final climb than on a flat road against
strong climbers. But the existing passive road-gap cap prevents a
ten-minute lead from being caught over the test climb. The matrix must
not label that source as a safe catch while the paid road cannot deliver
it. Terrain-to-time calibration and the coupling of committed team
intent to this matrix remain open work.

The read-only audit `scripts/audit-break-threat-matrix.mjs` replayed
24 controlled 20-team, 260-km experimental V94 races across
flat/mountain, fresh/tired, one-day/stage and zero/two/four explicitly
goal-directed rival control teams. It assessed the leading group at
km 80, 160 and 220 when one existed: 71 observations. The matrix now
provides two boundaries: nominated control teams and a larger coalition
including conditional one-day protect teams. The nominated coalition
could catch in 31 observations; 17 more needed conditional help. The
actual recorded road caught in 32. Potential and observed outcomes
differed in 16 observations. With zero nominated rivals, one-day
protectors supplied conditional capacity in all 12 observed situations
and the recorded road caught in nine. In the 24 stage observations with
two or four nominated controls, 13 had sufficient all-in capacity but
none actually caught. A team's ability to chase is distinct from its
decision to pay for a chase. The matrix reports *all-in catchable gap*
and headroom for both coalitions, not a prediction that either coalition
will commit every kilometre.
The audit also separates paid chase from held selective chase in the
remaining source frames. The 12 stage/four-control observations include
3,520 paid control team-km and 1,600 held control team-km in their
overlapping follow-up windows, yet no original leading group was
caught. This is neither zero pursuit nor proof that a single extra
control order would solve the road. One-day/zero-control observations
include 10,153 protector chase team-km in overlapping windows and
nine recorded catches. These window totals double-count kilometres
shared by the km 80, 160 and 220 observations and stop when the
original leading group is first caught; they are diagnostics,
not race totals.
It does not model future attacks, group changes, or a newly justified
sporting stake for other teams. These discrepancies prevent routing
this version into automatic guided decisions. No production route uses it.

### Observer-specific uncertainty and multiple fronts

`lib/engine/v2/break-threat-perception.mjs` adds a separate read-only
V94 candidate. Each observing team knows its own rider skills and
energy exactly. Rival sporting skills, form and fatigue receive a
deterministic observer-specific estimate within five points of the
source; rival energy is rounded to ten-point steps with a stable
observer bias and a ten-point uncertainty interval. The bias is keyed
by race seed, observer, rider and field, so it does not reroll whenever
the same rider is assessed at another kilometre. The paid road still
uses exact source values. One focused counterfactual shows an observer
underestimating a front rider sufficiently to expect a catch that the
truth-based all-in shadow does not support. This creates a possible
decision error without altering recorded rider strength or awarding
time from randomness.

The candidate assesses every recorded road group separately against
the bunch, excluding other forward groups and dropped riders from the
available chase roster. A new attack therefore adds a threat rather
than replacing the old one. A validated and replayed V94 source produced
40 two-group frames in a 260-km mountain stage. At km 220 the older front
was 112.2 s ahead and beyond the nominated coalition's calculated
capacity; the later group was 15.85 s ahead and within that capacity.
At km 259 both were beyond capacity. The assessment did not mutate paid
road frames (`scripts/audit-break-threat-perception.mjs`).

The simulated fatigue and absent-helper tests reduce available chase
capacity substantially. A longitudinal stage race with actual injuries
and withdrawals is not implemented by this layer; callers must supply
the recorded unavailable riders. Observer estimates are a synthetic
information model, not empirical scouting data. No guided-race motor
or production decision uses these estimates yet.

The broad 71-observation capacity audit found no change in the coarse
coalition band from the bounded observer estimates. They did change the
expanded all-in catch budget by up to 46.93 s. A separate one-kilometre
delay calculation compares starting the nominated chase now with
giving the same front one further kilometre before paying. In one
validated/replayed 260-km one-day source, 101 successive km 120–220
were inspected. The perceived and truth-based `must start now` advice
differed at two kilometres: the observer saw a critical deadline at
km 147, while the truth-based shadow reached its critical deadline at
km 153. The source had already paid both controls from km 143, so
this is a timing-sensitivity example, not evidence that the alternate
advice would have changed the winner. A focused counterfactual also
shows a stable underestimation delaying the critical chase by one km.
No random gap or finish is awarded. Full per-kilometre use of the
remaining-route shadow needs performance and calibration work before
it can be a playable policy.

### One active peloton pull at a time

The current V94 chase sums the capacities of up to two helpers per
contributing team in each kilometre and charges both. This does not yet
represent one rider leading while others sit in the draft. The isolated
`peloton-chase-rotation.mjs` candidate represents willing, eligible riders
as successive shares of a kilometre: effective instantaneous chase
capacity is their share-weighted mean, never their sum. A helper pays an
extra leading cost only for their share and an explicit lower draft cost
for their other share. Additional helpers can preserve future energy and
extend a chase, but cannot multiply instantaneous road speed. Only teams
that actually commit workers appear in the paid rotation. Expected help
from other teams belongs in the observer's conditional coalition, not
the actual road ledger until those teams join.

An opt-in `rotationVersion:2` in the read-only threat matrix pays this
rotation in its shadow energy and uses its share-weighted speed. The
V93/V94 paid clock and viewer remain unchanged. A validated/replayed
260-km V94 source recorded 636 chasing team-km, every one with two
workers paying reserve; 1,272 worker-km were charged. At km 80, the
same source's two nominated control teams and four available helpers
had an all-in catchable-gap budget of 214.82 s under stacked capacity,
but only 13.86 s under the uncalibrated rotation shadow. At km 160
the figures were 124.55 s and 14.95 s. This huge difference confirms
that merely switching to one-rider speed would make the existing
chase coefficient unsuitable. Neither shadow is an observed catch
prediction. The separate road clock, energy and source-replay contract
must be calibrated across whole races before routing or describing
individual pulls to the viewer. Existing commentary reports a recorded
chase but cannot claim a particular leader in the wind from current
V94 frames.

`paidRotationMoments` prepares English viewer lines for a team sending
one rider, adding a second, a later team joining with two, or leaving.
It reads only consecutive paid rotation plans. It is deliberately not
called by the current viewer: current frames record paid chase workers
but do not record which one occupied the wind at each moment.

### Participation in each road group

The current kilometre engine selects eligible pullers separately for each
recorded group ahead of the bunch. A committed `sit_on` order excludes a
rider; a cooperating rider may reciprocate when a rival sits on; a rider
normally protects a teammate in an earlier group; low energy can prevent
a pull. An explicit drive order or the committed fading-teammate response
can change those choices. Selected pullers pay extra energy while riders
in their draft pay less. The cost has a group-size rotation allowance,
but no source frame records which individual occupied the wind or how
long each turn lasted. A late attack when outsprinted is a separate
committed finale order, not an automatic decision to sit on throughout
the break. Dropped riders are tracked individually and do not form a
cooperative rear group in this version.

`road-group-participation.mjs` is a read-only explanation of the existing
selection. The same `decideRoadGroupWork` function now selects the pullers
used by the road and returns one explicit choice and reason per rider in
each forward group. The explanation returns each selected rider and the
strongest order-backed
or source-backed reason for an exclusion. It does not assign a fictional
pull duration or infer a private sporting motive. It is not wired into
paid race frames or viewer commentary.

A future versioned participation decision should assess every recorded
group on every relevant kilometre. It needs a sporting stake from an
actual rider or team order and, for GC, an actual classification; known
teammates in groups further ahead; terrain-specific *perceived* rival
strength rather than hidden exact strength; own and rival sprint chances;
the remaining route; available energy and fatigue; and uncertain help
from other teams. Its outcome should be an explicit `pull`, `sit_on`, or
`attack` decision with a recorded reason. A separate physical rotation
step must then put at most one rider in the wind at a time, charge that
rider for the actual share, charge sheltering riders less, and advance
the group from paid work. Re-evaluate when an attack creates a new group,
when a teammate moves ahead, or when a group is caught. Rear groups need
recorded group formation and contact before using the same mechanism.
The viewer may narrate named leads or tactical withholding only after
those decisions and shares are recorded and source-replayed. The current
V93/V94 clocks, finish guards and historical recordings remain unchanged.

### Per-rider kilometre contract for the next motor

Updating every rider's energy is not sufficient. Before advancing a
kilometre, a new motor version must assign **exactly one primary action
to every active rider** from the rider's current road group and the
information that rider or team could possess. The decision record needs
the rider ID, group ID, committed team order, observed threats, available
energy, chosen action, and a reason. It must not use a rival's hidden exact
skill in a rider's decision. The paid road may use exact physical skills
after the choice is committed.

Actions must distinguish attack, exposed lead, sheltered cooperation,
deliberate sit-on, support of a teammate, conservation in the bunch, and
isolated riding after a drop. A rider can decline work because a teammate
is further ahead, because the group's sporting stake does not justify
spending energy, or because saving energy for a sprint is a committed
strategy. A GC reason requires a real classification. Uncertain help from
other teams affects expectations, not the paid work roster until those
teams actually commit and contribute. If two groups are ahead, each is
assessed separately. A dropped rider cannot gain drafting or rotation
benefits from a rear group until a recorded contact creates that group.

For every physical group, the subsequent work step must record no more
than one exposed leader at any instant and the duration of each turn.
Other riders receive a lower, explicit sheltered cost. Fatigue and
availability can end a turn; having more helpers extends the number of
future turns rather than summing their speeds. The group clock, catches,
splits, energy ledger and viewer events must all derive from these paid
turns. A tactical decision is recomputed after each kilometre and after
each recorded split, catch, or change in available teammates.

The release gate is whole-race source replay, not a plausible isolated
kilometre: every active rider must have one decision and a matching paid
energy transition at every kilometre; no rider may work in two groups or
occupy the wind concurrently; decisions may use only committed orders and
observed or explicitly uncertain rival information; and the same seed
must reproduce group membership, contact and finish. Test fresh and tired
one-day and stage cases, flat and mountain routes, multiple simultaneous
breaks, no control team, weak and strong sprint interests, missing
helpers, late manager orders, and riders dropped behind the bunch. Do
not route this candidate to guided races until its group speed and
fatigue are calibrated across those full races. Historical versions
retain their original contracts and replay results.

### Riders behind the bunch and the unfinished time limit

The current `dropped` state is an individual deficit to the bunch at
each kilometre checkpoint. It does not contain an intra-kilometre
contact, a common rear-group clock, an occupied wheel, or a rider who
leads that rear group. Similar deficits alone are insufficient evidence
that two riders met. This applies equally to exhausted bunch workers,
caught break riders who lose the bunch, and riders dropped early on a
climb. They must all enter the same future rear-road mechanism through
recorded events rather than receive a category-specific shortcut.

The next version must carry each detached rider's paid road clock and
energy through shorter steps. A rear group may form only when those
clocks reach a recorded contact point. It then gets a persistent group
identity and membership, so riders can leave, join, be dropped again,
or rejoin the bunch without teleporting or being counted twice. Each
member's decision at the next step is explicit: seek contact, take a
turn, shelter, wait for a teammate, or ride alone. At any instant only
one member leads. The exposed leader pays the lead cost; other members
pay a lower sheltered cost. Turns are reassigned when the leader is
spent or another member volunteers. Riding together may conserve
energy and sustain speed, but the number of members must not simply
add their abilities to instantaneous pace.

Their shared objective is to reach the finish with the available energy.
No cut-off time is defined yet: the motor must record their actual finish
times and group crossings without declaring anyone outside a limit.
When a separate, explicit time-limit rule is specified, it can compare
those recorded times against the rule. It must not change the road
clock retroactively or fabricate a present-day cut-off.

The release gate includes source-replayed cases for the three entry
paths above, several riders losing contact at different moments, two
rear groups merging, one rider refusing a turn, exhausted leaders,
terrain transitions, and a group that catches the bunch. Verify each
rider's paid work, sheltered energy, membership and finish clock at
every step before showing named gruppetto commentary or results.

### Staying with the bunch versus deliberately letting go

The present `updateRiderGroups` compares each rider's current ability
with a bunch reference pace and accumulates a deficit after repeated
shortfalls. Its input has no individual choice to spend more energy to
hold the wheel. Effort changes that rider's energy charge elsewhere,
but the group attachment transition itself does not distinguish a
failed attempt to stay from a deliberate early release. The stage
handoff can carry fatigue after an isolated stage; the race context
only knows the current stage number and has no committed upcoming
route, role or stage objective. Consequently the current motor cannot
honestly say a rider let go to save energy for a particular future day.

A next-version decision has two separate questions at every relevant
climb or pace change. First, from the rider's known condition, terrain,
draft, observed group pace and remaining climb, estimate the extra
energy needed to stay attached and whether that attempt is physically
possible. The rider may choose to try and still be dropped; the attempt
must cost energy and affect the paid road clock. Second, if staying is
possible, compare the current sporting stake with the explicitly
committed multi-stage plan and the value of saving energy for later.
The choice to release must record that strategic reason and the energy
it actually saves. A leader defending a real classification, a helper
still assigned to protect that leader, and a rider targeting another
stage may reach different decisions on the same climb. The rider may
not know exact rival capacity or a future result in advance.

After either an involuntary drop or a voluntary release, the rider
enters the paid rear-road/contact model above. Neither branch grants
instant group shelter. No time-limit result is inferred while the
cut-off rule is undefined. Replay must distinguish `tried_and_dropped`,
`chose_to_release`, and `stayed_attached` from recorded decisions and
paid energy, including early-climb, caught-break and exhausted-worker
cases across consecutive stages. Do not calibrate a hard-effort bonus
or future-stage utility from a single illustrative race.

### Isolated one-leader road-group turn plan

`road-group-turns-v1.mjs` consumes the executable per-rider pull choices
for one existing forward group and divides a kilometre into consecutive
turns. Each metre has one exposed leader. The candidate computes each
member's extra lead or shelter cost and a distance-weighted mean leading
ability, never the sum of worker abilities. A group with no willing
leader returns `unsupported_unworked`; it does not receive free worked
pace. A rider unable to pay even the extra planned group charge refuses
the plan. The caller may pass the subset actually active after a recorded
settled-front rest; the planner rejects an active worker who did not
choose to pull. This is an isolated, opt-in plan, not a paid road transition:
the baseline riding charge, within-kilometre exhaustion, contact, group
clock and source replay still need a separately versioned integration.
No guided race or viewer uses these turns yet.

A read-only `audit-v94-road-group-turns.mjs` replays four 120-km V94
one-day sources across flat/mountain and fresh/tired. Every one of the
400 prior forward-group kilometres had an eligible recorded worker and
the isolated planner could divide its actual worker roster into turns.
The current aggregate model charged 236.074 extra reserve units across
those groups; the one-leader shadow planned 154.04. These are summed
model units, not an observed energy saving or calibrated race result.
The shadow deliberately leaves baseline cost and road movement unpaid,
so its lower charge cannot be inserted into the guided motor as-is.
The same four fresh/tired flat/mountain scenarios at 260 km source-replay
and yield 954 prior forward-group kilometres. All have a recorded active
worker roster that the candidate can divide into one-leader turns.
Current aggregate extra cost totals 409.61 model units versus 287.72
planned shadow units. This larger holdout reinforces the calibration
need; it does not establish that the shadow reaches the line at the
same speed or with the same rider energy.
These four long sources have eight first-time `dropped` events in total,
none immediately after a recorded bunch-front assignment or on the same
kilometre as a recorded break catch. They therefore do not exercise the
rear-group entry paths requested for exhausted workers or caught break
riders. The audit counts these paths explicitly rather than claiming
coverage from a long-race sample that lacks them.

### Isolated rear solo contact step

`rear-solo-contact-v1.mjs` adds an independent, versioned short road
step for two detached solo riders with ordered, positive time gaps to
the bunch. Given explicit rider and bunch speeds and per-rider work
costs for that slice, it charges each solo rider to the exact computed
meeting point or through the entire slice if they remain separate.
It records an exact rear-contact marker only when the rear rider closes
the paid gap; a bunch catch before that contact refuses this branch.
The standalone validator recalculates the step and rejects a changed
contact marker or energy. It does not silently grant a common wheel,
shelter, leader, finish time or time-limit result after contact.

This step is not yet connected to the full race. The current kilometre
frames do not supply independent short-step speed and position plans
for detached riders, and a single reference slice cannot establish
terrain-specific location for riders far apart on the road. Those plans,
rear-group continuation and full source replay are required before any
real race can form a gruppetto with this candidate.

`rear-contact-continuation-v1.mjs` now recalculates that paid solo
meeting before allowing a two-rider rear group to travel the remaining
part of the same short slice. One named rider leads and pays the greater
cost; the other pays a smaller sheltered cost. If their paid common
speed reaches the bunch, the step stops at the computed rejoin marker.
The source validator rejects changed energy or contact. No group is
formed from similar checkpoint deficits, and an unpayable rider or
missing solo contact refuses. The group speed and costs are explicit
inputs to this isolated step, not yet derived from a committed
multi-stage rider policy. The contact step alone does not select later
turns or replay a full race.

`rear-group-step-v1.mjs` continues the explicitly formed group on later
short slices. Every member supplies a `pull` or `sit_in` decision and a
reason; the group rotates one willing leader per slice. Only that rider
pays the higher exposed rate, while companions pay the lower sheltered
rate. The step refuses an unpayable leader or a group with no willing
leader, and stops exactly at a paid bunch rejoin. A complete next-group
state carries membership, clock, turn count and each rider's energy to
the following slice; its validator recalculates the source decisions.
This remains isolated: its speed, rider decisions and energy rates are
supplied inputs rather than derived from the actual V93/V94 stage and
committed orders. It does not model new joins, splits, terrain-specific
positions or a whole-race finish. It cannot be shown as a playable
gruppetto until those parts are source-replayed together.

`rear-group-run-v1.mjs` now chains the paid solo meeting, the first
common turn and subsequent short-slice turns without allowing an
unrecorded jump or another rear turn after a bunch rejoin. Its validator
recalculates the entire supplied chain and rejects changed rider energy
or leadership. This is still a standalone witness over supplied speed,
cost and decision plans. It does not establish physical locations or
sporting decisions from a locked whole-race source, and is not routed
to the guided motor or viewer.

`rider-climb-decision-v1.mjs` separates an inability to pay the
projected cost of holding a climb from a voluntary release. A voluntary
release requires an explicit committed plan to finish this stage safely,
target a later stage and retain a stated energy reserve; a team order
to hold position prevents that optional release. The decision and reason
can be recalculated from the same source. This isolated decision does
not yet derive the hold cost from the route and actual pace, move the
rider, form a rear group, decide a finish time or impose a time limit.

`scripts/audit-v94-rear-entry.mjs` replays 32 generated 20-team,
260-km V94 cases across eight seeds, flat/mountain routes and fresh/tired
starts. It found 51 first transitions into the provisional `dropped`
state. None belonged to a recorded bunch-front worker in that or the
preceding kilometre, and none was a caught break rider in either
kilometre. This is a coverage finding, not evidence that those entry
paths cannot occur: the cases do not exercise them. The provisional
`deficitSeconds` does not give a physical road coordinate, so these
51 riders cannot be joined into a rear group from the frames alone.

The same audit now has an opt-in `--generated-profile` route check. Two
independent 260-km profile seeds, flat/mountain and fresh/tired produce
eight source attempts under the opt-in V94 paid-turn versions. Six
validate and replay; two mountain cases correctly refuse a combined
fresh attack and pursuit without a shared road clock. The six accepted
races have 112 first `dropped` transitions, all on actual `climb`
kilometres. None is a recorded bunch worker that kilometre or the
previous one, or a rider caught from the break in either kilometre.
This shows the real generated climbs exercise the early-drop path far
more than the old shallow mountain template. The `dropped` deficit is
still provisional; these 112 transitions do not establish a paid
position or a rear-group meeting.

An internal V94 `roadGroupPaceVersion: 3` now consumes the recorded
per-rider forward-group work decisions in an actual one-leader-at-a-time
kilometre turn plan. Each leader's share and every sitter's lower extra
cost enter the race energy ledger; the turn-weighted ability enters the
rear-front and front-bunch relative clocks. Driving riders retain their
committed extra effort and cost. The recording stores decisions, turns
and cost shares, and the source validator recalculates them before full
V94 replay. Old V94 versions and guided V93 keep their recorded behavior.

The read-only 16-case same-seed 120-km flat/mountain fresh/tired audit
replayed both old version 2 and this opt-in version 3 with no refusal.
Version 3 recorded 244–816 named turns per case, but its maximum lead
was smaller in every case (for example, 89.75 to 51.65 seconds in the
first fresh flat case). Removing the old group-size speed bonus while
charging sequential turns substantially changes race outcomes. This is
not calibrated and must not become the guided default. Bunch-front and
chase workers still use their existing pair/capacity models, and dropped
riders still lack physical road coordinates and group contact.

An independent internal V94 `bunchFrontTurnVersion: 1` now uses two
named helpers as sequential 500-metre leaders at the bunch front.
The selected team's front pace remains the turn-weighted average of
those riders' actual kilometre-start abilities. Only the exposed half
of each rider's extra front-work cost is charged; their normal riding
cost remains in the energy ledger. A worker unable to pay the full
kilometre work refuses instead of receiving a free front pace. The
recording includes the exact named turns and shares, and the source
validator rejects changed work or leadership before full replay.

In 16 same-seed, source-replayed 120-km flat/mountain fresh/tired cases,
the new version recorded 69–116 paid bunch-front kilometres per case
with no refusal. Maximum break lead changed by roughly -1.8 to +0.2
seconds compared with the existing pair-cost version; one case changed
whether a front group survived at the checkpoint. This is not a race
calibration or a guided release. Chasing helpers still use the older
capacity/cost model, and the bunch has no independently positioned
single-wheel contact trace.

`chase-turns-v1.mjs` is an isolated candidate for rotating all committed
chasing helpers through one exposed position. It divides the kilometre
into named non-overlapping turns, weights the road contribution by each
actual turn length, and charges each leader only for their exposed share.
It refuses an unpayable turn; no committed chase contributes zero power.
The old V94 chase still sums the separate team capacities, so this
candidate has not yet changed the race. It needs integration with the
committed pursuit decisions, full rider work ledger, relative clock and
independent source validator before it can be assessed as a motor version.

The candidate is now connected behind an opt-in V94
`chaseTurnVersion: 1`: all selected chasing helpers rotate one exposed
turn at a time. Their turn-weighted contributions, named shares and
paid energy enter the actual attack/chase gap clock and recording.
The source validator checks the complete turn arithmetic and helper
reserve; full V94 replay rejects changed work. Historical versions and
guided V93 remain unchanged. A worker unable to pay the full kilometre
work refuses the experimental race.

This is **not calibrated**. In 16 same-seed, source-replayed 120-km
flat/mountain fresh/tired cases, all opt-in races replayed, but the
widest break lead rose from 44–119 seconds under summed team capacity
to 120–330 seconds under sequential chase. The front survived in all
16 opt-in cases, versus one of the 16 old races. This demonstrates
that the old recovery-seconds-per-capacity coefficient cannot simply
be reused with a single-leader capacity. Do not route this version to
guided racing or infer realistic catch frequency from it. The chase
decision still uses the prior potential-coalition estimate; the
physical pace and that decision need joint calibration from paid
rider/terrain ability and observed contact, not a static multiplier.

A read-only gap-ledger audit of those 16 opt-in races isolates 874
kilometres with a paid chase turn, an existing front gap and no fresh
attack. Across those kilometres, the recorded passive road calculation
adds 1,663.94 seconds to the gap while the legacy capacity-to-seconds
formula credits the named chase leaders with only 496.61 seconds. In
355 of the same kilometres, a separately paid bunch-front pace also
enters the passive road calculation. Recomputing the named chase
leaders' terrain and energy adjusted `chase` abilities from the
committed riders shows their turn-weighted ability exceeds that
separate paid bunch-front ability in all 355 such kilometres. The
current clock still treats the chase as an additional capacity credit,
not as that rider's physical pace. The total is diagnostic, not a
new finish prediction: the terms are capped per kilometre and later
attacks and contacts are outside this subset. It shows exactly why
merely paying one rotating chase leader while retaining the old summed
capacity clock makes the front survive. The next motor version should
derive the chasing group's relative pace from its actual exposed
leader, terrain and energy, and count any paid bunch-front work only
once. It must then recompute team pursuit decisions against that same
road model and validate contact and full source replay.

An isolated `chase-road-pace-v1.mjs` planner now reconstructs each
named chase leader's terrain- and energy-adjusted ability from the
committed rider source and kilometre-start reserve, then weights it by
the exact paid turn length. It rejects a changed rider, reserve or
incomplete/duplicated turn and assigns no pace without a paid leader.
It does not yet move the bunch, replace the old capacity credit or
combine simultaneous chase and front-work leaders into one rotation.
Doing so directly would double-count exposed road work; this remains
an internal source-checked building block rather than a race version.

An isolated `peloton-front-turns-v1.mjs` candidate now combines paid
chase helpers and the separately committed two-worker bunch-front pair
into one non-overlapping, one-kilometre leader rotation. It reads each
worker's actual committed rider, energy, terrain and source order,
charges only their exposed turn, and weights both road ability and
chase contribution by distance led. A worker cannot occupy both jobs;
no committed workers means no paid pace. This closes the double-counting
problem in the candidate plan itself. It is not yet wired to the race
clock, pursuit decisions, energy ledger or source replay, and has no
effect on guided races or existing recordings.

The read-only combined-turn audit replayed 16 independent 120-km V94
sources (flat/mountain, fresh/tired, four seeds) through this planner:
all 1,920 recorded kilometres had exactly one paid exposed leader with
no overlap or uncovered distance. A chase and a separate team's
front-work pair were both committed on 359 kilometres; 529 had chase
only and 1,032 had front work only. This is a structural feasibility
check, not a race outcome. The existing race still charged and credited
those two jobs separately. The planner must enter the actual energy
ledger and relative road clock in a new opt-in version, with full
source validation, before its effects can be assessed.

That shared plan is now connected behind an additional **opt-in** V94
`pelotonFrontTurnVersion: 1`, which requires the existing named chase
and two-worker front-turn versions. The actual energy ledger charges
only the combined plan's exposed shares; the separate plans remain
recorded as source proposals. The relative gap clock uses its one
turn-weighted leader ability as bunch pace and removes the old
additional chase-capacity time credit on kilometres without a fresh
attack. A fresh launch simultaneous with a paid pursuit is explicitly
refused until the launch and moving-bunch clocks have one contract.
The source validator reconstructs the shared plan from committed
riders, orders, terrain and pre-kilometre energy, checks the paid chase
share and relative gap, and full replay rejects a changed leader.
Historical recordings and guided racing retain their old versions.

In 16 same-seed, source-replayed 120-km flat/mountain fresh/tired cases,
all shared-version races completed without a validator refusal. Their
widest leads were 51–248 seconds, compared with 108–327 seconds when
separately rotating chase and front plans retained the old chase credit,
and 44–119 seconds in the prior summed-capacity motor. The front still
survived in all 16 shared cases. This is a material improvement over
the separate candidate but **not calibrated** for realistic late
catches. In particular, team pursuit decisions still estimate the old
summed coalition's catch time, and the road ability to seconds mapping
remains provisional. Do not route this version to guided races or
production until decisions, fatigue, contact and finishes are tested
together across a broad holdout.

The same 16 sources were then run with **both** the single-leader
peloton plan and the opt-in single-leader forward-group pace
(`roadGroupPaceVersion: 3`). Fifteen validated and replayed; one
correctly refused an unmodeled fresh attack occurring alongside paid
pursuit. Among the 15, maximum leads were 35–82 seconds and a forward
group remained at the recorded line in 14. All 15 first paid a chase
at km 70 of 120, exactly 50 km remaining, despite the first front
appearing at km 5. In a representative fresh flat case, five control
teams were still holding their selective chase at km 69; one-day
protector teams first paid at km 70. This is a decision-clock defect:
the coalition's old summed-capacity catch estimate makes waiting look
safe while the new physical single-leader road often cannot catch.
Simply increasing a speed coefficient would conceal that mismatch.
The next opt-in decision must assess each observed front, remaining
terrain, helper reserves and uncertain other-team participation using
the same paid road model. It must not assign a GC stake to a team with
no recorded classification or automatically command every protector.

An internal read-only `rotationVersion: 3` threat matrix now estimates
the same one-exposed-leader relative road pace: terrain-adjusted front
worker ability, the lower-quartile bunch baseline, actual chase-helper
turn shares, and the V94 passive-gap coefficient. Extra riders extend
the possible rotation and energy reserve; they do not add simultaneous
speed. The observer keeps exact own riders but bounded rival skill and
energy estimates. For this version, rival future work orders are not
read from the source: a neutral steady/selective potential order is
used and the nominated/conditional coalition marks uncertain team
participation. This is an *all-in potential* calculation, not a claim
that those teams have committed or paid a turn. The historical matrix
versions and actual motor decisions are unchanged.

A four-case, source-replayed 120-km flat holdout inspected the matrix
at km 10, 20, 30, 40, 50, 60 and 69. In seed 1 fresh, the observed
front moved from nominated catch capacity at km 10-20 to conditional
capacity at km 30-40, then beyond even conditional potential at km 50;
five control teams were still holding their chase. The tired version
crossed that last boundary by km 40. Seed 2 fresh stayed inside the
nominated potential through km 69; seed 2 tired was beyond all potential
already at km 10. These bands are diagnostic only. The future decision
still needs a committed sporting stake, an explicit choice of which
team spends energy and when, bounded uncertainty in willingness, and
same-source contact and finish calibration. The matrix must not be
silently substituted for the old decision clock.

A separate read-only rider-kilometre coverage audit sampled the same
joint physical V94 candidate on 120- and 260-km flat/mountain routes,
fresh and tired. Seven of eight sources replayed; one 120-km tired
mountain source correctly refused a fresh attack simultaneous with paid
pursuit. Each replayed frame had an energy-ledger row for all 160 riders.
The recorded forward-group participation decision covered only riders
already in a forward group at the start of the kilometre; a newly
attacking rider first appears in the next selection. On the 260-km
flat fresh and tired sources, respectively, 146 and 228 rider-kilometres
ended in the `dropped` state and **zero** had a dropped-rider choice or
paid rear-group contact. Energy accounting therefore must not be
mistaken for the per-rider tactical logic in the requested vision.
These specific 260-km mountain samples produced no dropped end frames;
that does not establish realistic mountain survival. The next rear
group version needs a physical transition and paid contact source before
it can assign a shared wheel, rotation, shelter or finish pace.

The same read-only audit now accepts bounded `--seeds=N` and a compact
`--summary` output. Three independent holdout seeds across the same
120/260-km, flat/mountain, fresh/tired matrix produced 22 replayed
sources and two honest shared-road-clock refusals. The 22 sources had
668,800 rider-kilometre energy rows, but only 26,963 explicit forward
participation decision rows. They recorded 2,344 dropped-state
rider-kilometres and zero dropped-rider participation decisions.
The forward count is one kind of decision, not a count of every other
team or attack choice; the contrast still proves that complete energy
rows cannot establish a decision for every rider every kilometre.

An isolated `rear-detachment-v1.mjs` candidate now links the committed
climb choice to one paid 1-km road step. It requires an explicit
contiguous bunch leader turn plan whose weighted ability matches its
recorded total; the rider starts in bunch contact and uses their own
terrain, energy and chosen effort. Trying to hold can still produce a
positive solo time gap if the rider cannot match the bunch. A deliberate
energy-saving release requires the already versioned future-stage plan;
an invalid plan or unaffordable hard kilometre refuses. An attached
rider receives the same draft ability as the bunch and a provisional
20% lower work cost than an exposed rider. The work price and ability
to seconds conversion are experimental and uncalibrated. The output
records the first solo gap and route kilometre distance boundaries
(the route segment's `startM`/`endM` are elevations), with source
replay/tamper rejection, but does not infer a later meeting, share a
wheel, give a finish time, or alter V93/V94. The paid bunch turn source
must itself have been validated by its existing full-race validator
before this isolated candidate can be connected to a recording.

The initial audit attempt with the legacy synthetic `terrain: mountain`
template found **zero** `climb` kilometres in three completed 260-km
sources: its long profile slopes are all below the route's 5% climb
classification. This template cannot test early mountain shedding.
The follow-up therefore used the existing seeded 13-anchor mountain
profile generator as a committed custom route, without changing old
templates. Four 260-km, 20-team V94 physical-road sources validated and
replayed; 282 of their 1,040 route kilometres were classified `climb`.
On 281 climb kilometres a source-paid bunch leader plan was available.
Among 33,143 eligible *rider-kilometre counterfactuals*, the new entry
step yielded 16,604 exact bunch-contact outcomes, 16,481 small positive
gaps held as unresolved wheels, and 58 gaps beyond the provisional
three-second separation gate. Forty-eight of those 58 riders remained
`peloton` in the existing recording and ten were marked `dropped`.
These are repeated per-kilometre trials, not 58 distinct riders or
official drop events. The disagreement confirms that this candidate
and the existing provisional bunch-membership model are not a
calibrated common physical clock. No rear-group contact or draft benefit
is inferred from the trial, and it must remain off the playable route.

An isolated `rear-solo-road-v1.mjs` now accepts only the exact positive
gap and paid reserve from the detachment step (or its own previous
step), plus a complete source-paid bunch turn plan for the next
kilometre. The rider explicitly chooses conserve, steady or hard
effort and a `finish_safely` or `rejoin_bunch` reason. Terrain-adjusted
solo ability and the recorded bunch leader produce two travel times;
the rider pays energy through either the full kilometre or the
calculated within-kilometre bunch contact. A contact stops at its
distance marker and does not grant the rest of the kilometre for free.
Source replay rejects changed energy, leader turns or position, and
unaffordable work refuses. The absolute speed conversion remains a
candidate; the model is not connected to historical V93, playable V94,
or official finish times. It also cannot merge two rear solos without a
separate, equally paid physical contact step.

The four generated-mountain sources above supplied a valid paid bunch
turn at the following kilometre for all 58 counterfactual solo entries.
The solo continuation replayed and paid all 58 conservative next steps;
all remained behind for that one kilometre and none rejoined or ran
out of energy. This only tests a two-kilometre chain against the source
road; those riders were not moved in the recorded tour. Later source
orders and energy would diverge if the candidate were actually routed,
so a full-race branch with its own state and validator is still needed.

The same four replayed generated-mountain sources now test *separate*
pairwise next-kilometre rear-contact counterfactuals. Among 58
candidate solo entries, 122 rider pairs had ordered positive gaps and
93 pairs had equal modelled gaps, for which this two-solo contract cannot
establish who follows whom. When both ordered riders chose conservative
finish pace, all 122 pairs stayed separate. When the rear rider instead
chose hard effort to rejoin while the front rider conserved, all 122
separate pair calculations reached a paid contact in the next
kilometre; every source replayed and none exhausted its rider.
These pair calculations are mutually incompatible alternatives—one
rider occurs in many pairs—and cannot be combined into 122 real group
meetings. The all-or-none result shows that the provisional pace and
individual decision need calibration and physical simultaneous-group
resolution before this candidate is routed. No contact was inserted
into an actual race or viewer.

`rear-source-contact-v1.mjs` now joins two *separately source-replayed*
rear solo states, derives both solo speeds and costs from their riders,
energy, terrain and explicit effort, and recalculates an exact paid
within-kilometre meeting against the same validated bunch turn plan.
Forged prior positions, changed prior energy, invalid bunch turns and
an unaffordable kilometre refuse. Its output contains the reconstructed
solo-contact input so the earlier isolated rear-group continuation can
verify the same meeting before granting any shared shelter. The group
continuation's leader speed and cost are still caller-supplied; those
must be derived from committed rider decisions in a further version.
This contact chain remains isolated from actual V94 dropped riders and
does not establish a finish time or group membership in a real race.

`rear-source-group-v1.mjs` now takes that verified solo contact and two
explicit rider choices for the remaining slice. A selected rider must
have chosen `pull`; their terrain, energy and effort determine speed
and exposed cost, while the other rider pays a lower individual
sheltered cost. The existing continuation recomputes the same contact
before forming a two-rider group; it records the group's clock and
refuses unpayable work or a leaderless plan. Full source replay rejects
changed rider choices, contact or energy. This is a genuine one-leader
paid first turn in the isolated chain, but the choice source is still
explicit input rather than autonomous whole-race rider logic. Later
turns and merges remain outside this version.

The separately versioned `rear-group-choice-v2.mjs` replaces
caller-selected first-turn
choices in an isolated branch with a reproducible rider decision. It
reads each rider's explicit rear goal and distinct `rearWork` directive,
current committed effort order, remaining energy and recorded teammates
in a group further ahead. The existing breakaway `breakWork` order is
never silently reinterpreted for a rear group. A rider can sit because
of a rear directive, a teammate ahead,
insufficient energy or a valid future-stage reserve plan. A cooperative
rider with a `finish_safely` or `rejoin_bunch` goal can take a paid turn;
an explicit rear drive directive can override energy-saving intent if
affordable.
The willing roster alone determines the first leader. If both riders
decline, the version refuses instead of silently inventing a puller.
The exact choices, reason, leader, road and energy replay from the
contact source. This still handles only a two-rider first-turn branch,
not a whole-race goal policy or rear groups of arbitrary size.
The earlier isolated v1 contract remains available for replay, but it
interpreted a breakaway work order as a rear-group order. V2 requires
the new explicit `rearWork` directive and must be the basis for any
future routed rear-group version.

The isolated `rear-group-source-road-v1.mjs` extends that exact two-rider
contact one further kilometre. It replays the prior contact and first
turn, requires the next physical kilometre and the same rider roster,
then recomputes each rider's willingness from a distinct `rearWork`
directive, current team effort, energy and any teammate ahead. One
willing rider leads; the other occupies shelter even when willing to
take a later turn. The route and rider physiology determine pace and
each rider's exposed or sheltered energy price. A paid bunch turn plan
sets the reference clock. The result includes the actual gap, energy,
and any calculated bunch contact marker, all recomputed by source
validation. A group with no willing leader refuses.

This is a one-kilometre, two-rider continuation. The new rear directives
are explicit inputs to the isolated experiment rather than committed
whole-race orders. Larger groups, recruitment, changing team stakes,
stage finish and official classification remain outside this contract.
It does not enter guided races or alter prior recordings.

The opt-in `rear-group-source-road-v2.mjs` adds a physical hold check to
that replayed kilometre. Each rider away from the front must be able to
match the one paid leader's speed at their chosen effort with a draft
allowance. The existing climb witness, with a hard-working leader and
conserving follower, now refuses because the follower cannot hold;
switching the named leader to the slower willing rider produces a paid,
replayable group road. The old V1 recording stays unchanged. V2 stops
when a follower cannot hold; it does not create a split, rear contact
or finish from an unrecorded road.
`rear-group-source-run-v2.mjs` applies that check again after each paid
kilometre, using the next kilometre's own member choices, leader and
remaining energy. Its two-kilometre source replays; changing the
second kilometre's rear directive so the faster rider leads makes the
conserving follower fail the hold check. The older consecutive V1
recording remains available for historical replay.
The analogous opt-in three-rider `rear-group-source-step-v3.mjs` and
`rear-group-after-join-run-v2.mjs` apply the hold check after a paid
third-rider join, including after later leader changes. The existing
strong-leader example refuses when a conserving follower cannot hold;
a slower willing leader permits two replayed paid kilometres. These
gates protect the already recorded group from an impossible free wheel.
They still stop before a newly detached rider's solo road is known.
An even narrower two-rider branch,
`rear-group-follower-split-v1.mjs`, now replays the same paid group source
when its follower cannot hold. The named leader keeps the exposed cost;
the follower instead pays a full solo kilometre at their own chosen
effort. Constant source-derived speeds determine their separation and
the distance where it crosses the existing dropped threshold. The
focused climb witness produces two paid solo states behind the bunch
and rejects a forged energy trace. A smaller separation remains an
unresolved wheel gap, and any bunch contact requires a separate road.
This branch does not silently let the old two-rider group continue or
create a finish time.
`rear-split-solo-road-v1.mjs` replays that split and takes both named
riders one further kilometre as separate solos, each with an explicit
effort and goal and their own energy charge. The focused climb witness
keeps both behind the bunch with the former follower farther back.
A forged split or duplicate choice fails replay; a potential meeting
with the bunch or between the two riders requires a separate physical
contact road. This is one more paid kilometre, not a full rear finish.
The flat-versus-climb same-source check changes road speed but currently
charges the same isolated solo energy at the same chosen effort. The
whole-race work demand has a terrain-load term; these rear prototypes
have not yet carried that term into a versioned, fully reconciled
ledger. Their positive energy charges are accounting witnesses, not
calibrated climbing costs, and block routing or finish claims.
At the focused 6% gradient, the whole-race base-work multiplier would
be 1.21 before other costs, while the isolated follower solo still uses
1.00. A later paid version must reconcile the full leader and shelter
ledger, rather than patch only the follower's final reserve.
`rear-energy-demand-v1.mjs` now provides a separate opt-in price for a
known rear-road role and distance. It applies that terrain load to both
the exposed rider's and sheltered rider's base effort, keeps the
exposed leader's extra work and the lower draft fraction, and refuses
unpayable work. Flat and 6% climb comparisons and source replay pass.
This is a pricing primitive, not a replacement for the existing rear
road records: it does not carry the whole-race energy cap, recovery,
route-wide prior reserves, or a source-bound postcontact continuation.
It cannot yet be routed or used to claim a finished rider.
`rear-group-source-road-v3.mjs` applies that price to both riders over
the distance actually travelled on the replayed two-rider V2 road.
It retains V2's hold decision, named leader, speed, contact marker and
historical record while recording lower terrain-priced balances for
both roles on the 6% climb. The flat road agrees with V2's charges.
This is a separate opt-in one-kilometre road; its new balances still
need a source-bound following kilometre and whole-race cap/recovery
settlement before they can replace any routed state.
The read-only generated-profile rear-entry audit (`--generated-profile
--seeds=8 --pace-climb`) replayed and validated 28 of 32 full 20-team,
260-km V94 cases. Four cases honestly refused their combined fresh
attack and pursuit clock. The accepted cases had 386 newly labelled
`dropped` riders, 377 on climbing kilometres. All 386 had a positive
checkpoint deficit already in the previous kilometre; none had a
recorded bunch-work or caught-break event in that or the preceding
kilometre. All 377 climb snapshots admitted the separate opt-in
pace-loss solo calculation, but that cannot establish their initial
physical detachment or contact with another rider. These checkpoint
labels therefore cannot seed a rear group, a wheel, or an actual finish
clock. The race source needs explicit paid crossing and subsequent
contact evidence before rear routing.
`rear-split-solo-run-v1.mjs` extends that exact split through consecutive
solo kilometres. Each rider has a fresh explicit choice in each kilometre,
with a separate energy and bunch-gap calculation; the source replay
rejects altered later energy. A changed second-kilometre effort changes
the rider's resulting reserve. The run refuses a skipped kilometre or
any meeting between the solos or with the bunch until a contact road
can be paid. No stage finish or time limit is inferred.

For a three-rider group rotating within a kilometre,
`rear-group-turn-kilometre-v2.mjs` checks every sheltered rider against
the actual named leader in each paid slice, using that rider's reserve
at the start of the slice. The existing alternating-leader witness
refuses when a conserving rider cannot follow a stronger leader;
with one slower willing leader, all slices replay and pass. The V1 turn
recording is unchanged, and a failed hold still needs a separate paid
split road.

`rear-group-source-run-v1.mjs` chains that same derived calculation
through consecutive whole kilometres. Each step uses the prior paid
group gap and energy, a new terrain segment and bunch turn record,
and that kilometre's explicit rider goals and team effort. It refuses a
missing kilometre, forged prior contact, changed rider statistics,
caller-supplied replacement group, or continuation after a recorded
bunch rejoin. The complete sequence replays and rejects altered rider
energy or turn evidence. This is still a bounded two-rider experimental
chain. It lacks a committed whole-race source of rear directives. The
run itself cannot accept a third rider or handle a caught break rider
falling through the bunch.

An isolated `rear-solo-source-run-v1.mjs` now chains an occupied-wheel
departure through successive, fully paid solo kilometres without
granting group shelter. `rear-group-solo-join-v1.mjs` replays that solo
and the separate two-rider rear-group road, then calculates whether the
solo catches the group during the next kilometre. In the accepted
three-rider example the solo began farther behind the bunch on a climb,
then used a stronger flat-road ability to reach the existing group at
a computed marker. The original group keeps exactly one leader to the
marker; its other rider shelters and the incoming rider pays solo work.
Only those fractions of the kilometre enter the actual energy ledger.
The result records a three-rider group at contact, with all prior group
and solo energy source-replayed. It refuses a forged rider, forged
prior energy, no contact or simultaneous bunch contact. Full-kilometre
pace proposals in the evidence are not charged past the meeting point.
`rear-joined-group-continuation-v1.mjs` replays that contact and asks
all three riders again whether they will pull or sit. The next willing
leader in physical rotation takes the wind for the remaining metres;
the other two pay their own lower sheltered charge. Their three energy
balances and the shared clock advance together to the kilometre end,
or stop at a calculated bunch rejoin. A leaderless or unpayable turn
refuses. A changed contact, choice or energy fails source replay.
`rear-group-source-step-v2.mjs` and
`rear-group-after-join-run-v1.mjs` now carry that same three-rider
group through consecutive later kilometres. Every kilometre takes
fresh explicit rider choices, terrain, current energy and a paid bunch
turn record; the next willing leader follows the previously recorded
leader in the actual group order, including when someone newly declines
work. One rider takes the wind, two shelter, and their individual paid
energy and the shared gap feed the next step. The run replays the full
join chain and refuses a forged starting group, changed roster, missing
kilometre, leaderless group or continuation after bunch contact.
Further joins, split departures, and real race finish times remain
outside this isolated version. The new `rearWork` goals are still
caller-supplied evidence rather than committed whole-race orders.
Neither this candidate nor the preceding rear-road modules are routed
to a whole race.

`rear-group-turn-kilometre-v1.mjs` is a separate opt-in continuation
from a replayed three-rider rear-group step. At the next kilometre it
asks each rider again, then assigns equal road-distance turns to the
willing riders in physical rotation after the previous leader. The
recorded bunch turn boundaries and these rear turn boundaries split the
kilometre into short slices. Exactly one rear rider leads each slice;
the others shelter at a lower energy cost. The source rider, effort,
terrain and remaining energy determine the rear pace at each turn, and
the paid bunch turn determines its opposing pace. Every slice records
each rider's energy and the gap. A calculated bunch contact ends the
rear group at that marker. A rider unable to pay a turn causes refusal;
replay rejects a forged previous leader or any altered energy. Equal
distance turns are a deliberately explicit candidate scheduling rule,
not a claim about real races or a calibrated default. It still needs
committed whole-race rear goals, realistic turn timing, additional
joins and split handling, then broad finish and source validation.

`rear-goal-commitment-v1.mjs` removes one source ambiguity from that
isolated turn experiment. It requires an explicit pre-race intention for
every named rider: a finish/rejoin/future-stage goal, a separate rear
work directive, and any route-marker changes. A future-stage motive
needs a committed target stage and reserve. No break-work or chase
order is silently interpreted as rear work. At each kilometre, the
intention active after the previous marker is read for the actual
three-rider group; then current energy, team effort and teammates
further ahead still determine who is willing to pull. The wrapper
replays both the commitment and the paid turn trace, rejecting a
forged rider choice or energy. This remains an opt-in source contract:
the live race preparation and user interface do not yet collect these
intentions for all riders, and the equal-distance turn scheduling and
finish road have not been calibrated.

`rear-recorded-bunch-source-v1.mjs` can now take an actual v94 race
kilometre as the opposing bunch road. It first validates and fully
replays the locked race, requires a worked shared peloton turn plan,
and refuses a bunch leader who also belongs to the proposed rear
group. This binds the bunch turn abilities and named workers to the
recorded source instead of accepting a free numeric pace. In six
source-replayed generated mountain-profile races (two other generated
cases refused the already known combined attack/pursuit limitation),
all 112 first recorded dropped transitions had a worked peloton turn
in that kilometre. The recorded dropped deficit is still a checkpoint,
not physical rear-group contact or a complete within-kilometre wheel
trace. A rear-road counterfactual cannot borrow a physical position
from it; no candidate is routed to the real race on this evidence.
An expanded six-seed generated-profile audit reached 21 fully replayed
races and refused three on the existing combined attack/pursuit guard.
All 311 new dropped transitions had a paid bunch turn at that
checkpoint; 306 occurred on recorded climbs. None of these 311 were
recorded as bunch workers or just-caught break riders in the same or
preceding kilometre. These samples establish a usable opposing bunch
source for climb-drop experiments, while leaving the other two rear
entry paths untested in this holdout.
By contrast, a separate eight-seed legacy-profile audit replayed 32
cases and found 51 new dropped-state transitions. None had a worked
shared bunch-front turn at that checkpoint, and none followed a
recorded bunch worker or caught break rider in the same or preceding
kilometre. Those checkpoint labels cannot provide physical rear-entry
positions or a paid bunch-turn source; they must not be used to infer
rear-group contact.

`road-group-sprint-choice-v1.mjs` is a separate opt-in answer to a
specific forward-group question: a rider with an explicit stage-win
goal can decline a late turn if their own known sprint is weaker than
the observer's estimated rival sprint. The estimate includes a bounded
range and does not expose the rival's exact hidden ability to the
decision. A committed `drive` order can override that shelter motive;
a teammate further ahead or insufficient remaining energy can stop a
turn. The decision record includes each rider's observed rival ranges
and reason, and source replay rejects altered choices. The existing
single-leader road-group turn planner accepts the resulting willing
pullers and charges the named leader more than the sitter. This is an
isolated tactical branch, not a full road transition or a replacement
for the current V94 group decision policy. Its late-sprint window and
effect on race outcomes need calibration against whole races.

`team-chase-choice-v1.mjs` is an opt-in one-kilometre timing decision
for a team with an explicit sprint or summit stake and an actual
committed chase order. It assesses each existing front group
separately through that team's bounded rider observations, its own
known helper roster, and a deliberately uncertain set of other teams
that might help. The other teams' private future work orders remain
hidden. It compares whether the nominated chasers can still catch if
they begin now or wait one kilometre. The result can be `watch`,
`commit_now`, `request_help`, `commit_and_request_help`, or
`capacity_shortfall`, with both capacity headrooms recorded. Asking
for help never adds those riders to the actual paid road. The
one-kilometre witness test shows a gap where delaying changes the
perceived catch from possible to impossible. Adding a weaker
conditional helper need not increase instantaneous catch headroom:
only one rider leads at a time, although a larger roster can spread
future fatigue. This is still a forecast, with caller-supplied team
stake and coalition, not a calibrated or executed chase policy.
Focused same-source comparisons also show that replacing the remaining
flat road with climbs increases the chase headroom against a
climbing-weak escape, while reducing the chasing roster's energy and
raising its fatigue, or removing its helpers, reduces that headroom.
Those changes come from rider/route work estimates, not scripted gap
awards. They do not establish realistic catch rates.

`team-chase-stake-v1.mjs` gives that isolated timing choice an explicit
roster-bound sporting source. Every team names a captain and a goal
before the simulated start: sprint finish, summit attack, break-stage
bid, or none. Changes can be committed only at order markers and apply
from the following kilometre. Only an active sprint or summit goal can
enter the opt-in chase choice; a contemporaneous chase order must also
allow pursuit. A changed captain, goal, team roster, or timing decision
fails replay. The source is a caller-provided commitment snapshot,
not yet a saved whole-race order or an authenticated in-race manager
event. It creates no GC objective from a stage label and neither
guarantees allied help nor charges any energy by itself.

`isolated-paid-chase-road-v1.mjs` connects one urgent committed-team
choice to one actual kilometre of named pursuit. It replays the team
stake and forward riders' decisions, then selects only the observing
team's available helpers. Existing front and chase turn planners set
sequential leaders. The union of their turn boundaries divides the
road into short slices: one rider leads each physical group, the
others modeled in that group shelter at lower cost, and each rider's
remaining energy changes after every slice. Rider/terrain effects
determine both speeds; a calculated contact stops at its actual route
marker and pays only the distance reached. The witness test covers a
full kilometre and a separate late contact inside the kilometre.
Conditional allies are explicitly unpaid. This is still only a
bounded two-group counterfactual: other peloton riders' energy and
speed, post-contact movement, multi-front interactions and the race
finish remain unresolved. It cannot produce official results or run
inside guided races.

`isolated-caught-front-slide-v1.mjs` adds one explicit post-contact
branch to that paid chase road. It accepts only a source-replayed catch
of one named front rider before the kilometre ends. The caught rider
chooses conservative solo finishing; the branch checks that their hard
road ability cannot match the next named bunch leader. The bunch's
chase helpers continue their one-leader turns, sheltered helpers pay
less, and the former front rider pays solo work from the exact catch
marker. Their clock can move behind the bunch without a free wheel or
instant rear-group membership. Unpayable work, a forged catch, or a
rider who could hold the bunch refuses. This is an isolated one-km
path, not a claim that recorded V94 catches have a known within-km
contact marker or that the rider finishes the race.

`isolated-paid-chase-run-v1.mjs` carries the same committed stake and
one observed front across consecutive urgent pursuit kilometres. It
recomputes the team's perceived catch decision and the front rider's
work choice each kilometre, copies only the energy actually paid by
named front and chase workers into the next source, and replays every
individual paid road step. In a focused two-kilometre witness, the
first committed chase does not yet catch the break; the second uses
the updated gap and helper energy and reaches a calculated contact.
The source-replayed caught-rider slide can then start at that exact
marker. This run refuses a `watch` decision rather than manufacturing
an unpaid intermediate road. It explicitly lists unmodeled peloton
riders, stops at contact, and has no official results. Long neutral
periods, new attacks, changing ally willingness, the rest of the
peloton's energy and the finish are outside this version.

`rear-unpayable-climb-v1.mjs` covers a distinct isolated entry path:
a rider starts with an occupied bunch wheel but cannot fund a whole
kilometre of hard climbing. A paid bunch turn plan provides the opposing
road. The rider holds until either their available energy can no longer
fund hard shelter plus the remaining solo climb, or the next named
bunch turn exceeds their own hard climbing ability. The first such
event determines the loss-of-wheel marker. From that marker the rider
pays conservative solo work against each remaining bunch turn; their
relative clock and energy are recorded slice by slice. If even the solo
kilometre cannot be paid, or the proposed solo would keep contact, the
contract refuses. The result distinguishes physical inability from the
separate, already modeled voluntary release for a committed later
stage. This is one climb only: an end-of-kilometre zero reserve does
not imply that the rider can finish the race, and a sub-threshold gap
remains an unresolved wheel rather than an invented rear group.

A read-only six-seed generated-profile V94 audit put that low-energy
entry in context. Of 24 flat/mountain and fresh/tired 20-team 260-km
sources, 21 fully replayed and three retained the existing simultaneous
attack/pursuit refusal. The replayed races recorded 311 first dropped
transitions, 306 on climbs. All 306 had a worked bunch turn and a prior
peloton *snapshot*, but none had energy below the candidate whole-km
hard sheltered cost. The new unaffordable-climb branch therefore
explains **zero** of these recorded transitions. Some prior snapshots
already carried a small deficit, so they do not prove an occupied wheel
at the next kilometre start. The predominant climb-drop path still
needs a separately modeled physical ability/pace loss with an actual
wheel trace; the isolated low-energy witness is no substitute for it.

`rear-pace-climb-split-v1.mjs` is a separate opt-in pace-loss candidate
for a rider who **chooses to hold** and can fund the projected hard
sheltered kilometre. It compares that rider's terrain and energy based
hard climbing ability with each named paid bunch turn. If a later turn
first exceeds the rider's hold ability, the occupied wheel is lost at
that turn boundary. The rider must then choose and pay a solo effort;
each remaining slice records pace, energy and the clock behind the
bunch. A matchable bunch, a voluntary future-stage release, an
unpayable solo, or a solo clock that immediately regains the bunch
refuses. A small positive gap remains unresolved rather than creating
an invented rear group. This is an isolated within-kilometre contract:
the recorded V94 peloton snapshot does not prove a physical occupied
wheel, and no version is routed into whole races or official finishes.

The same 24-case read-only audit applied this opt-in pace-loss candidate
to each of the 306 recorded climb transitions using the rider, prior
energy and that kilometre's paid peloton turns. All 306 counterfactuals
paid their chosen conservative solo road and exceeded the existing
dropped-gap threshold. **None** had zero prior checkpoint deficit:
every source rider already carried a small positive deficit while
still labeled `peloton`. Thus 306/306 is a conditional calculation
*given an occupied wheel*, not evidence that those wheels existed or
that this version reproduces 306 real drop trajectories. No original
V94 recording or guided outcome changed. A future motor must record
the wheel and exact loss event before connecting this pace branch.

The pace-loss output can now serve as a separately replayed prior solo
source for a later physical rear-rider meeting. A focused witness uses
abilities no higher than 100: the rider loses a paid climb turn, then
meets another already detached rider on a later kilometre at the
computed contact marker. The meeting pays both solo riders to that
marker and rejects an altered split point or rider statistics. This
does not establish that any of the 306 V94 snapshot transitions had
the required occupied wheel or that any two of them actually met.

`rear-unpayable-solo-run-v1.mjs` source-replays that within-kilometre
climb split before a rider can enter consecutive, paid solo kilometres.
It refuses a sub-threshold wheel gap, a forged split marker, a changed
rider or a skipped kilometre. This still does not establish physical
contact with another rear rider or a finish time.

The isolated `rear-source-contact-v1.mjs` now accepts this replayed
climb split as one of its paid prior solo roads. A later rider may
reach another dropped rider only at the calculated contact marker;
forging the earlier wheel-loss marker is rejected. The focused witness
has two distinct source riders, one unable to hold the climb wheel,
then a later paid solo contact. It does not infer contact from a shared
kilometre snapshot or attach the group to guided races.

`isolated-paid-chase-slide-run-v1.mjs` composes a source-replayed
consecutive paid pursuit with the caught front rider's explicitly
chosen, source-replayed postcontact road. It settles the named chase
workers and caught rider through the end of the contact kilometre,
carrying their paid energy into a separate final ledger. A focused
two-kilometre case starts with a gap too large to catch in the first
kilometre and reaches contact in the second. The remaining road leaves
only a small positive wheel gap, so the status remains
`wheel_gap_unresolved` and **no dropped-rider event** is recorded. The
version still lists unmodeled peloton riders, stops at that kilometre
and withholds official results. It refuses unobserved `watch` kilometres
and does not manufacture the full bunch road or a later rear group.

`isolated-paid-control-road-v1.mjs` covers one distinct kilometre in
which an observer with a committed sprint stake chooses `watch`, while
another team has explicitly ordered a **named** helper to rotate at
the bunch front. That single worker pays the whole exposed control
kilometre; the front rider also chooses and pays their own work. Their
source-derived speeds update the physical gap and can yield a
calculated contact. The unit refuses a missing worker, conflicting
attack or chase order, unavailable worker, another ordered front-work
team, or a mismatched perception source. The focused witness records
the gap growing under a weaker paid control helper, while the sprint
team waits. Other bunch riders have no energy ledger here. This is
neither a free `watch` road nor a whole-race control policy, and it
does not yet compose with the later paid pursuit run.

`isolated-paid-control-run-v1.mjs` continues this narrow watched road
kilometre by kilometre. It recomputes the sprint team's *perceived*
catch choice and the front rider's work choice from the updated gap and
only the energy that the two named workers actually spent. In a focused
30-km-route witness, a weak named controller pays multiple kilometres
while the sprint team watches. When the observer's next decision becomes
`commit_now`, the run records an exact source replayable handoff **before**
advancing that kilometre; it does not quietly replace the controller
with unpaid pursuit. It still cannot settle the rest of the peloton or
carry that handoff through combined control and chase work.
The same synthetic seed and route with a stronger paid controller
instead reaches the front before the sprint team's handoff; making
that controller fatigued and low on energy delays the calculated
contact. All three isolated traces replay, but the fixture has only
three teams and one named worker, so these are mechanism checks rather
than whole-race calibration.

`isolated-paid-cooperative-road-v1.mjs` models the first kilometre
after that weak-control case triggers a committed sprint-team chase.
The same named controller and the actual available chase helpers take
disjoint shares of **one** bunch-front position. The current leader
sets each slice's pace; their abilities are not summed. Every named
worker pays exposed work on their turn and a lower sheltered cost on
the other turns. The front rider also chooses and pays their own road.
The focused witness shows three distinct bunch turns and no contact in
that first chase kilometre. It refuses an absent controller, conflicting
order, missing payable chase helper, or unworked front. The separate
`isolated-paid-control-chase-handoff-v1.mjs` replays the entire earlier
watched run before allowing this shared kilometre, carrying the exact
paid gap and energy forward and rejecting a forged control reserve.
This remains an isolated three-team source trace. Other bunch riders,
later cooperative kilometres and finish results are unmodeled; neither
version is routed to guided races.

`isolated-paid-control-chase-run-v1.mjs` now re-evaluates the same
observer's uncertain threat decision and the front rider's work choice
each successive kilometre, using the gap and named workers' energy
paid in the previous one. It chooses the single-worker control road
for `watch` and the shared control/chase turns for a committed chase.
In the same weak-controller three-team fixture, the observer waits,
then commits helpers for several kilometres, but eventually reports
`capacity_shortfall` with the break still ahead. The run stops **before**
moving that unsupported next kilometre. Each prior control and
cooperative road step replays; a forged gap fails validation. A strong
controller in the same synthetic seed catches the front earlier, while
fatigue delays that contact. This is a real paid tactical mechanism for
the modeled riders, not a whole-field result: all other riders' choices,
energy, additional road groups and the finish remain unmodeled.
Four further same-seed isolated traces now replay every paid step on
flat and climbing routes, each with fresh and tired rider reserves.
They test the state transition and refusal boundaries, not a realistic
catch-rate distribution or full 20-team race.

The read-only `isolated-paid-road-coverage-v1.mjs` now replays that
control/chase trace and enumerates **missing rider-kilometres**, rather
than merely listing riders never modeled at all. An observer helper
who later takes a paid chase turn was still unmodeled during the earlier
watched kilometres; that missing riding cost cannot be erased by the
later turn. The strict coverage gate rejects this fixture. Even a
future complete energy ledger would still need physical group, contact
and finish validation before official results. The current isolated
trace is not a full-field energy calculation.

`isolated-control-caught-front-slide-v1.mjs` also covers a front rider
caught by one *paid control worker* while the sprint observer still
waits. It replays the exact control catch, checks that the caught rider
cannot hold the named worker's pace, then charges both for the
remaining road. Only when the computed postcontact gap exceeds the
existing dropped threshold does it record that the rider passed
through the bunch into a solo road, at the computed point where the
gap crosses that threshold rather than at the initial catch. The
strong-controller focused
case records that event and rejects a forged energy trace. It does
not grant the rider an unproved sheltered wheel or place them in a
rear group, and the other bunch riders and finish remain unmodeled.

`isolated-control-caught-rear-solo-v1.mjs` then takes that exact
source-replayed slide into the next kilometre. The detached rider
explicitly chooses a conservative solo road while the same named
controller continues paying for the bunch front; their source-derived
speeds and energy update the gap. The focused case remains alone
behind after another fully paid kilometre and rejects a changed energy
ledger. If the solo rider later reaches the bunch, this version stops
at the calculated contact marker. It does not assign a rear-group
wheel or finish time to a rider who has not physically met anyone.
The same source can now drive a consecutive solo run: at every later
kilometre the caught rider explicitly continues a conservative
`finish_safely` road, the named controller's active order is checked,
and both riders pay from the preceding energy state. A focused 20-km
continuation remains alone behind and replays from the original paid
catch; it records the solo rider's elapsed time **since the catch**,
including the paid remainder of the contact kilometre.
It does not have a source for the earlier absolute race clock, so it
does not publish an actual full-stage finish time or invent a time
limit. The other bunch riders still have no ledger.
An explicit next-kilometre `sit_in` order for that controller now
refuses the continuation instead of silently retaining their paid
front role. Another payable bunch leader would need their own recorded
order, turn and source-replayed road.
