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
