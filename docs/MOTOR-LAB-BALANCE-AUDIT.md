# Motor Lab scenario audit (fictional routes)

Run `node scripts/audit-motor-lab.mjs 20 coast` or `node scripts/audit-motor-lab.mjs 20 ridge` to reproduce these small, deterministic comparisons. Each run simulates scenario numbers 0-19 for the four Amber presets with default orders, a conditional break attack after 40 km, helpers held for the captain, bunch attacks held, selective bunch attacks, attacks held until a selective switch after 120 km, chase helpers held all race, and chase helpers held until an all-out commitment after 120 km. The other three fictional teams, rider cast, route and weather seed are held constant within each paired comparison. The script reads no database and changes no sporting data.

On 30 September 2026, the 20-seed Coast Road run found:

| Amber plan | Default Amber wins | Mean captain place | Mean km with a break | Successful planned attacks after 40 km | Km with multiple groups across 20 attack runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sprint | 4/20 | 3.9 | 20.7 | 0/20 | 0 |
| Break | 1/20 | 5.3 | 112.2 | 19/20 | 38 |
| Balanced | 7/20 | 1.8 | 83.9 | 0/20 | 0 |
| Conserve | 0/20 | 5.2 | 63.4 | 0/20 | 0 |

The conditional order was blocked in all 20 sprint, balanced and conserve runs at that marker because Amber Captain was not in a break. In the break preset, one run was blocked. These are useful checks that the order is conditional and that separate road groups can appear. The 38 multi-group kilometres are summed across 20 races, not a typical race duration.

The matching Ridge Road run found 4/20 Amber wins for sprint, 8/20 for break, 2/20 for balanced and 0/20 for conserve. The baseline mean Amber Captain places were 3.6, 5.7, 7.0 and 5.3 respectively. The 40 km break attack succeeded in all 20 break-preset runs and all 20 balanced-preset runs, creating 20 summed multi-group kilometres for each preset. Sprint and conserve attempts were blocked in all 20 runs. The large shift in outcomes between routes is a reason to investigate terrain, rider archetypes and group tactics rather than tune around one flat fixture.

The audit now also measures break episodes and their longest uninterrupted duration. An episode starts when the road changes from no group ahead to at least one group ahead and ends when all groups are caught; a second group forming during an episode does not count as a new episode. In the coast baseline, sprint races averaged **7.8 separate break episodes** with a longest episode of only **6.5 km**. Break-preset races averaged **12.9 episodes** despite 112.2 km with some group ahead. On the ridge the corresponding values were 9.0 / 14.0 km for sprint and 12.0 / 36.3 km for break. This is a concrete warning that the prototype repeatedly forms and catches moves instead of sustaining a small early break for a long stretch. The metric says nothing about *why* the field chose to chase or whether each catch was tactically justified.

The audit also distinguishes chase activity during an entire break episode from chase activity on its *final kilometre*. Across the 20 coast sprint races, 74 catches ended with a team chasing and 83 ended without one. Yet **all 157 caught episodes had been chased earlier**; none was caught after an entirely unchased episode. The same held for the other three plans and both routes in this sample. A final kilometre without a chaser therefore must not be reported as a passive, unprovoked catch. Early or repeated chase commitment is the stronger lead for the short episodes, while passive bunch-versus-break pace still needs a separate controlled-case test.

That controlled case now exists: in Coast Road scenario 1, Amber holds its chase helpers and Birch uses a conserve posture while Cedar and Dune keep their original attack plans. One break survives **85 consecutive kilometres without a recorded chase**, is then caught, and later moves still form. This proves the kilometre model can represent a sustained break, a catch and a fresh break in one race. It does not prove that the default opponents choose *when* to allow or retrieve a break realistically.

