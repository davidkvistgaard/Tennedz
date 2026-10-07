# V2 chase-skill scope diagnostic — 7 October 2026

This is a read-only paired probe on the isolated v91 candidate. It changes only
fictional roster skills of the three designated hard-chasing teams. All orders,
weather, route, category, starting fatigue, role positions and sample seeds
remain paired. It does not alter a motor coefficient or write a result or point.

The earlier all-skill cap at 45 produced a sharp break-survival boundary. A new
optional final argument to `scripts/engine-v2-ensemble.mjs` narrows that cap:
`power` caps strength/endurance/repeatability; `terrain` caps
flat/hills/mountain/descending; `chase` caps their union; `other` caps the
remaining sporting skills; `all` retains the former behaviour. The diagnostic
helper does not change the rider schema or simulation. Its default is `all`,
so earlier commands and recordings remain reproducible.

With five independent fictional seeds, 20 teams, three hard chasers whose
skill cap is 45, 20 extra starting-fatigue points, fixed rotating manager roles,
three 260 km routes, both categories and three focal strategies, each row
contains 90 validated full-kilometre races:

| Capped skills | Road-group winners | Mean chase power at first planned attack | Mean final-km chase power | Mean gap before final km |
| --- | ---: | ---: | ---: | ---: |
| All | 20 / 90 | 87.25 | 137.96 | 2.78 s |
| Chase-related union | 14 / 90 | 94.48 | 144.23 | 1.87 s |
| Other | 0 / 90 | 133.91 | 215.04 | 0 s |

A smaller first-two-seed comparison found 5/36 road-group wins with `all`, but
0/36 when only `power` or only `terrain` was capped. The five-seed comparison
shows that the combined chase-related skills explain much of the all-skill
effect, whereas limiting the other skills alone does not create a surviving
break in this field. The differences are correlated within each paired seed;
these counts are not estimates of real-manager win rates. The cap still changes
those riders' abilities over the entire race, not just their final chase, and
the `chase` scope includes terrain skills used in other riding phases. It does
not isolate one coefficient or justify changing the motor's chase recovery.

Reproduce the five-seed rows with:

```text
node scripts/engine-v2-ensemble.mjs 5 20 attack-trace planned-finale-allied-manager-mix-3 260 45 20 3 5 4 100 hard 0 80 5 4 0 independent 100 fixed off off all
```

Replace the last `all` with `chase` or `other`; use two samples and `power` or
`terrain` for the smaller split. Aggregate `breakWinRate`,
`meanPhaseChasePower`, `meanFinalKmChasePower` and
`meanPenultimateGapSeconds` equally across route/category/strategy cells.
The next sporting check should vary the duration and participation of paid
chase with independently varied riders; a short-step finale with recorded
attacks, contact and finish order is still required before v2 can settle a race.
