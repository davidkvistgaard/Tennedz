import {scheduledGameBroadcastV2} from
  './scheduled-game-broadcast-v2.mjs';

const POSITION_ENGINE='physical-first-position-general-race-8';

// The results endpoints stay closed until the shared replay reaches its
// finish. V7 exposes recorded crossings and a points preview, not an
// official classification or points award.
export async function positionResultPublishedV1(db,event,nowMs){
  if(event.engine_version!==POSITION_ENGINE)return true;
  const {data,error}=await db.rpc(
    'recovery_position_viewer_broadcast_source_v1',
    {p_event:event.id});
  if(error)throw new Error('Could not read the recorded race clock.');
  if(!data)return false;
  const broadcast=scheduledGameBroadcastV2(
    {...data,scheduled_at:event.scheduled_at},nowMs);
  const finishAtMs=broadcast.finishAtMs??
    broadcast.publicationAtMs+
      data.duration*1000/broadcast.clock.rate;
  return nowMs>=finishAtMs;
}
