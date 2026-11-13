// A shared preview cycle includes a short viewing pause after the recorded
// finish. The pause is presentation time, not additional race time.
export const VIEWER_PREVIEW_CLOCK_VERSION='motor-lab-preview-clock-2';
export const VIEWER_PREVIEW_FINISH_HOLD_MS=15000;

export function previewBroadcastClockV2(duration,serverNowMs){
  if(!Number.isFinite(duration)||duration<=0||
    !Number.isFinite(serverNowMs)||serverNowMs<0)
    throw new Error('Preview clock needs a paid race duration and server time.');
  const raceMs=Math.max(1,Math.round(duration*1000));
  const cycleMs=raceMs+VIEWER_PREVIEW_FINISH_HOLD_MS;
  const cycleStartMs=Math.floor(serverNowMs/cycleMs)*cycleMs;
  const finished=serverNowMs-cycleStartMs>=raceMs;
  return {version:VIEWER_PREVIEW_CLOCK_VERSION,serverNowMs,
    clock:{position:finished?duration:0,
      serverEpochMs:cycleStartMs,rate:1,paused:finished,duration}};
}
