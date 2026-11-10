import {createHmac, timingSafeEqual} from 'node:crypto';
import {motorLabCheckpointRaceId} from
  './motor-lab-checkpoint-adapter-v1.mjs';
import {normalizePreviewOrders} from '../engine/v2/preview.mjs';

export const CHECKPOINT_BROADCAST_SESSION_VERSION =
  'motor-lab-checkpoint-broadcast-session-2';
const MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function signingKey(override) {
  const secret = override || process.env.PELOTONIA_VIEWER_SESSION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Viewer session signing is unavailable.');
  return createHmac('sha256', secret)
    .update('pelotonia.viewer.checkpoint-session.v2').digest();
}

function signature(body, secret) {
  return createHmac('sha256', signingKey(secret))
    .update(body).digest('base64url');
}

function normalizedInput(input) {
  const {plan, routeId, seed} = input ?? {};
  const orders = normalizePreviewOrders(input?.orders);
  const raceId = motorLabCheckpointRaceId({plan, routeId, seed, orders});
  return {input: {plan, routeId, seed, orders}, raceId};
}

export function createCheckpointBroadcastSessionV2(input, source, nowMs,
  signingSecret) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0)
    throw new Error('Viewer session needs a server start time.');
  const normalized = normalizedInput(input);
  if (!Number.isInteger(source?.race?.version) ||
      typeof source?.race?.tuningVersion !== 'string')
    throw new Error('Viewer session needs a versioned motor recording.');
  const payload = {version: CHECKPOINT_BROADCAST_SESSION_VERSION,
    ...normalized, startedAtMs: nowMs,
    engineVersion: source.race.version,
    tuningVersion: source.race.tuningVersion};
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return {...payload, token: `${body}.${signature(body, signingSecret)}`};
}

export function verifyCheckpointBroadcastSessionV2(token, nowMs,
  signingSecret) {
  if (typeof token !== 'string' || token.length < 40 ||
      token.length > 2048 || !Number.isSafeInteger(nowMs))
    throw new Error('Invalid viewer session.');
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9_-]+$/.test(parts[1]))
    throw new Error('Invalid viewer session.');
  const supplied = Buffer.from(parts[1], 'base64url');
  const expected = Buffer.from(signature(parts[0], signingSecret),
    'base64url');
  if (supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected))
    throw new Error('Invalid viewer session.');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); }
  catch { throw new Error('Invalid viewer session.'); }
  if (payload?.version !== CHECKPOINT_BROADCAST_SESSION_VERSION ||
      !Number.isSafeInteger(payload.startedAtMs) ||
      payload.startedAtMs > nowMs + 5000 ||
      nowMs - payload.startedAtMs > MAX_SESSION_AGE_MS ||
      !Number.isInteger(payload.engineVersion) ||
      typeof payload.tuningVersion !== 'string')
    throw new Error('Invalid or expired viewer session.');
  let normalized;
  try { normalized = normalizedInput(payload.input); }
  catch { throw new Error('Invalid viewer session.'); }
  if (normalized.raceId !== payload.raceId ||
      JSON.stringify(normalized.input) !== JSON.stringify(payload.input))
    throw new Error('Invalid viewer session.');
  return {...payload, token};
}

export function checkpointSessionClockV2(duration, startedAtMs, nowMs) {
  if (!Number.isFinite(duration) || duration <= 0 ||
      !Number.isSafeInteger(startedAtMs) ||
      !Number.isSafeInteger(nowMs))
    throw new Error('Viewer session clock needs a duration and server time.');
  const finished = nowMs - startedAtMs >= duration * 1000;
  return {version: CHECKPOINT_BROADCAST_SESSION_VERSION,
    serverNowMs: nowMs,
    clock: {position: finished ? duration : 0,
      serverEpochMs: startedAtMs, rate: 1, paused: finished, duration}};
}
