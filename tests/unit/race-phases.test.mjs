import test from "node:test";
import assert from "node:assert/strict";
import { racePhaseAt, validateRacePhases } from "../../lib/calendar/race-phases.mjs";

const schedule = {
  registrationDeadline: "2026-10-06T08:00:00Z",
  tacticsDeadline: "2026-10-06T11:00:00Z",
  scheduledAt: "2026-10-06T12:00:00Z",
};

test("registration, preparation and tactics lock change at exact deadlines", () => {
  assert.equal(racePhaseAt(schedule, "2026-10-06T07:59:59.999Z"), "registration");
  assert.equal(racePhaseAt(schedule, schedule.registrationDeadline), "preparation");
  assert.equal(racePhaseAt(schedule, "2026-10-06T10:59:59.999Z"), "preparation");
  assert.equal(racePhaseAt(schedule, schedule.tacticsDeadline), "tactics_locked");
  assert.equal(racePhaseAt(schedule, schedule.scheduledAt), "race_due");
});

test("an offset timestamp denotes the same instant as UTC", () => {
  assert.equal(racePhaseAt(schedule, "2026-10-06T10:00:00+02:00"), "preparation");
});

test("a separate, strictly later tactics deadline is required", () => {
  assert.deepEqual(validateRacePhases(schedule), schedule);
  assert.throws(() => validateRacePhases({ ...schedule, tacticsDeadline: schedule.registrationDeadline }), /Registration must close/);
  assert.throws(() => validateRacePhases({ ...schedule, tacticsDeadline: schedule.scheduledAt }), /Registration must close/);
  assert.throws(() => validateRacePhases({ ...schedule, scheduledAt: schedule.registrationDeadline }), /Registration must close/);
});

test("ambiguous local times and invalid dates are rejected", () => {
  assert.throws(() => racePhaseAt(schedule, "2026-10-06T08:00:00"), /time zone/);
  assert.throws(() => validateRacePhases({ ...schedule, registrationDeadline: "tomorrow" }), /time zone/);
  assert.throws(() => validateRacePhases({ ...schedule, registrationDeadline: "2026-99-06T08:00:00Z" }), /valid timestamp/);
  assert.throws(() => validateRacePhases({ ...schedule, registrationDeadline: "2026-02-30T08:00:00Z" }), /valid timestamp/);
  assert.throws(() => validateRacePhases({ ...schedule, registrationDeadline: "2026-10-06T25:00:00Z" }), /valid timestamp/);
});
