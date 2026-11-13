import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedStageProfile, summarizeRecordedStageTrace} from
  '../../lib/engine/v2/playtest-stage-trace.mjs';

test('recorded profile uses saved kilometre elevations and preserves the recording', () => {
  const recording = {route: {distanceKm: 3, kilometres: [
    {km: 1, startM: 100, endM: 120, terrain: 'flat', gradientPct: 2,
      surface: 'road', exposed: false,
      weather: {temperatureC: 16, windKph: 4, rainMm: 0}},
    {km: 2, startM: 120, endM: 180, terrain: 'climb', gradientPct: 6,
      surface: 'road', exposed: false,
      weather: {temperatureC: 16, windKph: 4, rainMm: 0}},
    {km: 3, startM: 180, endM: 130, terrain: 'descent', gradientPct: -5,
      surface: 'road', exposed: false,
      weather: {temperatureC: 16, windKph: 4, rainMm: 0}},
  ]}};
  const before = structuredClone(recording);
  const trace = summarizeRecordedStageTrace(recording);
  const profile = recordedStageProfile(trace);
  assert.equal(trace.version, 'v93-stage-trace-1');
  assert.deepEqual(trace.kilometres.map(row => [row.startM, row.endM]),
    [[100, 120], [120, 180], [180, 130]]);
  assert.equal(profile.minElevationM, 100);
  assert.equal(profile.maxElevationM, 180);
  assert.equal(profile.points.split(' ').length, 4);
  assert.deepEqual(recording, before);
});

test('recorded profile refuses an incomplete elevation trace', () => {
  assert.throws(() => recordedStageProfile({kilometres: [{startM: 100}]}),
    /complete recorded elevation/);
});
