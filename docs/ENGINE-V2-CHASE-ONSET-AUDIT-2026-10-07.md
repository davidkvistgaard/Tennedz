# V91 hard-chase onset diagnostic — 7 October 2026

This is a read-only paired sporting probe on the isolated v91 full-kilometre
candidate. It keeps the same fictional riders, three fixed hard-chasing teams,
orders other than hard-chase onset, courses, categories, weather and seeds. The
hard chasers have a 45-point cap on strength, endurance, repeatability and
terrain skills; all riders start with 20 additional fatigue points. Three
selective pursuers still activate at ten kilometres to go. Only the three hard
chasers' all-out order starts 100, 40 or 20 kilometres from the finish.

Three independent seeds yield 54 validated races per row: flat, rolling and
mountain courses, both categories and three focal strategies. Values below are
means across the 18 course/category/strategy cells; win counts sum those cells.

| Hard chase starts | Road-group winners | Chase power at first planned attack | Final-kilometre chase power | Gap before final kilometre |
| --- | ---: | ---: | ---: | ---: |
| 100 km to go | 4 / 54 | 99.34 | 150.62 | 1.00 s |
| 40 km to go | 42 / 54 | 134.30 | 213.28 | 34.53 s |
| 20 km to go | 54 / 54 | 148.99 | 237.98 | 91.87 s |

The later chasers retain more capacity but inherit substantially larger gaps.
In this fictional field the extra final power does not make up for the distance
already conceded. This is evidence that *when* independent managers commit to
chase matters as much as their nominal strength. It does not establish a
realistic breakaway win rate or justify a chase coefficient change: the roster,
manager mix and 45-point cap are deliberately synthetic, and three paired
seeds are a small sample. These are full-kilometre outcomes, not short-step
finale settlements.

Reproduce the first row with:

```text
node scripts/engine-v2-ensemble.mjs 3 20 attack-trace planned-finale-allied-manager-mix-3 260 45 20 3 5 4 100 hard 0 80 5 4 0 independent 100 fixed off off chase
```

Change the argument immediately before `hard` from `100` to `40` or `20` for
the paired rows. Sum `breakWinRate` times three and average
`meanPhaseChasePower`, `meanFinalKmChasePower` and
`meanPenultimateGapSeconds` across the report's 18 cells. The next acceptance
probe should vary independent manager participation and attack timing while
keeping recorded energy, road-group formation and validated result contracts
visible. A short-step attack, contact and finish model remains necessary.
