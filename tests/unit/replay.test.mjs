import test from "node:test";
import assert from "node:assert/strict";
import { simulateStage } from "../../lib/engine/simulateStage.js";
import { normalizeRoute, routeAt } from "../../lib/race/route.mjs";
import {
  replayFrame,
  visibleMoments,
  nextMoment,
} from "../../lib/race/replay.mjs";
const teams = Array.from({ length: 3 }, (_, t) => ({
  id: `team-${t}`,
  name: `Team ${t}`,
  riders: Array.from({ length: 8 }, (_, i) => ({
    id: `r${t}-${i}`,
    name: `Rider ${t}-${i}`,
    gender: "F",
    is_captain: i === 0,
    sprint: 30 + i * 4,
    flat: 40,
    hills: 35,
    mountain: 32,
    cobbles: 38,
    endurance: 40,
    strength: 30,
    wind: 40,
    form: 45,
    fatigue: 10,
    mountain_cap: 99,
  })),
}));
const stage = {
  name: "Hills finale",
  distance_km: 130,
  tags: ["HILLS"],
  profile_points: [
    [0, 25],
    [60, 60],
    [100, 100],
    [110, 500],
    [130, 80],
  ],
  keypoints: [{ km: 110, kind: "KOM", label: "Final climb" }],
};
test("recorded replay retains every rider once in every frame and ends at exact results", () => {
  for (let i = 0; i < 80; i++) {
    const sim = simulateStage({
        stage,
        teamsWithRiders: teams,
        seed: `replay-${i}`,
        weather: { wind_kph: 30, precipitation_mm: 4, temp_c: 17 },
      }),
      r = sim.replay;
    assert.equal(r.frames[0].km, 0);
    assert.equal(r.frames.at(-1).km, 130);
    for (const [index, frame] of r.frames.entries()) {
      const ids = frame.groups.flatMap((g) => g.riders);
      assert.equal(ids.length, 24);
      assert.equal(new Set(ids).size, 24);
      assert.ok(frame.groups.every((g) => g.gap >= 0));
      assert.ok(index === 0 || frame.km > r.frames[index - 1].km);
      assert.ok(
        frame.groups.every((g, j) => !j || g.gap >= frame.groups[j - 1].gap),
      );
    }
    for (const result of sim.results) {
      const group = r.frames
        .at(-1)
        .groups.find((g) => g.riders.includes(result.rider_id));
      assert.ok(
        Math.abs(group.gap - (result.time_sec - sim.results[0].time_sec)) <
          0.11,
      );
    }
    assert.equal(r.events.at(-1).rider_ids[0], sim.results[0].rider_id);
    assert.ok(!JSON.stringify(r.roster).includes("_cap"));
  }
});
test("pause/seek helpers do not mutate replay or reveal future moments", () => {
  const sim = simulateStage({ stage, teamsWithRiders: teams, seed: "seek" }),
    before = JSON.stringify(sim);
  assert.deepEqual(
    sim,
    simulateStage({ stage, teamsWithRiders: teams, seed: "seek" }),
  );
  for (const km of [0, 8, 50, 118, 125, 130]) {
    assert.ok(replayFrame(sim.replay, km).km <= km);
    assert.ok(visibleMoments(sim.replay, km).every((m) => m.km <= km));
    assert.ok(nextMoment(sim.replay, km) >= km);
  }
  assert.ok(!visibleMoments(sim.replay, 129).some((m) => m.kind === "finish"));
  assert.equal(JSON.stringify(sim), before);
});
test("shared route interprets actual elevation and supports short and long races", () => {
  const route = normalizeRoute(stage);
  assert.equal(routeAt(route, 105).elevation, 300);
  assert.equal(routeAt(route, 105).gradient, 4);
  assert.equal(routeAt(route, 130).elevation, 80);
  assert.equal(route.ascent, 475);
  assert.throws(() => normalizeRoute({ distance_km: 0 }));
  for (const distance of [20, 400]) {
    const sim = simulateStage({
      stage: { ...stage, distance_km: distance },
      teamsWithRiders: teams,
      seed: "distance",
    });
    assert.ok(sim.replay.frames.every((f) => f.km >= 0 && f.km <= distance));
    assert.ok(sim.feed.every((f) => f.km >= 0 && f.km <= distance));
  }
});
