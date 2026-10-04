import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulateLab } from "../../lib/race-lab/simulate.mjs";
import { flatScenario } from "../../lib/race-lab/scenario.mjs";
import { comparePlans } from "../../lib/race-lab/batch.mjs";
import { chooseWork } from "../../lib/race-lab/tactics.mjs";
import { configure } from "../../lib/race-lab/config.mjs";
test("lab is deterministic, input-immutable and independent of input ordering", () => {
  const input = { scenario: flatScenario("break"), seed: "repeat" },
    copy = structuredClone(input),
    a = simulateLab(input);
  assert.deepEqual(input, copy);
  assert.deepEqual(a, simulateLab(input));
  copy.scenario.teams.reverse();
  copy.scenario.teams.forEach((t) => t.riders.reverse());
  assert.deepEqual(a.results, simulateLab(copy).results);
  assert.deepEqual(
    a,
    simulateLab({
      version: a.version,
      scenario: a.scenario,
      seed: a.seed,
      config: a.config,
    }),
  );
  assert.notDeepEqual(
    a.results,
    simulateLab({ ...input, seed: "different" }).results,
  );
});
test("energy stays bounded and never increases; every rider finishes once with ordered finite gaps", () => {
  for (const seed of ["one", "two", "three"])
    for (const energyCost of [0.5, 2]) {
      const r = simulateLab({
        scenario: flatScenario("sprint"),
        seed,
        config: { energyCost, distanceKm: 163, stepKm: 7 },
      });
      assert.equal(r.frames.at(-1).km, 163);
      assert.equal(r.results.length, 32);
      assert.equal(new Set(r.results.map((x) => x.id)).size, 32);
      r.results.forEach((x, i) => {
        assert.equal(x.position, i + 1);
        assert.ok(Number.isFinite(x.gapSeconds) && x.gapSeconds >= 0);
        if (i) assert.ok(x.gapSeconds >= r.results[i - 1].gapSeconds);
      });
      r.frames.forEach((f, i) => {
        assert.ok(f.gapSeconds >= 0);
        f.riders.forEach((x, j) => {
          assert.ok(x.energy >= 0 && x.energy <= 100);
          if (i) assert.ok(x.energy <= r.frames[i - 1].riders[j].energy);
        });
      });
      assert.ok(r.events.every((e) => e.km >= 0 && e.km <= 163));
      assert.ok(
        r.events.filter((e) => e.kind === "attack").every((e) => e.km === 20),
      );
    }
});
test("teams never chase their own break and tired helpers stop working", () => {
  const config = configure(),
    team = flatScenario().teams[0],
    riders = team.riders.map((r) => ({ ...r, teamId: team.id }));
  assert.equal(
    chooseWork(team, riders, new Set([team.captainId]), 100, 120, config)
      .workers.length,
    0,
  );
  assert.equal(
    chooseWork(team, riders, new Set(["opponent"]), 100, 120, config).workers
      .length,
    3,
  );
  riders.forEach((r) => (r.energy = 0));
  assert.equal(
    chooseWork(team, riders, new Set(["opponent"]), 100, 120, config).workers
      .length,
    0,
  );
});
test("invalid fixtures/config and wrong engine version fail before simulation", () => {
  for (const config of [
    { energyCost: 0 },
    { cooperation: NaN },
    { chaseStrength: "2" },
    { invented: 1 },
  ])
    assert.throws(() => simulateLab({ scenario: flatScenario(), config }));
  const s = flatScenario();
  s.teams[1].riders[0].id = s.teams[0].riders[0].id;
  assert.throws(() => simulateLab({ scenario: s }));
  assert.throws(() =>
    simulateLab({ version: "future", scenario: flatScenario() }),
  );
  assert.throws(() => comparePlans({ count: 501 }));
});
test("paired reports reproduce exactly and expose chase sensitivity rather than a fixed outcome", () => {
  const options = { count: 20, seed: "sensitivity" },
    a = comparePlans(options);
  assert.deepEqual(a, comparePlans(options));
  const weak = comparePlans({ ...options, config: { chaseStrength: 0 } }),
    strong = comparePlans({ ...options, config: { chaseStrength: 3 } });
  assert.ok(weak.rows[0].breakSurvivalRate > strong.rows[0].breakSurvivalRate);
  assert.equal(a.rows[0].pairedPositionDelta, 0);
  for (const r of a.rows) {
    assert.ok(
      r.winInterval95[0] <= r.captainWinRate &&
        r.winInterval95[1] >= r.captainWinRate,
    );
    assert.ok(r.averageEnergy >= 0 && r.averageEnergy <= 100);
  }
});
test("production cycle has no lab dependency", () => {
  const source = readFileSync(
    new URL("../../lib/race/cycle.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /race-lab/);
});
