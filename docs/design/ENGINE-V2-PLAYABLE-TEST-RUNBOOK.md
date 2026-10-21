# Local v93 playable test

This is a fictional, opt-in engine preview. It records one selected race from
manager orders through road groups, energy, an individual conditional finish,
and rider replay. It does not save a contest result or award points. The
full acceptance history and unresolved motor boundaries are in
[the playable test gate](ENGINE-V2-PLAYABLE-TEST-GATE.md).

From `calendar-release`, run `pnpm playtest:v93:local`. The command builds in
a fresh, temporary `.next-v93-local-*` directory and serves a localhost
fixture. Open `http://localhost:3100/login`, sign in as `bob` with
`fixture-password`, and
visit `/team/v91-playtest`. Check **Continue to a conditional finish** and
**Try v93 road-to-line preview**. Stop the command to stop the fixture.
A forced Ctrl+C can leave its generated build directory; remove that specific
`.next-v93-local-*` directory after the server stops if needed.

For a reproducible multi-manager race, choose 120 km, Rolling, Women,
15 teams, Some fatigue, and seed `late-phase-6`. Set Your attack to None.
Add `rival-14` under **Choose another rival manager** and set that manager
to Hard effort, None attack, All helpers chase. At 5 km to go, set your
effort to Hard and `rival-14` to Conserve. Keep `you-7` as your finisher,
nominate `you-6` as your lead-out helper, and set `rival-14-3` / `rival-14-5`
as the rival finisher / helper. Optionally enable the read-only point
illustration with tier 2 and two divisions. Run the v93 preview.

Check the **Locked v93 manager orders** against those selections, then use
**Recorded road changes** and the kilometre slider to inspect groups and
energy. **Your finish** shows the nominated rider's road band, conditional
time, line energy, placing or range, and the helper's actual work. Open the
individual results and replay each nominated finisher to compare their line
time and energy with the final replay frame: scroll the result table, click
**Inspect** for that rider, and move **Band interval** to its last step.
Any illustrated points are derived from an unambiguous conditional order;
official points and awards stay withheld. This exact 120 km flow is also
exercised by the local browser test.

Change only one tactic while keeping route, field, fatigue and seed fixed to
compare what changed on the recorded road and at the line. The form also
offers 40/120/260 km, five route profiles including a drawn elevation
profile, both categories, 4/15/20 teams, rival defaults or custom managers,
and a nominated finisher with an optional helper. A helper who is exhausted
or in another road group is refused explicitly; choose None and rerun the
same locked race. An unsupported late bunch exit returns its paid road
boundaries and a clear refusal instead of an individual result or points.
A calculated front-group catch without a paid merge shows the earlier
kilometre road and contact coordinate, with no last-kilometre replay or
result. Its **Recorded kilometre** slider lets you inspect earlier groups
and your riders' energy before changing tactics or route conditions.
On an extreme drawn climb, an unpayable front rider or unresolved band
contact can likewise stop at the last-kilometre handoff. The same slider
shows the validated earlier road; no later result or points are inferred.

For a long-field default-tactics point example, choose 260 km, Flat, Men,
20 teams, zero fatigue, seed `long-default-M-flat-0`, no player attack and
Ignore chase. Keep the rival default, nominate `you-7` with `you-6` as
helper, and enable the read-only point illustration at tier 3, four
divisions, division 2. The conditional result contains 160 riders; check
`you-7` against its replay and point illustration. No official points are
awarded. The local browser suite runs this complete flow.

For an attacking long-field example, choose 260 km, Rolling, 20 teams,
Some fatigue, and seed `v93-diversity-2`. Set uncustomized rivals to
**Seek a break**. Choose Hard effort, Repeated attack and Ignore chase for
your team, nominate `you-6` as finisher, and enable the read-only point
illustration. The recorded front loses `you-6` and `you-7` to separate
isolated passages while all 160 riders receive conditional crossings.
Inspect `you-6` from the **Recorded front exit** note, then compare its
result time and zero line energy with the last replay frame and its
illustrated points with its provisional place. The browser suite runs this
complete flow; no official award is saved.

Automated reproduction: `pnpm test:v93:local` builds a fresh isolated fixture,
runs the local browser suite and removes its generated build directory.
`node scripts/engine-v2-v93-playability-matrix.mjs`
checks 90 whole fictional races across distances, field sizes, categories,
terrains, fatigue and tactics. It verifies line time and energy against each
rider replay and checks every available point illustration against the
existing one-day policy. The matrix is synthetic correctness evidence; it
does not establish sporting balance or remove the late-exit boundary.
`pnpm test:v93:stress` runs a separate 90-case 260 km, 20-team corpus with
repeated player attacks and mixed rival tactics. It checks every individual
replay in completed races and validates that every unsupported front catch
exposes only the earlier recorded road.
