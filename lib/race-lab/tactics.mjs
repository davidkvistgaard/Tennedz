import { MODEL_RULES as R } from "./config.mjs";
// Plans are sealed before simulation. These reactions never require live input.
export function chooseWork(team, riders, breakIds, gap, km, config) {
  const own = riders.filter((r) => r.teamId === team.id);
  const teammateAhead = own.some((r) => breakIds.has(r.id));
  if (teammateAhead)
    return {
      workers: [],
      reason: "A teammate is ahead: do not chase your own break.",
    };
  if (team.strategy === "conserve")
    return { workers: [], reason: "Saving energy: no organised chase." };
  if (!breakIds.size) return { workers: [], reason: "No breakaway to chase." };
  const trigger =
    team.strategy === "sprint" ? R.sprintChaseTrigger : R.balancedChaseTrigger;
  if (gap < trigger && km < config.distanceKm - R.forceChaseKm)
    return {
      workers: [],
      reason: "The gap is under control: keep helpers sheltered.",
    };
  const helpers = own
    .filter((r) => r.id !== team.captainId && r.energy > config.helperFloor)
    .sort((a, b) => b.energy - a.energy || a.id.localeCompare(b.id));
  const count =
    team.strategy === "sprint"
      ? R.sprintWorkers
      : team.strategy === "balanced"
        ? R.balancedWorkers
        : 0;
  const workers = helpers.slice(0, count).map((r) => r.id);
  return {
    workers,
    reason: workers.length
      ? "Rotate the freshest helpers into the chase."
      : "No willing helpers with enough energy remain.",
  };
}
