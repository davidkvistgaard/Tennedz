export const GUIDED_REPLAY_CLOCK_VERSION = 'guided-replay-broadcast-1';
export const GUIDED_REPLAY_RATE = 60;
export const GUIDED_REPLAY_FINISH_HOLD_MS = 15000;

// A replay cycle is presentation only. It never changes recorded race time,
// timing gaps, or the official result. All spectators use the same UTC anchor.
export function guidedReplayClockV1(duration, createdAt, serverNowMs) {
  const createdMs = Date.parse(createdAt);
  if (!Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(createdMs) || !Number.isFinite(serverNowMs))
    throw new Error('A recorded duration, creation time and server time are required.');
  const raceMs = Math.ceil(duration * 1000 / GUIDED_REPLAY_RATE);
  const cycleMs = raceMs + GUIDED_REPLAY_FINISH_HOLD_MS;
  const completedCycles = Math.max(0,
    Math.floor(Math.max(0, serverNowMs - createdMs) / cycleMs));
  const cycleStart = createdMs + completedCycles * cycleMs;
  const finished = serverNowMs - cycleStart >= raceMs;
  return { version: GUIDED_REPLAY_CLOCK_VERSION, serverNowMs,
    clock: { position: finished ? duration : 0, serverEpochMs: cycleStart,
      rate: GUIDED_REPLAY_RATE, paused: finished, duration } };
}
