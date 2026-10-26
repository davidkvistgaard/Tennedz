import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {evaluateStageSliceRiderV3} from './stage-slice-evaluation-v3.mjs';
import {TUNING} from './tuning.mjs';

const clamp = (value, minimum, maximum) => Math.max(minimum,
  Math.min(maximum, value));

// A guarded one-kilometre transition for two distinct working solo lanes.
// Their separation is paid only while positive. Possible contact is returned
// as a refusal interval, never as a resolved pass or classified result.
export function evaluateTwoSoloBandsKilometreV3({overlay, kilometreIndex,
  front, rear, gapSeconds, baseTerrain, baseGradientPct}) {
  if (!front || !rear || typeof front.id !== 'string' || !front.id ||
      typeof rear.id !== 'string' || !rear.id || front.id === rear.id ||
      front.breakWork !== 'cooperate' || rear.breakWork !== 'cooperate') {
    throw new Error('Two distinct cooperating solo riders are required.');
  }
  if (!Number.isFinite(gapSeconds) || gapSeconds <= 0) {
    throw new Error('Solo-band separation must be positive.');
  }
  let frontEnergy = front.energyBefore;
  let rearEnergy = rear.energyBefore;
  let gap = gapSeconds;
  const frames = [];
  for (const slice of stageOverlaySlicesForKilometreV3(overlay, kilometreIndex)) {
    const shared = {slice, baseTerrain, baseGradientPct, phase: 'solo',
      extraWorkPerKm: TUNING.breakaway.extraCostPerKm};
    const frontStep = evaluateStageSliceRiderV3({...shared,
      rider: front.rider, energyBefore: frontEnergy, effort: front.effort});
    const rearStep = evaluateStageSliceRiderV3({...shared,
      rider: rear.rider, energyBefore: rearEnergy, effort: rear.effort});
    const driftPerKm = clamp((frontStep.ability - rearStep.ability) *
      TUNING.breakaway.driftSecondsPerAbilityPoint,
    -TUNING.breakaway.maxPassiveLossSecondsPerKm,
    TUNING.breakaway.maxPassiveGainSecondsPerKm);
    const after = gap + driftPerKm * slice.distanceKm;
    if (after <= 0) {
      return {version: 3, status: 'unresolved_contact', kilometreIndex,
        frontRiderId: front.id, rearRiderId: rear.id,
        paidUntilKm: slice.fromKm, gapSeconds: +gap.toFixed(6),
        frontEnergy: +frontEnergy.toFixed(6),
        rearEnergy: +rearEnergy.toFixed(6),
        possibleContactSpan: {fromKm: slice.fromKm, toKm: slice.toKm},
        frames};
    }
    frames.push({fromKm: slice.fromKm, toKm: slice.toKm,
      terrain: frontStep.segment.terrain,
      surface: frontStep.segment.surface,
      conditionSpanId: slice.conditionSpanId,
      frontAbility: frontStep.ability, rearAbility: rearStep.ability,
      frontWork: +frontStep.work.toFixed(6),
      rearWork: +rearStep.work.toFixed(6),
      frontEnergyBefore: +frontEnergy.toFixed(6),
      rearEnergyBefore: +rearEnergy.toFixed(6),
      frontEnergyAfter: +frontStep.energyAfter.toFixed(6),
      rearEnergyAfter: +rearStep.energyAfter.toFixed(6),
      gapBeforeSeconds: +gap.toFixed(6),
      gapAfterSeconds: +after.toFixed(6),
      roadBaselineSeconds: +frontStep.roadBaselineSeconds.toFixed(6)});
    frontEnergy = frontStep.energyAfter;
    rearEnergy = rearStep.energyAfter;
    gap = after;
  }
  return {version: 3, status: 'separate', kilometreIndex,
    frontRiderId: front.id, rearRiderId: rear.id,
    paidUntilKm: Math.min(kilometreIndex + 1, overlay.distanceKm),
    gapSeconds: +gap.toFixed(6),
    frontEnergy: +frontEnergy.toFixed(6),
    rearEnergy: +rearEnergy.toFixed(6), frames};
}
