import { clamp, MODEL_RULES as R } from "./config.mjs";
export function spendEnergy(rider, km, work, config) {
  const enduranceFactor =
    R.enduranceBase - rider.endurance / R.enduranceDivisor;
  const cost =
    (config.shelteredCost + work) * km * config.energyCost * enduranceFactor;
  const before = rider.energy;
  rider.energy = clamp(before - cost, 0, 100);
  return before - rider.energy;
}
export function groupSpeed(group, base, config) {
  if (!group.length) return base;
  const mean = (key) => group.reduce((s, r) => s + r[key], 0) / group.length;
  return Math.max(
    R.minimumSpeed,
    base +
      (mean("flat") - R.flatBaseline) * R.flatSpeedWeight -
      (100 - mean("energy")) * config.fatigueSpeedLoss,
  );
}
