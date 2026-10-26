import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeStageOverlayV3, stageOverlayAtDistanceV3} from '../../lib/engine/v2/stage-overlay-v3.mjs';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';

function fixture() {
  return {
    version: 3, distanceKm: 22,
    tacticalIntervals: Array.from({length: 5}, (_, index) => ({
      fromKm: index * 5, toKm: Math.min(22, (index + 1) * 5),
      conditions: {
        surface: 'road', exposed: false, source: 'illustrative',
        weather: {temperatureC: 16, windKph: 12, rainMm: 0},
      },
    })),
    features: [
      {id: 'short-climb', kind: 'climb', fromKm: 10.2, toKm: 11.1, gradientPct: 11.2, label: 'Illustrative short climb'},
      {id: 'summit', kind: 'landmark', fromKm: 11.1, toKm: 11.2, label: 'Summit area'},
    ],
  };
}

test('v3 keeps a short climb across kilometre and tactical interval boundaries', () => {
  const overlay = normalizeStageOverlayV3(fixture());
  assert.equal(overlay.tacticalIntervals.length, 5);
  assert.deepEqual(overlay.tacticalIntervals.at(-1) && [overlay.tacticalIntervals.at(-1).fromKm, overlay.tacticalIntervals.at(-1).toKm], [20, 22]);
  assert.equal(stageOverlayAtDistanceV3(overlay, 10.19).features.length, 0);
  assert.deepEqual(stageOverlayAtDistanceV3(overlay, 10.2).features.map(feature => feature.id), ['short-climb']);
  assert.deepEqual(stageOverlayAtDistanceV3(overlay, 10.99).features.map(feature => feature.id), ['short-climb']);
  assert.deepEqual(stageOverlayAtDistanceV3(overlay, 11.1).features.map(feature => feature.id), ['summit']);
  assert.equal(stageOverlayAtDistanceV3(overlay, 22).tacticalInterval.toKm, 22);
});

test('v3 refuses missing conditions, gaps, overlap and unsupported feature spans', () => {
  const missing = fixture();
  missing.tacticalIntervals[2].conditions.weather = undefined;
  assert.throws(() => normalizeStageOverlayV3(missing), /weather/);
  const gap = fixture();
  gap.tacticalIntervals[1].fromKm = 6;
  assert.throws(() => normalizeStageOverlayV3(gap), /exact 5 km/);
  const overlap = fixture();
  overlap.tacticalIntervals[0].toKm = 6;
  assert.throws(() => normalizeStageOverlayV3(overlap), /exact 5 km/);
  const outOfBounds = fixture();
  outOfBounds.features[0].toKm = 23;
  assert.throws(() => normalizeStageOverlayV3(outOfBounds), /bounded positive span/);
  const duplicate = fixture();
  duplicate.features[1].id = 'short-climb';
  assert.throws(() => normalizeStageOverlayV3(duplicate), /unique/);
});

test('v3 data is separate from the existing recorded kilometre route contract', () => {
  const stage = {distance_km: 22, profile_points: [[0, 100], [22, 100]]};
  const before = buildKilometreRoute(stage, {seed: 'version-seam'});
  const overlay = normalizeStageOverlayV3(fixture());
  const after = buildKilometreRoute(stage, {seed: 'version-seam'});
  assert.deepEqual(after, before);
  assert.equal(before.version, 2);
  assert.equal(overlay.version, 3);
  assert.equal(before.kilometres[10].terrain, 'flat');
  assert.equal(stageOverlayAtDistanceV3(overlay, 10.5).features[0].kind, 'climb');
});
