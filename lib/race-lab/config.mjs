export const VERSION = "flat-lab-1";
export const DEFAULT_CONFIG = Object.freeze({
  distanceKm: 160,
  stepKm: 5,
  attackKm: 20,
  packSpeed: 41,
  breakSpeed: 43.5,
  chaseStrength: 1.25,
  cooperation: 0.85,
  energyCost: 1,
  shelteredCost: 0.12,
  workCost: 0.38,
  breakCost: 0.27,
  fatigueSpeedLoss: 0.055,
  helperFloor: 30,
  positionPenalty: 7,
  sprintSpread: 8,
});
const ranges = {
  distanceKm: [80, 240],
  stepKm: [1, 10],
  attackKm: [5, 60],
  packSpeed: [30, 50],
  breakSpeed: [30, 55],
  chaseStrength: [0, 3],
  cooperation: [0, 1],
  energyCost: [0.5, 2],
  shelteredCost: [0.05, 0.3],
  workCost: [0.1, 0.8],
  breakCost: [0.1, 0.6],
  fatigueSpeedLoss: [0.01, 0.12],
  helperFloor: [10, 60],
  positionPenalty: [0, 20],
  sprintSpread: [1, 20],
};
export function configure(overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides))
    throw Error("Configuration must be an object.");
  for (const [key, value] of Object.entries(overrides)) {
    if (
      !ranges[key] ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < ranges[key][0] ||
      value > ranges[key][1]
    )
      throw Error(`Invalid configuration: ${key}`);
  }
  const c = { ...DEFAULT_CONFIG, ...overrides };
  if (c.attackKm >= c.distanceKm - 20)
    throw Error("Attack must precede the finale.");
  return c;
}
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Secondary design coefficients live here too. Change VERSION when changing these rules.
export const MODEL_RULES = Object.freeze({
  flatBaseline: 70,
  flatSpeedWeight: 0.035,
  minimumSpeed: 20,
  enduranceBase: 1.25,
  enduranceDivisor: 200,
  attackSuccess: 0.9,
  balancedAttackSuccess: 0.45,
  initialGap: 15,
  initialGapSpread: 35,
  sprintChaseTrigger: 20,
  balancedChaseTrigger: 60,
  forceChaseKm: 35,
  sprintWorkers: 3,
  balancedWorkers: 1,
  workEnergyFloor: 0.3,
  cooperationSpeedWeight: 2,
  cooperationCentre: 0.5,
  breakWorkingFactor: 1.25,
  breakShelteredFactor: 0.7,
  conserveEnergyFactor: 0.8,
  conserveFinishPenalty: 6,
  protectionPerHelper: 0.12,
  protectionCap: 0.75,
  finishEnergyFloor: 0.35,
  finishNoise: 6,
  scorePerSecond: 10,
});
