# Race Lab — flat-lab-1

An isolated design laboratory for iterating the race engine. It does not replace,
import or write through the production race cycle. All squads are synthetic.
Every race is fully calculated before inspection; the slider reads stored frames.
This laboratory intentionally exposes the full outcome, unlike the player replay.

## Run and reproduce

The `/race-lab` page returns 404 unless the server process has
`RACE_LAB_ENABLED=true`. The existing local test fixture server sets this flag;
production environment variables have not been changed. This is a deployment
switch, not account authentication. No navigation link advertises the lab.

After installing the existing dependencies:

```sh
pnpm build
node tests/support/server.mjs
# Open http://localhost:3100/race-lab
```

The fixture server also runs a fake local auth/data service; it never connects to
Supabase. Stop it before running `pnpm test:e2e`, which starts its own fixture.

Offline experiments need neither a server nor credentials:

```sh
node scripts/race-lab.mjs compare
node scripts/race-lab.mjs compare experiment.json report.json
node scripts/race-lab.mjs replay exported-input.json race.json
```

Comparison input accepts `count` (2–500), `seed`, `config` overrides and optional
`version`. Export reproducible input from the browser for an individual race.
Preserve the source revision as well as the recorded version, configuration and
scenario. Version mismatches fail rather than silently replaying changed rules.

## Modules and tuning

| Module | Responsibility |
| --- | --- |
| `lib/race-lab/config.mjs` | Validated user overrides, secondary model coefficients and version |
| `scenario.mjs` | Four equal-strength eight-rider squads and the four test plans |
| `energy.mjs` | Energy consumption and fatigue effect on speed |
| `tactics.mjs` | Chase decisions, fresh-helper selection and reasons |
| `simulate.mjs` | Attack, group progression, finish, snapshots and event recording |
| `batch.mjs` | Paired strategy trials and statistical summaries |
| `app/race-lab` | Inspection, comparison, cancellation and JSON exports |

Change coefficients in `config.mjs`, not scattered formulas. Distance is km,
speed km/h, time seconds, rider attributes and energy 0–100. Costs are energy
points per km before endurance scaling; chase strength scales the square root
of combined worker power. Cooperation is a probability per rider per segment.
Position penalty and finish noise are abstract score units, not metres.
Change `VERSION` whenever formulas, secondary coefficients or scenario rules
change. Exported configuration alone cannot preserve an old engine implementation.

Orders are selected before calculation. Helpers rotate according to remaining
energy. A team never chases its own break. The gap follows the two groups' speeds;
energy, helpers and positioning influence the finish. Each recorded frame contains
end-of-segment energy and the decisions made at the start of that segment.

Random draws are keyed by seed and decision/rider/segment, so changing a plan
does not shift every later draw. Input objects are cloned and IDs sorted before
simulation. A given version, seed, fixture and configuration reproduce the same
result. Changing segment length also changes decision frequency and random tags;
it is a model change for comparison purposes, not just rendering detail.

## Experiment design and first evidence

Only Amber's plan changes between paired trials. Birch uses sprint, Cedar break,
and Dune balanced. The four plans are sprint, break, balanced and conserve. The
browser reports captain wins with Wilson 95% intervals, mean captain position,
paired position change versus sprint, team energy and any break surviving.
These are separate alternative races; percentages across plans need not sum to
100%. Intervals reflect sampling uncertainty within this model, not its realism.

`RACE-LAB-BASELINE.json` records 4,400 races: 500 paired seeds at default settings
(2,000 races), plus six sensitivity experiments with 100 paired seeds each.
The shared seed prefix is `pelotonia`. Reproduce each report by passing that
report object as CLI comparison input; extra report fields are ignored.

| Amber plan | Captain wins | Mean captain position | Mean team energy |
| --- | ---: | ---: | ---: |
| Sprint | 41.4% | 1.73 | 70.9 |
| Break | 39.0% | 2.37 | 78.6 |
| Balanced | 6.4% | 3.60 | 78.8 |
| Conserve | 0.4% | 4.02 | 86.4 |

The baseline catches every break when Amber joins Birch's sprint chase. When
Amber attacks instead, 77.4% of races retain a break. At chase strength 3 no break
survives in any plan across the tested 100 seeds; without cooperation no break
survives either. Doubling energy cost makes the attacking captain's average
position fall to 23.54. Stronger chasing can save total energy by catching earlier.

These are diagnostic findings, not an accepted balance. The model currently
favours sprint/break over balanced/conserve in this one-day matchup. Conserve
retains energy, but this experiment gives no future-stage reward for doing so.
Do not tune every plan to an arbitrary equal win rate.

## Next iteration and boundaries

1. Expand opponent combinations and rider specialties; retain paired seeds and
   capture counterexamples where a tactic behaves implausibly.
2. Calibrate chasing and fatigue, including exhausted/dropped riders, before
   adding terrain and more attack opportunities.
3. Add understandable pre-deadline conditional orders with explicit trade-offs,
   then make their execution legible in recorded events.
4. Test hill and mountain scenarios and only then design an adapter to the
   existing atomic snapshot/result/replay flow. Preserve historical races.

Current limitations: one early attack opportunity, two groups, flat roads,
fixed opponents and simplified finish positioning. No wind, weather, crashes,
dropped riders or subsequent attacks. A zero-energy rider can still remain in
the bunch. The lab plans are not yet adapters for saved player race orders.
No production deployment, database migration or paid service is part of this work.

## Verification

Unit tests cover determinism, input immutability, input-order independence,
export/replay equivalence, energy bounds, unique standings, non-divisible route
length, helper eligibility, refusal to chase teammates, validation and sensitivity.
Browser tests cover calculation, recorded inspection, paired comparisons,
invalid settings and mobile/desktop overflow. Existing authentication and player
journeys remain in the full suite.

Final validation (2026-09-24): 47 unit tests, 18 browser tests, ESLint and the
production build pass. Disabled-gate HTTP check returns 404. Screenshots reviewed
at 390 and 1440 pixels; mobile is emulated. Existing Next ESLint-plugin and Node
module-type warnings remain. A generated OneDrive build-cache readlink error was
resolved by removing only `.next` and rebuilding. The local browser also completed
a 100-seed comparison. Production services and data were not modified.