A local sensitivity trial increased the selective chase's safe-gap limit from 10 to 20 seconds (and its distance factor from .06 to .12). Coast sprint breaks then lasted 19.7 km at their longest on average, but a balanced plan with the 40 km break-attack order jumped from 7 to 14 Amber wins in 20 paired seeds; ridge jumped from 3 to 17. Exact scenario assertions also changed. The trial was reverted. A single chase threshold is too blunt a fix for break longevity: chase purpose, bunch commitment, break cooperation and late-race timing need to be tested together before adjusting official tuning.

This is a diagnostic sample, not evidence of final realism or fair strategy balance. Both fixtures use generic male riders and three fixed opponent plans. The route-sensitive results, short break episodes, poor conserve result and frequent blocked attack marker should be investigated with varied rider archetypes, both categories, opponent goals and a larger paired-seed matrix before tuning parameters or exposing official races. The first human test should judge whether the recorded reasons for an attack, chase, catch and regrouping make sense, not only who wins.

### Bunch attacks that do not stick

The compact replay and audit now distinguish an attempted attack from a rider actually establishing a road gap. Across the same 20 Coast Road seeds, the sprint preset averages **41.0 bunch attack attempts per race**, of which **24.0 fail to open a gap**; the break preset averages **48.1 attempts**, with none failing. Ridge Road produces **44.0 / 23.0** for sprint and **41.9 / 0.0** for break. These counts include all four teams, not just Amber. They expose two balance concerns: attackers currently appear on a regular schedule, and the aggressive preset's attempts are too reliably successful. The new replay field makes those attempts inspectable; this increment does not tune the behaviour or claim the current frequency is realistic.

The audit now splits attempts, failed gaps and chase kilometres by team, using the fixed fixture rider names. On the Coast sprint baseline, Cedar makes 32.0 attempts per race and fails to open a gap on 23.0; Dune makes 9.0 attempts and fails on 1.0. Amber and Birch make no bunch attacks but each chase for 40.0 km. In the Coast break preset, Amber and Cedar each make 19.7 attempts with **zero** failed gaps; Birch chases for 80.9 km. Ridge shows the same pattern: Cedar makes 33.0 attempts with 22.0 failures in the sprint preset, while Amber and Cedar each make 16.9 attempts without a failure in the break preset. This localizes the repeatability problem to team interaction and the attack/chase contest, rather than an equally high success rate for every isolated attacker. It also shows that the current fixtures repeatedly ask the same teams to attack or chase. These are diagnostic observations, not a claim about the intended balance of real races.

The audit additionally counts distinct kilometres with a bunch attack, simultaneous attempts by multiple teams, and attempts while a break was already ahead at the start of that kilometre. Across 20 paired seeds, the baseline means are:

| Route / Amber plan | Km with an attack | Km with multiple teams attacking | Attack km with an existing break |
| --- | ---: | ---: | ---: |
| Coast / sprint | 32.0 | 9.0 | 1.1 |
| Coast / break | 20.7 | 19.7 | 7.8 |
| Ridge / sprint | 33.0 | 11.0 | 4.9 |
| Ridge / break | 19.0 | 16.9 | 7.0 |

The many simultaneous attempts, particularly under the break plan, expose the shared automatic attack cadence rather than independent team decisions. A local trial that simply suppressed unnamed attacks whenever a teammate was ahead changed several seeded race traces and made the Coast sprint's longest break shorter; it was reverted. Team representation needs to be modelled together with attack timing and chase response, then judged against recorded road outcomes, rather than treated as a standalone switch.

The committed Amber attack-posture order makes that comparison possible without retuning every team. Over the same 20 scenario seeds, Amber wins with its preset attack rule / no bunch attacks / selective bunch attacks were:

| Route / Amber plan | Preset | None | Selective |
| --- | ---: | ---: | ---: |
| Coast / sprint | 4 | 4 | 2 |
| Coast / break | 1 | 9 | 13 |
| Coast / balanced | 7 | 5 | 7 |
| Coast / conserve | 0 | 0 | 5 |
| Ridge / sprint | 4 | 4 | 2 |
| Ridge / break | 8 | 11 | 9 |
| Ridge / balanced | 2 | 5 | 2 |
| Ridge / conserve | 0 | 0 | 3 |

