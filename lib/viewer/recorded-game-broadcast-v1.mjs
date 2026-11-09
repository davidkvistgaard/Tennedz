export const RECORDED_GAME_BROADCAST_VERSION=
  'recorded-game-broadcast-v1';
export const RECORDED_GAME_BROADCAST_RATE=60;

// The immutable recording timestamp is the only broadcast anchor. Camera
// controls stay local; every spectator receives this same race clock.
export function recordedGameBroadcastV1(source,serverNowMs){
  const epoch=Date.parse(source?.recorded_at);
  if(!Number.isFinite(epoch)||!Number.isFinite(serverNowMs)||
    !Number.isFinite(source?.duration)||source.duration<=0||
    !Array.isArray(source.events)||!source.race_id)
    throw new Error('A recorded game race needs a valid broadcast anchor.');
  const playbackMs=source.duration*1000/
    RECORDED_GAME_BROADCAST_RATE;
  const publicationAtMs=Math.ceil(epoch+playbackMs);
  const recordingPublished=serverNowMs>=publicationAtMs;
  // Hold the final paid frame long enough for 5 s clock polls and slow
  // renderers to fetch the already published finish evidence.
  const cycleMs=Math.ceil(playbackMs/1000)*1000+15000;
  const cycleEpoch=recordingPublished?
    publicationAtMs+Math.floor((serverNowMs-publicationAtMs)/
      cycleMs)*cycleMs:publicationAtMs;
  const elapsed=recordingPublished?
    Math.min(source.duration,Math.max(0,
      (serverNowMs-cycleEpoch)*RECORDED_GAME_BROADCAST_RATE/
        1000)):0;
  return {raceId:source.race_id,serverNowMs,
    clock:{version:RECORDED_GAME_BROADCAST_VERSION,
      position:0,serverEpochMs:cycleEpoch,
      rate:RECORDED_GAME_BROADCAST_RATE,
      paused:!recordingPublished,duration:source.duration},
    events:recordingPublished?
      source.events.filter(event=>event.time<=elapsed):[],
    publicationAtMs,recordingPublished,elapsed,
    finishPublished:recordingPublished&&elapsed>=
      source.duration};
}
