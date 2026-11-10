import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorLabPreviewSource} from
  '../../lib/engine/v2/preview.mjs';
import {createCheckpointBroadcastSessionV2,
  verifyCheckpointBroadcastSessionV2,
  checkpointSessionClockV2, motorLabRecordingDigestV2} from
  '../../lib/viewer/checkpoint-broadcast-session-v2.mjs';

const key = 'test-only-session-signing-key';
const input = {plan: 'break', routeId: 'ridge', seed: 1,
  orders: {attackPosture: 'repeated'}};
const duration = 160 * 8;

test('signed session starts each generated race at the server time', () => {
  const source = createMotorLabPreviewSource(input);
  const session = createCheckpointBroadcastSessionV2(source, source,
    1_800_000_000_000, key);
  const joined = verifyCheckpointBroadcastSessionV2(session.token,
    1_800_000_000_500, key);
  assert.deepEqual(joined.input, {
    plan: source.plan, routeId: source.routeId, seed: source.seed,
    orders: source.orders});
  assert.equal(joined.startedAtMs, session.startedAtMs);
  assert.equal(joined.recordingDigest, motorLabRecordingDigestV2(source));
  const first = checkpointSessionClockV2(duration,
    session.startedAtMs, session.startedAtMs);
  const second = checkpointSessionClockV2(duration,
    joined.startedAtMs, session.startedAtMs + 500);
  assert.equal(first.clock.serverEpochMs, second.clock.serverEpochMs);
  assert.equal(first.clock.paused, false);
  assert.equal(second.clock.paused, false);
  assert.equal(checkpointSessionClockV2(duration, session.startedAtMs,
    session.startedAtMs + duration * 1000 - 1).clock.paused, false);
  assert.equal(checkpointSessionClockV2(duration, session.startedAtMs,
    session.startedAtMs + duration * 1000).clock.paused, true);
});

test('same-version source changes are visible to the replay integrity gate', () => {
  const source = createMotorLabPreviewSource(input);
  const session = createCheckpointBroadcastSessionV2(source, source,
    1_800_000_000_000, key);
  const altered = structuredClone(source);
  altered.race.frames[0].riderGroups[0].deficitSeconds += 1;
  assert.notEqual(session.recordingDigest,
    motorLabRecordingDigestV2(altered));
  assert.equal(session.engineVersion, altered.race.version);
  assert.equal(session.tuningVersion, altered.race.tuningVersion);
});

test('changing the broadcast start or orders invalidates the token', () => {
  const source = createMotorLabPreviewSource(input);
  const now = 1_800_000_000_000;
  const session = createCheckpointBroadcastSessionV2(source, source,
    now, key);
  const [body, mac] = session.token.split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  payload.startedAtMs -= duration * 1000;
  const forged = Buffer.from(JSON.stringify(payload)).toString('base64url');
  assert.throws(() => verifyCheckpointBroadcastSessionV2(
    `${forged}.${mac}`, now, key), /Invalid viewer session/);
  assert.throws(() => verifyCheckpointBroadcastSessionV2(
    session.token, now, 'other-key'), /Invalid viewer session/);
  assert.throws(() => verifyCheckpointBroadcastSessionV2(
    session.token, now + 31 * 86400000, key), /expired/);
});
