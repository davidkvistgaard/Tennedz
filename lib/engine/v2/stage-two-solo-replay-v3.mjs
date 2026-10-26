import {evaluateTwoSoloBandsKilometreV3} from './stage-two-solo-bands-v3.mjs';
import {TUNING} from './tuning.mjs';

// Internal, bounded replay of two already separate working solo riders. This
// does not choose attacks, merge groups, draft, recover or classify a finish.
export function replayTwoSoloBandsStageV3({overlay, front, rear, gapSeconds,
  kilometreBaselines, effortOrders = []}) {
  if (overlay?.version !== 3 || !Number.isInteger(overlay.distanceKm) ||
      !Array.isArray(kilometreBaselines) ||
      kilometreBaselines.length !== overlay.distanceKm) {
    throw new Error('Complete integer-kilometre stage baselines are required.');
  }
  for (const baseline of kilometreBaselines) {
    if (!['flat', 'hill', 'climb', 'descent'].includes(baseline?.terrain) ||
        !Number.isFinite(baseline.gradientPct)) {
      throw new Error('Each kilometre needs explicit baseline terrain and gradient.');
    }
  }
  if (!front || !rear || front.id === rear.id ||
      ![front.id, rear.id].every(id => typeof id === 'string' && id) ||
      !Number.isFinite(gapSeconds) || gapSeconds <= 0) {
    throw new Error('Distinct solo riders need positive initial separation.');
  }
  if (!Array.isArray(effortOrders)) throw new Error('Effort orders must be an array.');
  const seen = new Set();
  for (const order of effortOrders) {
    if (![front.id, rear.id].includes(order?.riderId) ||
        !Number.isInteger(order.markerKm) || order.markerKm < 5 ||
        order.markerKm >= overlay.distanceKm || order.markerKm % 5 !== 0 ||
        !Object.hasOwn(TUNING.effortCost, order.effort)) {
      throw new Error('Only valid precommitted 5 km solo effort orders are supported.');
    }
    const key = order.riderId + ':' + order.markerKm;
    if (seen.has(key)) throw new Error('Duplicate rider effort order at one marker.');
    seen.add(key);
  }
  const state = new Map([
    [front.id, {energyBefore: front.energyBefore, effort: front.effort}],
    [rear.id, {energyBefore: rear.energyBefore, effort: rear.effort}],
  ]);
  let gap = gapSeconds;
  const kilometres = [];
  for (let kilometreIndex = 0; kilometreIndex < overlay.distanceKm; kilometreIndex++) {
    const ordersActivated = effortOrders.filter(order => order.markerKm === kilometreIndex);
    for (const order of ordersActivated) state.get(order.riderId).effort = order.effort;
    const baseline = kilometreBaselines[kilometreIndex];
    const step = evaluateTwoSoloBandsKilometreV3({overlay, kilometreIndex,
      front: {...front, ...state.get(front.id)},
      rear: {...rear, ...state.get(rear.id)},
      gapSeconds: gap, baseTerrain: baseline.terrain,
      baseGradientPct: baseline.gradientPct});
    const record = {kilometreIndex, ordersActivated: ordersActivated.map(order => ({...order})),
      frontEffort: state.get(front.id).effort, rearEffort: state.get(rear.id).effort,
      ...step};
    kilometres.push(record);
    state.get(front.id).energyBefore = step.frontEnergy;
    state.get(rear.id).energyBefore = step.rearEnergy;
    gap = step.gapSeconds;
    if (step.status !== 'separate') {
      return {version: 3, status: step.status, paidUntilKm: step.paidUntilKm,
        frontEnergy: step.frontEnergy, rearEnergy: step.rearEnergy,
        gapSeconds: gap, possibleContactSpan: step.possibleContactSpan,
        kilometres};
    }
  }
  return {version: 3, status: 'separate', paidUntilKm: overlay.distanceKm,
    frontEnergy: state.get(front.id).energyBefore,
    rearEnergy: state.get(rear.id).energyBefore, gapSeconds: gap, kilometres};
}