Only Amber's order changes within each paired comparison; the other three teams continue to attempt attacks, so the field-wide attempt count does not fall to zero under Amber's “none” choice. The Coast break-plan reversal is a strong sensitivity warning. The fixture is too small to infer an optimal strategy or to replace the automatic rule without broader opponents and human inspection of the replay.

The 120 km switch adds an even sharper warning. If Amber holds all bunch attacks until then and switches to selective attacks, it wins **18/20, 20/20, 19/20 and 7/20** Coast races under the sprint, break, balanced and conserve plans respectively. On Ridge the same four figures are **14/20, 17/20, 19/20 and 19/20**. The three opponents and route stay fixed within each paired seed. This is not a credible general advantage to publish as an optimal tactic; it indicates that stored energy, late attack pressure, opponent response or finish resolution give a fresh late move too much power in these small fixtures. Before any official racing, the engine needs broader casts and a balance pass that checks this timed order alongside chase work and final gaps.

Run `node scripts/audit-late-attack-response.mjs 20` for a focused Coast break-plan counterfactual. Amber still makes two mean bunch attempts under the late selective order in each case. It wins 20/20 against the fixture opponents, 20/20 if Birch alone is ordered to chase all-out, and 17/20 if all three opponents are ordered to chase all-out. If those opponents also stop their own automatic attacks, Amber wins 6/20. The last case changes both attack supply and chase orders, so the difference cannot be attributed to chase strength alone. It does show that the other teams' moves materially shape Amber's late opportunity and that simply ordering one sprint team to chase does not fix this fixture's imbalance. The script records actual chase contributions, which can fall when the altered road has fewer breaks to chase.

A local trial gave simultaneous attackers only 30% of each additional rider's pressure after the strongest attack, instead of summing all pressures. Coast baseline break-plan wins shifted from 1 to 4 in 20 seeds, but the late selective order still won 20/20 break-plan seeds and 18/20 sprint-plan seeds. Several established road-continuity scenarios also changed. This trial was reverted: a flat coalition discount does not resolve the late-order imbalance and disturbs other race behaviour. The next tuning pass should inspect who forms a move, how opposing attacks interact, and how the finish rewards a small group, with paired scenarios guarding the early race as well as the finale.

The audit now totals recorded chase decisions by reason. In the default Coast sprint runs, teams contribute an average of **86.0 team-kilometres answering fresh attacks** and **16.0 team-kilometres because the leader exceeded the selective safe gap**; on Ridge the figures are **84.1** and **18.1**. These are sums across teams, so several teams working on one kilometre count several times, including a response to an attack that fails to establish a break. No other chase reasons fire in these default fixtures. The predominance of reactive work is consistent with the regular attack schedule and short breaks; it does not by itself show that chasing causes every catch. A future balance trial should separately vary attack frequency and the decision to respond, then compare episode length, catches and race results.

### Field-size sensitivity before a chase retune

The smaller `node scripts/audit-v2-passive-bunch.mjs` probe isolates one kilometre of the same v79 model. A fixed front rider and a bunch start 30 seconds apart; every team orders neither an attack nor a chase. With two teams, passive motion adds **0.56 seconds** to the break's gap. One weak passive entrant leaves that figure unchanged, but thirteen such entrants raise it to the per-kilometre cap of **1.5 seconds**. A stronger passive entrant changes it to **-0.14 seconds**. Chase power remains zero in every case. This demonstrates a separate field-composition effect in the median bunch reference, without relying on different attack schedules or simulated finishes. It does not explain every difference in the full-race sweep. A trial that replaced the rider median with the fastest team median removed this local dilution but failed five existing scenarios, including a fading-rider response and a partial finish-line catch; that motor change was reverted. The next version needs a coherent bunch-speed rule alongside chase recovery and finale handling.

