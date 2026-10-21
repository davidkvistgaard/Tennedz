# Local v93 playable test

This is a fictional, opt-in engine preview. It records one selected race from
manager orders through road groups, energy, an individual conditional finish,
and rider replay. It does not save a contest result or award points. The
full acceptance history and unresolved motor boundaries are in
[the playable test gate](ENGINE-V2-PLAYABLE-TEST-GATE.md).

From `calendar-release`, run `pnpm playtest:v93:local`. The command builds an
isolated `.next-v93-local` app and serves a localhost fixture. Open
`http://localhost:3100/login`, sign in as `bob` with `fixture-password`, and
visit `/team/v91-playtest`. Check **Continue to a conditional finish** and
**Try v93 road-to-line preview**. Stop the command to stop the fixture.

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
time and energy with the final replay frame. Any illustrated points are
derived from an unambiguous conditional order; official points and awards
stay withheld. This exact 120 km flow is also exercised by the local browser
test.

Change only one tactic while keeping route, field, fatigue and seed fixed to
compare what changed on the recorded road and at the line. The form also
offers 40/120/260 km, five route profiles including a drawn elevation
profile, both categories, 4/15/20 teams, rival defaults or custom managers,
and a nominated finisher with an optional helper. A helper who is exhausted
or in another road group is refused explicitly; choose None and rerun the
same locked race. An unsupported late bunch exit returns its paid road
boundaries and a clear refusal instead of an individual result or points.

Automated reproduction: `pnpm test:v93:local` builds an isolated fixture and
runs the local browser suite. `node scripts/engine-v2-v93-playability-matrix.mjs`
checks 90 whole fictional races across distances, field sizes, categories,
terrains, fatigue and tactics. It verifies line time and energy against each
rider replay and checks every available point illustration against the
existing one-day policy. The matrix is synthetic correctness evidence; it
does not establish sporting balance or remove the late-exit boundary.
