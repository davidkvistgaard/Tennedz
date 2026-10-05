import { racePhaseAt } from "./race-phases.mjs";

/** Public opponent summary derived only from a persisted reveal and team names. */
export function participantRevealView({
  event, now, teamId, assignments, teamNames, tacticsCommitted = false,
}) {
  if (!event || !teamId || !Array.isArray(assignments)
    || !(teamNames instanceof Map)) throw new Error("Invalid division view input.");
  const mine = assignments.find((row) => row.team_id === teamId);
  if (assignments.length > 0 && !mine) {
    throw new Error("The division reveal is incomplete.");
  }
  const revealCommitted = Boolean(mine);
  const phase = racePhaseAt({
    registrationDeadline: event.registration_deadline,
    tacticsDeadline: event.tactics_deadline,
    scheduledAt: event.scheduled_at,
  }, now, { revealCommitted, tacticsCommitted });
  if (!mine) return { event_id: event.id, phase, division: null };

  const unique = new Set(assignments.map((row) => row.team_id));
  if (unique.size !== assignments.length || assignments.length < 2
    || assignments.length > 400) throw new Error("The division reveal is incomplete.");
  const ranks = assignments.map((row) => row.seed_rank).sort((a, b) => a - b);
  const divisionSizes = new Map();
  for (const row of assignments) {
    if (!Number.isInteger(row.division_index) || row.division_index < 1
      || (typeof row.earned_points_at_lock !== "number"
        && typeof row.earned_points_at_lock !== "string")
      || !Number.isSafeInteger(Number(row.earned_points_at_lock))
      || Number(row.earned_points_at_lock) < 0) {
      throw new Error("The division reveal is incomplete.");
    }
    divisionSizes.set(row.division_index, (divisionSizes.get(row.division_index) || 0) + 1);
  }
  const totalDivisions = Math.max(...divisionSizes.keys());
  const sizes = [...divisionSizes.values()];
  if (ranks.some((rank, index) => rank !== index + 1)
    || totalDivisions !== divisionSizes.size
    || sizes.some((size) => size < 2 || size > 20)
    || Math.max(...sizes) - Math.min(...sizes) > 1) {
    throw new Error("The division reveal is incomplete.");
  }
  const rows = assignments.filter((row) => row.division_index === mine.division_index)
    .sort((a, b) => a.seed_rank - b.seed_rank);
  if (rows.some((row) => !teamNames.has(row.team_id))) {
    throw new Error("The division reveal is incomplete.");
  }
  return {
    event_id: event.id,
    phase,
    division: {
      index: mine.division_index,
      total: totalDivisions,
      teams: rows.map((row) => ({
        team_id: row.team_id,
        name: teamNames.get(row.team_id),
        earned_points_at_lock: Number(row.earned_points_at_lock),
        seed_rank: row.seed_rank,
      })),
    },
  };
}
