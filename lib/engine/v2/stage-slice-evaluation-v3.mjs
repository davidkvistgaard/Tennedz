import {stageOverlaySlicesForKilometreV3} from './stage-overlay-v3.mjs';
import {prepareRiderReadiness, applyStageConditions} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING} from './tuning.mjs';

// A bounded single-rider step; it does not decide tactics, group position or
// contact. Work and the road clock use the slice's actual distance.
export function evaluateStageSliceRiderV3({slice, rider, energyBefore, effort,
  baseTerrain, baseGradientPct, phase = 'cruise', extraWorkPerKm = 0}) {
  if (!Object.hasOwn(TUNING.effortCost, effort)) throw new Error('Unknown rider effort.');
  if (!['flat', 'hill', 'climb', 'descent'].includes(baseTerrain) ||
      !Number.isFinite(baseGradientPct)) throw new Error('Explicit baseline terrain and gradient are required.');
  if (!Number.isFinite(energyBefore) || energyBefore < 0 || energyBefore > 100) {
    throw new Error('Energy before the slice must be 0–100.');
  }
  if (!Number.isFinite(extraWorkPerKm) || extraWorkPerKm < 0) {
    throw new Error('Extra rider work must be non-negative.');
  }
  if (!slice || !Number.isFinite(slice.distanceKm) || slice.distanceKm <= 0 ||
      !Array.isArray(slice.features) || !slice.conditions) {
    throw new Error('A bounded stage slice is required.');
  }
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
  const effect = applyStageConditions(prepareRiderReadiness(rider,
    {phase, energy: energyBefore}), segment, {exposed: segment.exposed});
  const terrainLoad = 1 + Math.max(0, segment.gradientPct) * .035 +
    (segment.surface === 'road' ? 0 : .15);
  const work = (TUNING.effortCost[effort] * terrainLoad + extraWorkPerKm) *
    effect.energyCostMultiplier * slice.distanceKm;
  if (work > energyBefore + 1e-9) throw Object.assign(
    new Error('Exhausted rider needs coasting resolution.'),
    {code: 'STAGE_EXHAUSTED_RIDER'});
  const roadBaselineSeconds = segmentBaseSeconds(segment) * slice.distanceKm;
  if (!Number.isFinite(roadBaselineSeconds) || roadBaselineSeconds <= 0) {
    throw new Error('Invalid slice road time.');
  }
  return {...slice, segment, energyBefore, work,
    energyAfter: Math.max(0, energyBefore - work), ability: effect.ability,
    roadBaselineSeconds};
}

// An isolated, deterministic rider/road calculation. It deliberately does not
// advance groups, decide tactics, apply recovery or create a race result.
export function evaluateStageSliceKilometreV3({overlay, kilometreIndex, rider,
  energyBefore, effort, baseTerrain, baseGradientPct}) {
  let energy = energyBefore;
  const slices = stageOverlaySlicesForKilometreV3(overlay, kilometreIndex).map(slice => {
    const evaluated = evaluateStageSliceRiderV3({slice, rider,
      energyBefore: energy, effort, baseTerrain, baseGradientPct});
    energy = evaluated.energyAfter;
    return {...evaluated, energyBefore: +evaluated.energyBefore.toFixed(6),
      work: +evaluated.work.toFixed(6),
      energyAfter: +evaluated.energyAfter.toFixed(6),
      roadBaselineSeconds: +evaluated.roadBaselineSeconds.toFixed(6)};
  });
  return {version: 3, kilometreIndex, energyBefore,
    energyAfter: +energy.toFixed(6),
    work: +slices.reduce((sum, slice) => sum + slice.work, 0).toFixed(6),
    roadBaselineSeconds: +slices.reduce((sum, slice) =>
      sum + slice.roadBaselineSeconds, 0).toFixed(6), slices};
}
