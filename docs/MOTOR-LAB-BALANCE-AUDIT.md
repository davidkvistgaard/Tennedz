# Motor Lab scenario audit (fictional flat route)

Run node scripts/audit-motor-lab.mjs 20 to reproduce this small, deterministic comparison. It simulates scenario numbers 0–19 for each of the four Amber presets, once with default orders and once with a conditional break attack after 40 km. The other three fictional teams, rider cast, route and weather seed are held constant for each paired comparison. The script reads no database and changes no sporting data.

On 30 September 2026, the 20-seed run found:

| Amber plan | Default Amber wins | Mean captain place | Mean km with a break | Successful planned attacks after 40 km | Km with multiple groups across 20 attack runs |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sprint | 4/20 | 3.9 | 20.7 | 0/20 | 0 |
| Break | 1/20 | 5.3 | 112.2 | 19/20 | 38 |
| Balanced | 7/20 | 1.8 | 83.9 | 0/20 | 0 |
| Conserve | 0/20 | 5.2 | 63.4 | 0/20 | 0 |

The conditional order was blocked in all 20 sprint, balanced and conserve runs at that marker because Amber Captain was not in a break. In the break preset, one run was blocked. These are useful checks that the order is conditional and that separate road groups can appear. The 38 multi-group kilometres are summed across 20 races, not a typical race duration.

This is a diagnostic sample, not evidence of final realism or fair strategy balance. The fixed flat fixture uses generic male riders and three fixed opponent plans. The strong balanced-preset result, poor conserve result and frequent blocked attack marker should be investigated with varied route types, rider archetypes, both categories, opponent goals and a larger paired-seed matrix before tuning parameters or exposing official races. The first human test should judge whether the recorded reasons for an attack, chase, catch and regrouping make sense, not only who wins.
