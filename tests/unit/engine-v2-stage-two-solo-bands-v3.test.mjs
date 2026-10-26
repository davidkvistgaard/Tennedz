import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from '../../lib/engine/v2/stage-overlay-v3.mjs';
import {evaluateTwoSoloBandsKilometreV3} from
  '../../lib/engine/v2/stage-two-solo-bands-v3.mjs';

function overlay(withClimb = true) {
  return normalizeStageOverlayV3({version: 3, distanceKm: 20,
    tacticalIntervals: Array.from({length: 4}, (_, index) => ({
      fromKm: index * 5, toKm: (index + 1) * 5,
      conditions: {surface: 'road', exposed: false, source: 'illustrative',
        weather: {temperatureC: 16, windKph: 0, rainMm: 0}},
    })),
    features: withClimb ? [{id: 'climb', kind: 'climb', fromKm: 10.2,
      toKm: 10.8, gradientPct: 10, label: 'Synthetic short climb'}] : [],
    conditionSpans: [{id: 'rough', fromKm: 10.4, toKm: 10.6,
      conditions: {surface: 'gravel', exposed: true, source: 'simulated',
        weather: {temperatureC: 16, windKph: 28, rainMm: 0}}}],
  });
}
const front = {id: 'front', breakWork: 'cooperate', effort: 'steady',
  energyBefore: 80, rider: {flat: 90, mountain: 30, timetrial: 60,
    endurance: 70, strength: 60, form: 50, fatigue: 0}};
const rear = {id: 'rear', breakWork: 'cooperate', effort: 'steady',
  energyBefore: 80, rider: {flat: 30, mountain: 90, timetrial: 60,
    endurance: 70, strength: 60, form: 50, fatigue: 0}};
const base = {kilometreIndex: 10, front, rear, baseTerrain: 'flat',
  baseGradientPct: 0};

test('v3 pays separate solo-band drift and energy across short stage conditions', () => {
  const saved = structuredClone({front, rear});
  const result = evaluateTwoSoloBandsKilometreV3({...base, overlay: overlay(),
    gapSeconds: 5});
  assert.equal(result.status, 'separate');
  assert.equal(result.paidUntilKm, 11);
  assert.equal(result.frames.length, 5);
  assert.deepEqual(result.frames.map(frame => [frame.fromKm, frame.toKm]),
    [[10, 10.2], [10.2, 10.4], [10.4, 10.6], [10.6, 10.8], [10.8, 11]]);
  assert.deepEqual(result.frames.map(frame => frame.terrain),
    ['flat', 'climb', 'climb', 'climb', 'flat']);
  assert.equal(result.frames[2].surface, 'gravel');
  assert.ok(result.frontEnergy < front.energyBefore);
  assert.ok(result.rearEnergy < rear.energyBefore);
  assert.ok(Math.abs(front.energyBefore-result.frontEnergy-
    result.frames.reduce((sum, frame) => sum+frame.frontWork, 0)) < 3e-6);
  assert.ok(Math.abs(rear.energyBefore-result.rearEnergy-
    result.frames.reduce((sum, frame) => sum+frame.rearWork, 0)) < 3e-6);
  assert.ok(result.frames.every(frame => frame.gapBeforeSeconds > 0 &&
    frame.gapAfterSeconds > 0));
  const flat = evaluateTwoSoloBandsKilometreV3({...base,
    overlay: overlay(false), gapSeconds: 5});
  assert.ok(result.gapSeconds < flat.gapSeconds);
  assert.deepEqual({front, rear}, saved);
});

test('v3 refuses possible solo contact at its first unpaid slice', () => {
  const result = evaluateTwoSoloBandsKilometreV3({...base, overlay: overlay(),
    gapSeconds: .3});
  assert.equal(result.status, 'unresolved_contact');
  assert.ok(result.paidUntilKm < 11);
  assert.deepEqual(result.possibleContactSpan,
    {fromKm: 10.6, toKm: 10.8});
  assert.ok(result.frames.every(frame => frame.toKm <= result.paidUntilKm));
  assert.ok(result.gapSeconds > 0);
  assert.equal(Object.hasOwn(result, 'position'), false);
});

test('v3 refuses unsupported solo work and exhausted riders', () => {
  assert.throws(() => evaluateTwoSoloBandsKilometreV3({...base,
    front: {...front, breakWork: 'sit_on'}, overlay: overlay(), gapSeconds: 5}),
  /cooperating solo/);
  assert.throws(() => evaluateTwoSoloBandsKilometreV3({...base,
    rear: {...rear, energyBefore: .001}, overlay: overlay(), gapSeconds: 5}),
  /coasting resolution/);
  assert.throws(() => evaluateTwoSoloBandsKilometreV3({...base,
    overlay: overlay(), gapSeconds: 0}), /positive/);
});
