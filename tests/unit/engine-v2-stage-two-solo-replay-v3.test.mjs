import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3} from '../../lib/engine/v2/stage-overlay-v3.mjs';
import {replayTwoSoloBandsStageV3} from '../../lib/engine/v2/stage-two-solo-replay-v3.mjs';

function fixture() {
  const overlay = normalizeStageOverlayV3({version: 3, distanceKm: 20,
    tacticalIntervals: Array.from({length: 4}, (_, index) => ({
      fromKm: index * 5, toKm: (index + 1) * 5,
      conditions: {surface: 'road', exposed: false, source: 'illustrative',
        weather: {temperatureC: 16, windKph: 0, rainMm: 0}},
    })),
    features: [{id: 'short-climb', kind: 'climb', fromKm: 10.2,
      toKm: 10.8, gradientPct: 10, label: 'Synthetic short climb'}],
    conditionSpans: [{id: 'rough', fromKm: 10.4, toKm: 10.6,
      conditions: {surface: 'gravel', exposed: true, source: 'simulated',
        weather: {temperatureC: 16, windKph: 28, rainMm: 0}}}],
  });
  const front = {id: 'front', breakWork: 'cooperate', effort: 'steady',
    energyBefore: 80, rider: {flat: 90, mountain: 30, timetrial: 60,
      endurance: 70, strength: 60, form: 50, fatigue: 0}};
  const rear = {id: 'rear', breakWork: 'cooperate', effort: 'steady',
    energyBefore: 80, rider: {flat: 30, mountain: 90, timetrial: 60,
      endurance: 70, strength: 60, form: 50, fatigue: 0}};
  const kilometreBaselines = Array.from({length: 20}, () =>
    ({terrain: 'flat', gradientPct: 0}));
  return {overlay, front, rear, gapSeconds: 20, kilometreBaselines};
}

test('v3 stage replay carries two solo energies and gap over exact short features', () => {
  const input = fixture();
  const saved = structuredClone(input);
  const race = replayTwoSoloBandsStageV3(input);
  assert.equal(race.status, 'separate');
  assert.equal(race.paidUntilKm, 20);
  assert.equal(race.kilometres.length, 20);
  assert.deepEqual(race.kilometres[10].frames.map(frame =>
    [frame.fromKm, frame.toKm]),
  [[10, 10.2], [10.2, 10.4], [10.4, 10.6], [10.6, 10.8], [10.8, 11]]);
  assert.equal(race.kilometres[10].frames[2].surface, 'gravel');
  assert.equal(race.kilometres[10].frames[2].gradientPct, 10);
  assert.equal(race.kilometres[10].frames[2].conditionSource, 'simulated');
  assert.deepEqual(race.kilometres[10].frames[2].featureIds, ['short-climb']);
  assert.equal(race.frontEnergy, race.kilometres.at(-1).frontEnergy);
  assert.ok(Math.abs(input.front.energyBefore-race.frontEnergy-
    race.kilometres.flatMap(km => km.frames).reduce((sum, frame) =>
      sum + frame.frontWork, 0)) < 2e-5);
  assert.deepEqual(input, saved);
});

test('v3 precommitted 5 km effort changes work after the marker', () => {
  const input = fixture();
  const baseline = replayTwoSoloBandsStageV3(input);
  const changed = replayTwoSoloBandsStageV3({...input,
    effortOrders: [{riderId: 'front', markerKm: 5, effort: 'hard'}]});
  assert.equal(changed.kilometres[4].frontEffort, 'steady');
  assert.equal(changed.kilometres[5].frontEffort, 'hard');
  assert.deepEqual(changed.kilometres[5].ordersActivated,
    [{riderId: 'front', markerKm: 5, effort: 'hard'}]);
  assert.equal(changed.kilometres[4].frontEnergy,
    baseline.kilometres[4].frontEnergy);
  assert.ok(changed.kilometres[5].frontEnergy <
    baseline.kilometres[5].frontEnergy);
  assert.ok(changed.frontEnergy < baseline.frontEnergy);
});

test('v3 stops stage replay at first possible occupied-wheel contact', () => {
  const input = fixture();
  const race = replayTwoSoloBandsStageV3({...input, gapSeconds: .3,
    front: {...input.front, rider: {...input.front.rider, flat: 20}}});
  assert.equal(race.status, 'unresolved_contact');
  assert.ok(race.paidUntilKm < 20);
  assert.ok(race.kilometres.at(-1).frames.every(frame =>
    frame.toKm <= race.paidUntilKm));
  assert.equal(Object.hasOwn(race, 'places'), false);
  assert.ok(race.gapSeconds > 0);
});

test('v3 refuses incomplete stage, invalid markers and unsupported solo work', () => {
  const input = fixture();
  assert.throws(() => replayTwoSoloBandsStageV3({...input,
    kilometreBaselines: input.kilometreBaselines.slice(1)}), /Complete/);
  assert.throws(() => replayTwoSoloBandsStageV3({...input,
    effortOrders: [{riderId: 'front', markerKm: 6, effort: 'hard'}]}), /5 km/);
  assert.throws(() => replayTwoSoloBandsStageV3({...input,
    effortOrders: [{riderId: 'front', markerKm: 5, effort: 'hard'},
      {riderId: 'front', markerKm: 5, effort: 'steady'}]}), /Duplicate/);
  assert.throws(() => replayTwoSoloBandsStageV3({...input,
    rear: {...input.rear, breakWork: 'sit_on'}}), /cooperating solo/);
  const specialIds = replayTwoSoloBandsStageV3({...input,
    front: {...input.front, id: '__proto__'},
    effortOrders: [{riderId: '__proto__', markerKm: 5, effort: 'hard'}]});
  assert.equal(specialIds.status, 'separate');
  assert.equal(specialIds.kilometres[5].frontEffort, 'hard');
});


