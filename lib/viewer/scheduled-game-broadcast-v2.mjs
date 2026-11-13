import {recordedGameBroadcastV1} from './recorded-game-broadcast-v1.mjs';

export const SCHEDULED_GAME_BROADCAST_VERSION=
  'scheduled-game-broadcast-v2';
export const SCHEDULED_GAME_PLAYBACK_MS=30*60*1000;

// A saved motor recording supplies every position and event. This clock only
// maps its recorded time onto one shared, thirty-minute spectator window.
export function scheduledGameBroadcastV2(source,serverNowMs){
  if(source?.scheduled_at==null)
    return recordedGameBroadcastV1(source,serverNowMs);
  const recordedAtMs=Date.parse(source.recorded_at);
  const scheduledAtMs=Date.parse(source.scheduled_at);
  if(!Number.isFinite(recordedAtMs)||
    !Number.isFinite(scheduledAtMs)||
    !Number.isFinite(serverNowMs)||
    !Number.isFinite(source.duration)||source.duration<=0||
    !Array.isArray(source.events)||!source.race_id)
    throw new Error('A scheduled game race needs a valid recording and start.');
  const publicationAtMs=Math.max(recordedAtMs,scheduledAtMs);
  const finishAtMs=publicationAtMs+SCHEDULED_GAME_PLAYBACK_MS;
  const recordingPublished=serverNowMs>=publicationAtMs;
  const finishPublished=serverNowMs>=finishAtMs;
  const rate=source.duration*1000/SCHEDULED_GAME_PLAYBACK_MS;
  const elapsed=recordingPublished?
    Math.min(source.duration,Math.max(0,
      (serverNowMs-publicationAtMs)*rate/1000)):0;
  return {raceId:source.race_id,serverNowMs,
    clock:{version:SCHEDULED_GAME_BROADCAST_VERSION,
      position:finishPublished?source.duration:0,
      serverEpochMs:publicationAtMs,rate,
      paused:!recordingPublished||finishPublished,
      duration:source.duration},
    events:recordingPublished?
      source.events.filter(event=>event.time<=elapsed):[],
    publicationAtMs,finishAtMs,recordingPublished,finishPublished};
}
