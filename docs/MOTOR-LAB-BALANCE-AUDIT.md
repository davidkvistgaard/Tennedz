# Motor Lab scenario audit (fictional routes)

Run node scripts/audit-motor-lab.mjs 20 coast or node scripts/audit-motor-lab.mjs 20 ridge to reproduce these small, deterministic comparisons. Each run simulates scenario numbers 0–19 for the four Amber presets, once with default orders and once with a conditional break attack after 40 km. The other three fictional teams, rider cast, route and weather seed are held constant within each paired comparison. The script reads no database and changes no sporting data.

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

The audit also distinguishes the *final kilometre* of a catch with or without a recorded chasing team. Across the 20 coast sprint races, 74 catches ended with a team chasing and 83 ended without one; the break had a chasing team on 13.3 of its 20.7 kilometres per race on average. These figures do not say that the whole episode was unchased, but they show that raising only the selective-chase threshold cannot explain or solve every short break. Passive bunch-versus-break pace needs its own controlled-case tests.

A local sensitivity trial increased the selective chase's safe-gap limit from 10 to 20 seconds (and its distance factor from .06 to .12). Coast sprint breaks then lasted 19.7 km at their longest on average, but a balanced plan with the 40 km break-attack order jumped from 7 to 14 Amber wins in 20 paired seeds; ridge jumped from 3 to 17. Exact scenario assertions also changed. The trial was reverted. A single chase threshold is too blunt a fix for break longevity: chase purpose, bunch commitment, break cooperation and late-race timing need to be tested together before adjusting official tuning.

This is a diagnostic sample, not evidence of final realism or fair strategy balance. Both fixtures use generic male riders and three fixed opponent plans. The route-sensitive results, short break episodes, poor conserve result and frequent blocked attack marker should be investigated with varied rider archetypes, both categories, opponent goals and a larger paired-seed matrix before tuning parameters or exposing official races. The first human test should judge whether the recorded reasons for an attack, chase, catch and regrouping make sense, not only who wins.
