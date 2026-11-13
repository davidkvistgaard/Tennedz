// A shared cadence for showing recorded kilometre checkpoints. This is
// presentation time, never an elapsed race clock measured by the motor.
export const CHECKPOINT_BROADCAST_CLOCK_VERSION = 'motor-lab-checkpoint-broadcast-1';
export const CHECKPOINT_FINISH_HOLD_MS = 30000;

export function checkpointBroadcastClockV1(duration, serverNowMs) {
  if (!Number.isFinite(duration) || duration <= 0 ||
      !Number.isFinite(serverNowMs) || serverNowMs < 0)
    throw new Error('Checkpoint playback needs a duration and server time.');
  const playbackMs = Math.round(duration * 1000);
  const cycleMs = playbackMs + CHECKPOINT_FINISH_HOLD_MS;
  const serverEpochMs = Math.floor(serverNowMs / cycleMs) * cycleMs;
  const finished = serverNowMs - serverEpochMs >= playbackMs;
  return {version: CHECKPOINT_BROADCAST_CLOCK_VERSION, serverNowMs,
    clock: {position: finished ? duration : 0, serverEpochMs,
      rate: 1, paused: finished, duration}};
}
