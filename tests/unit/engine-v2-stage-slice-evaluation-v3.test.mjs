import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateStageSliceKilometreV3} from '../../lib/engine/v2/stage-slice-evaluation-v3.mjs';

function overlay({climb = true, rough = true} = {}) {
  return normalizeStageOverlayV3({version: 3, distanceKm: 20,
    tacticalIntervals: Array.from({length: 4}, (_, index) => ({
      fromKm: index * 5, toKm: (index + 1) * 5,
      conditions: {surface: 'road', exposed: false, source: 'illustrative',
        weather: {temperatureC: 16, windKph: 0, rainMm: 0}},
    })),
    features: climb ? [{id: 'climb', kind: 'climb', fromKm: 10.2, toKm: 10.8,
      gradientPct: 10, label: 'Synthetic short climb'}] : [],
    conditionSpans: rough ? [{id: 'rough', fromKm: 10.4, toKm: 10.6,
      conditions: {surface: 'gravel', exposed: true, source: 'simulated',
        weather: {temperatureC: 16, windKph: 28, rainMm: 0}}}] : [],
  });
}
const rider = {flat: 35, mountain: 85, wind: 25, handling: 40,
  endurance: 70, form: 50, fatigue: 0};
const input = {kilometreIndex: 10, rider, energyBefore: 80, effort: 'hard',
  baseTerrain: 'flat', baseGradientPct: 0};

test('v3 isolated rider evaluation pays short climb and rough wind section at exact lengths', () => {
  const result = evaluateStageSliceKilometreV3({...input, overlay: overlay()});
  assert.deepEqual(result.slices.map(slice => [slice.fromKm, slice.toKm]),
    [[10, 10.2], [10.2, 10.4], [10.4, 10.6], [10.6, 10.8], [10.8, 11]]);
  assert.deepEqual(result.slices.map(slice => slice.segment.terrain),
    ['flat', 'climb', 'climb', 'climb', 'flat']);
  assert.deepEqual(result.slices.map(slice => slice.segment.surface),
    ['road', 'road', 'gravel', 'road', 'road']);
  assert.ok(result.slices[2].work > result.slices[0].work);
  assert.ok(result.slices[2].roadSeconds > result.slices[0].roadSeconds);
  assert.ok(Math.abs(result.slices.reduce((sum, slice) => sum + slice.distanceKm, 0) - 1) < 1e-9);
  assert.ok(Math.abs(result.energyBefore - result.energyAfter - result.work) < 2e-6);
});

test('v3 short geography changes rider work and road time without changing rider input', () => {
  const before = structuredClone(rider);
  const flat = evaluateStageSliceKilometreV3({...input, overlay: overlay({climb: false, rough: false})});
  const climb = evaluateStageSliceKilometreV3({...input, overlay: overlay({rough: false})});
  const combined = evaluateStageSliceKilometreV3({...input, overlay: overlay()});
  assert.ok(climb.work > flat.work);
  assert.ok(climb.roadSeconds > flat.roadSeconds);
  assert.ok(combined.work > climb.work);
  assert.ok(combined.roadSeconds > climb.roadSeconds);
  assert.deepEqual(rider, before);
});

test('v3 isolated rider evaluation refuses unresolved topography and exhausted energy', () => {
  const missing = overlay();
  missing.features[0].gradientPct = null;
  assert.throws(() => evaluateStageSliceKilometreV3({...input, overlay: missing}), /signed gradient/);
  const overlapping = overlay();
  overlapping.features.push({id: 'another', kind: 'descent', fromKm: 10.4, toKm: 10.5,
    gradientPct: -4, label: 'Synthetic descent'});
  assert.throws(() => evaluateStageSliceKilometreV3({...input, overlay: overlapping}), /Overlapping topographic/);
  assert.throws(() => evaluateStageSliceKilometreV3({...input, overlay: overlay(),
    energyBefore: 0.01}), /coasting resolution/);
});
