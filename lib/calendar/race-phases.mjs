function timestamp(value, label) {
  const parts = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value)
    : null;
  if (!parts) {
    throw new Error(`${label} needs an unambiguous timestamp with a time zone.`);
  }
  const [, year, month, day, hour, minute, second, zone] = parts;
  const calendarDay = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const validDate = calendarDay.getUTCFullYear() === Number(year)
    && calendarDay.getUTCMonth() + 1 === Number(month)
    && calendarDay.getUTCDate() === Number(day);
  const validClock = Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59;
  const validZone = zone === "Z" || (Number(zone.slice(1, 3)) <= 23 && Number(zone.slice(4, 6)) <= 59);
  if (!validDate || !validClock || !validZone) throw new Error(`${label} needs a valid timestamp.`);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} needs a valid timestamp.`);
  return parsed;
}

export function validateRacePhases({ registrationDeadline, tacticsDeadline, scheduledAt }) {
  const registration = timestamp(registrationDeadline, "Registration deadline");
  const tactics = timestamp(tacticsDeadline, "Tactics deadline");
  const start = timestamp(scheduledAt, "Race start");
  if (!(registration < tactics && tactics < start)) {
    throw new Error("Registration must close before tactics, and tactics before the race starts.");
  }
  return { registrationDeadline, tacticsDeadline, scheduledAt };
}

/** Commit flags must come from persisted reveal and tactics snapshots, not the clock. */
export function racePhaseAt(schedule, now, { revealCommitted = false, tacticsCommitted = false } = {}) {
  const { registrationDeadline, tacticsDeadline, scheduledAt } = validateRacePhases(schedule);
  const time = timestamp(now, "Current time");
  if (typeof revealCommitted !== "boolean") throw new Error("Reveal committed must be a boolean.");
  if (typeof tacticsCommitted !== "boolean") throw new Error("Tactics committed must be a boolean.");
  if (tacticsCommitted && !revealCommitted) throw new Error("Tactics cannot be committed before the division reveal.");
  if (time < Date.parse(registrationDeadline)) return "registration";
  if (!revealCommitted) return "reveal_pending";
  if (time < Date.parse(tacticsDeadline)) return "preparation";
  if (!tacticsCommitted) return "tactics_lock_pending";
  if (time < Date.parse(scheduledAt)) return "tactics_locked";
  return "race_due";
}
