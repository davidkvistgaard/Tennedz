import test from "node:test";
import assert from "node:assert/strict";
import { assignPointDivisions } from "../../lib/calendar/division-reveal.mjs";

const scope = { eventId: "calendar-race", seasonYear: 2026, gender: "M" };
const entrants = (count) => Array.from({ length: count }, (_, index) => ({
  teamId: `team-${String(index + 1).padStart(3, "0")}`,
  earnedPoints: count - index,
}));

test("45 registrations reveal three balanced races, seeded by earned points", () => {
  const snapshot = entrants(45);
  snapshot[0].rosterAbility = 1;
  snapshot[44].rosterAbility = 999;
  const result = assignPointDivisions({ ...scope, entrants: snapshot.reverse() });
  assert.deepEqual(
    [1, 2, 3].map((division) => result.assignments.filter((row) => row.divisionIndex === division).length),
    [15, 15, 15],
  );
  assert.equal(result.assignments[0].teamId, "team-001");
  assert.equal(result.assignments[44].teamId, "team-045");
  assert.deepEqual(result.assignments.map((row) => row.seedRank), Array.from({ length: 45 }, (_, index) => index + 1));
  assert.ok(result.assignments.every((row) => !Object.hasOwn(row, "rosterAbility")));
});

test("division sizing stays balanced across the 20-team boundary", () => {
  for (const [count, sizes] of [[2, [2]], [20, [20]], [21, [11, 10]], [40, [20, 20]], [41, [14, 14, 13]], [400, Array(20).fill(20)]]) {
    const { assignments } = assignPointDivisions({ ...scope, entrants: entrants(count) });
    assert.deepEqual(sizes, sizes.map((_, index) => assignments.filter((row) => row.divisionIndex === index + 1).length));
  }
});

test("point ties have an input-order-independent team ID tie-breaker", () => {
  const tied = ["team-z", "team-b", "team-a"].map((teamId) => ({ teamId, earnedPoints: 0 }));
  const first = assignPointDivisions({ ...scope, entrants: tied });
  const second = assignPointDivisions({ ...scope, entrants: tied.reverse() });
  assert.deepEqual(first, second);
  assert.deepEqual(first.assignments.map((row) => row.teamId), ["team-a", "team-b", "team-z"]);
});

test("a copied reveal remains stable after registration and rankings change", () => {
  const live = entrants(21);
  const revealed = assignPointDivisions({ ...scope, entrants: live });
  live[0].earnedPoints = 0;
  live[20].earnedPoints = 999;
  live.push({ teamId: "late-entry", earnedPoints: 1000 });
  assert.equal(revealed.assignments.length, 21);
  assert.deepEqual(revealed.assignments[0], { teamId: "team-001", earnedPointsAtLock: 21, divisionIndex: 1, seedRank: 1 });
  assert.ok(!revealed.assignments.some((row) => row.teamId === "late-entry"));
});

test("invalid or ambiguous locked snapshots are rejected", () => {
  const valid = entrants(2);
  for (const invalid of [undefined, [], entrants(1), entrants(401)]) {
    assert.throws(() => assignPointDivisions({ ...scope, entrants: invalid }), /2-400 teams/);
  }
  assert.throws(() => assignPointDivisions({ ...scope, entrants: [valid[0], valid[0]] }), /distinct team IDs/);
  for (const earnedPoints of [-1, 1.2, NaN, Infinity, "2"]) {
    assert.throws(() => assignPointDivisions({ ...scope, entrants: [valid[0], { ...valid[1], earnedPoints }] }), /non-negative integer/);
  }
  assert.throws(() => assignPointDivisions({ ...scope, gender: "other", entrants: valid }), /needs a gender/);
  assert.equal(assignPointDivisions({ ...scope, gender: "F", entrants: valid }).gender, "F");
});
