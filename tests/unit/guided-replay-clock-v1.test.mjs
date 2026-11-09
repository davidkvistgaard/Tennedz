import test from 'node:test';
import assert from 'node:assert/strict';
import { broadcastTime } from '@pelotonia/race-viewer/data';
import { guidedReplayClockV1 } from '../../lib/viewer/guided-replay-clock-v1.mjs';

test('all spectators derive the same accelerated replay time and result hold', () => {
  const createdAt = '2026-11-09T12:00:00.000Z';
  const origin = Date.parse(createdAt), duration = 7200;
  const underway = guidedReplayClockV1(duration, createdAt, origin + 60000);
  assert.equal(broadcastTime(underway.clock, origin + 60000), 3600);
  assert.deepEqual(underway, guidedReplayClockV1(duration, createdAt, origin + 60000));
  const hold = guidedReplayClockV1(duration, createdAt, origin + 121000);
  assert.equal(broadcastTime(hold.clock, origin + 121000), duration);
  assert.equal(hold.clock.paused, true);
  const restarted = guidedReplayClockV1(duration, createdAt, origin + 136000);
  assert.equal(restarted.clock.paused, false);
  assert.equal(broadcastTime(restarted.clock, origin + 136000), 60);
});
