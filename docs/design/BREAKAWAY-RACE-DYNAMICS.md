# Breakaway race dynamics: playable target

The 260 km Motor Lab mountain recording exposed a systemic problem: attacks recur, but the front usually stays only tens of seconds clear. This document defines the next bounded motor and viewer change. It does not change existing recordings or claim that the current motor already pays these dynamics.

A read-only baseline can be reproduced with `node scripts/audit-breakaway-dynamics.mjs`. Across three seeds, flat/mountain terrain, and fatigue 0/30 (twelve 20-team, 260 km runs), it records **51–312 attack attempts**, but no run reaches a one-minute front lead; the maximum lead over the matrix is **45.07 seconds**. These are diagnostic samples, not a calibrated distribution. The user's race log shows the same qualitative pattern.

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
