import test from "node:test";
import assert from "node:assert/strict";
import { overdueDivisionReveals } from "../../lib/calendar/reveal-health.mjs";

test("overdue health consumes only unrevealed race IDs", async () => {
  const db = { async rpc(name, args) {
    assert.equal(name, "recovery_overdue_division_reveals");
    assert.deepEqual(args, { p_now: "2026-10-05T15:00:00Z" });
    return { data: [{ event_id: "missing" }], error: null };
  } };
  assert.deepEqual(await overdueDivisionReveals(db, "2026-10-05T15:00:00Z"),
    ["missing"]);
});

test("overdue health rejects a truncated missing-reveal queue", async () => {
  const db = { async rpc() { return { data: Array.from({ length: 101 }, (_, index) =>
    ({ event_id: String(index) })), error: null }; } };
  await assert.rejects(overdueDivisionReveals(db),
    error => error.code === "REVEAL_HEALTH_TRUNCATED");
});
