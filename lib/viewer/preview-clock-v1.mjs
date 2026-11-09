export const VIEWER_PREVIEW_CLOCK_VERSION='motor-lab-preview-clock-2';
export const VIEWER_PREVIEW_CYCLE_MS=3_600_000;
export const VIEWER_PREVIEW_RATE=1;

// All spectators receive the same UTC hour anchor for this preview.
// The host owns the anchor; camera target remains local to each browser.
export function previewBroadcastClockV1(duration,serverNowMs){
  if(!Number.isFinite(duration)||duration<=0||
    !Number.isFinite(serverNowMs)||serverNowMs<0)
    throw new Error('Preview clock needs a paid race duration and server time.');
  const cycleMs=Math.max(VIEWER_PREVIEW_CYCLE_MS,
    Math.ceil(duration*1000/VIEWER_PREVIEW_CYCLE_MS)*
      VIEWER_PREVIEW_CYCLE_MS);
  return {version:VIEWER_PREVIEW_CLOCK_VERSION,
    serverNowMs,clock:{position:0,
      serverEpochMs:Math.floor(serverNowMs/
        cycleMs)*cycleMs,
      rate:VIEWER_PREVIEW_RATE,paused:false,duration}};
}
