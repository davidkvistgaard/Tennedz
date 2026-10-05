import test from "node:test";
import assert from "node:assert/strict";
import { assignPointDivisions } from "../../lib/calendar/division-reveal.mjs";
import { participantRevealView } from "../../lib/calendar/participant-reveal.mjs";

const event = {
  id: "race-45",
  registration_deadline: "2026-10-06T08:00:00Z",
  tactics_deadline: "2026-10-06T11:00:00Z",
  scheduled_at: "2026-10-06T12:00:00Z",
};
const entrants = Array.from({ length: 45 }, (_, index) => ({
  teamId: `team-${String(index + 1).padStart(2, "0")}`,
  earnedPoints: 500 - index * 10,
}));
const revealed = assignPointDivisions({
  eventId: event.id, seasonYear: 2026, gender: "M", entrants,
});
const assignments = revealed.assignments.map((row) => ({
  team_id: row.teamId,
  earned_points_at_lock: String(row.earnedPointsAtLock),
  division_index: row.divisionIndex,
  seed_rank: row.seedRank,
  selected_riders: ["private-rider"],
  orders: { plan: "private" },
}));
const teamNames = new Map(entrants.map(({ teamId }) => [teamId, `Team ${teamId}`]));

test("a participant sees only public details of their own 15-team division", () => {
  const view = participantRevealView({ event, teamId: "team-20",
    now: "2026-10-06T09:00:00Z", assignments, teamNames });
  assert.equal(view.phase, "preparation");
  assert.equal(view.division.index, 2);
  assert.equal(view.division.total, 3);
  assert.equal(view.division.teams.length, 15);
  assert.equal(view.division.teams[0].team_id, "team-16");
  assert.equal(view.division.teams.at(-1).team_id, "team-30");
  assert.deepEqual(Object.keys(view.division.teams[0]), [
    "team_id", "name", "earned_points_at_lock", "seed_rank",
  ]);
  assert.doesNotMatch(JSON.stringify(view), /private-rider|private/);
});

test("the phase follows saved reveal and tactics commits", () => {
  const base = { event, teamId: "team-20", teamNames };
  assert.equal(participantRevealView({ ...base, assignments: [],
    now: "2026-10-06T09:00:00Z" }).phase, "reveal_pending");
  const overdue = participantRevealView({ ...base, assignments: [],
    now: event.tactics_deadline });
  assert.equal(overdue.phase, "reveal_overdue");
  assert.equal(overdue.division, null);
  assert.equal(participantRevealView({ ...base, assignments,
    now: event.tactics_deadline }).phase, "tactics_lock_pending");
  assert.equal(participantRevealView({ ...base, assignments,
    now: event.tactics_deadline, tacticsCommitted: true }).phase, "tactics_locked");
});

test("an incomplete or foreign reveal fails closed", () => {
  const base = { event, teamId: "team-20",
    now: "2026-10-06T09:00:00Z", teamNames };
  assert.throws(() => participantRevealView({ ...base,
    assignments: assignments.filter((row) => row.team_id !== "team-20") }), /incomplete/);
  assert.throws(() => participantRevealView({ ...base,
    assignments: [...assignments, assignments[0]] }), /incomplete/);
  assert.throws(() => participantRevealView({ ...base,
    assignments: assignments.map((row) => row.team_id === "team-20"
      ? { ...row, earned_points_at_lock: "9007199254740992" } : row) }), /incomplete/);
  assert.throws(() => participantRevealView({ ...base,
    assignments, teamNames: new Map() }), /incomplete/);
});
