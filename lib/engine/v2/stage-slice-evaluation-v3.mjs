import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {prepareRiderReadiness, applyStageConditions} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING} from './tuning.mjs';

// An isolated, deterministic rider/road calculation. It deliberately does not
// advance groups, decide tactics, apply recovery or create a race result.
export function evaluateStageSliceKilometreV3({overlay, kilometreIndex, rider,
  energyBefore, effort, baseTerrain, baseGradientPct}) {
  if (!Object.hasOwn(TUNING.effortCost, effort)) throw new Error('Unknown rider effort.');
  if (!['flat', 'hill', 'climb', 'descent'].includes(baseTerrain) ||
      !Number.isFinite(baseGradientPct)) throw new Error('Explicit baseline terrain and gradient are required.');
  if (!Number.isFinite(energyBefore) || energyBefore < 0 || energyBefore > 100) {
    throw new Error('Energy before the kilometre must be 0–100.');
  }
  let energy = energyBefore;
  const slices = stageOverlaySlicesForKilometreV3(overlay, kilometreIndex).map(slice => {
    const topography = slice.features.filter(feature =>
      feature.kind === 'climb' || feature.kind === 'descent');
    if (topography.length > 1) throw new Error('Overlapping topographic features need a separate resolution.');
    const feature = topography[0] ?? null;
    if (feature && (!Number.isFinite(feature.gradientPct) ||
      (feature.kind === 'climb' && feature.gradientPct <= 0) ||
      (feature.kind === 'descent' && feature.gradientPct >= 0))) {
      throw new Error('Topographic feature needs a signed gradient.');
    }
    const segment = {terrain: feature?.kind ?? baseTerrain,
      gradientPct: feature?.gradientPct ?? baseGradientPct,
      surface: slice.conditions.surface, exposed: slice.conditions.exposed,
      weather: slice.conditions.weather};
    const before = energy;
    const effect = applyStageConditions(prepareRiderReadiness(rider, {energy: before}),
      segment, {exposed: segment.exposed});
    const terrainLoad = 1 + Math.max(0, segment.gradientPct) * .035 +
      (segment.surface === 'road' ? 0 : .15);
    const work = TUNING.effortCost[effort] * terrainLoad *
      effect.energyCostMultiplier * slice.distanceKm;
    if (work > before + 1e-9) throw new Error('Exhausted rider needs coasting resolution.');
    energy = Math.max(0, before - work);
    const seconds = segmentBaseSeconds(segment) * slice.distanceKm;
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Invalid slice road time.');
    return {...slice, segment, energyBefore: +before.toFixed(6),
      work: +work.toFixed(6), energyAfter: +energy.toFixed(6),
      ability: effect.ability, roadBaselineSeconds: +seconds.toFixed(6)};
  });
  return {version: 3, kilometreIndex, energyBefore,
    energyAfter: +energy.toFixed(6),
    work: +slices.reduce((sum, slice) => sum + slice.work, 0).toFixed(6),
    roadBaselineSeconds: +slices.reduce((sum, slice) => sum + slice.roadBaselineSeconds, 0).toFixed(6),
    slices};
}
