import test from "node:test";
import assert from "node:assert/strict";
import { describeTwoPhaseHealth, twoPhaseRaceHealth } from "../../lib/calendar/autopilot-health.mjs";

const event = {
  id: "race", name: "Test race",
  registration_deadline: "2026-10-05T12:00:00Z",
  tactics_deadline: "2026-10-05T15:00:00Z",
};
const pending = { event_id: "race", status: "PENDING", processed_count: 12, entered_count: 3 };
const complete = { ...pending, status: "COMPLETE" };
const state = (job, now, reveals = []) => describeTwoPhaseHealth([event], job ? [job] : [], reveals, now)[0];

test("race health distinguishes open scanning from a blocked registration close", () => {
  assert.equal(state(pending, "2026-10-05T11:59:59Z").state, "SCANNING");
  assert.equal(state(pending, event.registration_deadline).state, "BLOCKED");
  assert.equal(state(null, event.registration_deadline).state, "BLOCKED");
  assert.equal(state(pending, event.tactics_deadline).state, "OVERDUE");
  assert.equal(state(pending, event.tactics_deadline, [{ event_id: "race" }]).state, "REVEALED");
});

test("completed scans remain visible before reveal without inventing entered teams", () => {
  assert.equal(state(complete, "2026-10-05T11:59:59Z").state, "SCAN_COMPLETE");
  const health = state(complete, event.registration_deadline);
  assert.equal(health.state, "AWAITING_REVEAL");
  assert.equal(health.entered, 3);
  assert.equal(state(null, "2026-10-05T11:59:59Z").entered, 0);
});

test("administrator scan rejects truncation instead of reporting a healthy queue", async () => {
  const query = {
    select() { return this; }, eq() { return this; }, in() { return this; },
    not() { return this; }, lte() { return this; }, order() { return this; },
    async limit() { return { data: Array.from({ length: 101 }, (_, index) => ({ ...event, id: String(index) })), error: null }; },
  };
  await assert.rejects(twoPhaseRaceHealth({ from: () => query }, "2026-10-05T12:00:00Z"),
    error => error.code === "RACE_HEALTH_TRUNCATED");
});