The paired `engine-v2-ensemble.mjs` runner now accepts a team count (`node scripts/engine-v2-ensemble.mjs 5 15`), while retaining four teams by default. Each row below averages 30 fictional races: five matched seeds, both categories and three Amber strategies on a 120 km route. The rider generator and route are unchanged across the field-size comparison; additional teams rotate through the three existing presets. `Break win` and `late residual` are race rates, not an estimate of real-world cycling frequencies. `Max groups` is the mean maximum number of simultaneous front road groups; it excludes the bunch.

| Teams | Route | Break win | Late residual anomaly | Max groups |
| ---: | --- | ---: | ---: | ---: |
| 2 | Flat / rolling / mountain | 7% / 7% / 0% | 20% / 27% / 20% | 0.67 / 0.67 / 0.67 |
| 4 | Flat / rolling / mountain | 67% / 73% / 53% | 87% / 93% / 67% | 1.27 / 1.27 / 1.27 |
| 15 | Flat / rolling / mountain | 80% / 100% / 67% | 100% / 87% / 73% | 1.00 / 1.00 / 1.00 |

This exposes a strong field-size dependency in the current v79 model. The same strategy family yields almost no breakaway winners in two-team fields, but many in division-sized fields; the known residual-gap defect is also common in the latter. A four-team-only chase fix would therefore be unsafe. A trial in this work period combined net gap recovery, a weaker chase factor and suppression of unnamed final-kilometre attacks. At a factor of .025, the residual anomaly disappeared in the small paired sweep and break wins were about 40% across routes, but 17 of 363 broader unit scenarios failed, including recorded splits, chase responses and the 5 km finale bridge. The entire trial was reverted. The sweep is diagnostic only; a new version must preserve those behaviours or replace their fixtures with equally concrete, valid scenarios before any result path changes.

### Timing a chase order

The audit compares Amber's preset chase contribution, holding helpers throughout, and holding them until an all-out chase after 120 km. In the 20 Coast sprint seeds, these produce **40.0 / 0 / 10.9** mean Amber chase kilometres and **4 / 0 / 4** Amber wins. Ridge sprint gives **42.0 / 0 / 12.9** chase kilometres and the same **4 / 0 / 4** wins. The late order has a visible, bounded consequence in this fixture; it should not be read as a generally superior sprint tactic. In the break preset all three traces have zero Amber chase kilometres because Amber has a rider up the road in these seeded races. The balanced and conserve presets vary: on Coast, late chase restores balanced wins from five to seven, while conserve rises from zero to four. The outcome is sensitive to this small fictional cast, so broader routes and opponents are needed before tuning the phase rule.

### Helper freedom sensitivity

Holding Amber's helpers removes their attack attempts but leaves the team's automatic attack rule active; another eligible rider may attack instead. Across 20 paired scenario seeds, the default order versus holding helpers gives:

| Route and Amber plan | Mean helper attempts, default → held | Mean captain place, default → held | Amber wins, default → held |
| --- | ---: | ---: | ---: |
| Coast, break | 14.7 → 0 | 5.3 → 6.5 | 1 → 1 |
| Coast, balanced | 5.0 → 0 | 1.8 → 2.0 | 7 → 6 |
| Ridge, break | 11.9 → 0 | 5.7 → 7.0 | 8 → 3 |
| Ridge, balanced | 5.0 → 0 | 7.0 → 1.4 | 2 → 15 |

Sprint and conserve have no Amber helper attack attempts in these fixtures, so holding helpers changes neither trace nor result. The striking reversal on Ridge balanced shows how strongly this small synthetic cast and route respond to attacker identity. It is a balance warning, not proof that protecting helpers is an optimal racing tactic. Before applying this rule to real rosters, test varied rider archetypes, competitors and routes, and inspect which riders were substituted and why the result changed.
