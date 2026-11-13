import {RECORDED_GAME_BROADCAST_RATE,
  recordedGameBroadcastV1} from './recorded-game-broadcast-v1.mjs';

const POSITION_ENGINE='physical-first-position-general-race-8';

// Once the first shared replay reaches its finish, official results stay
// public even when the spectator clock begins a later replay cycle.
export async function positionResultPublishedV1(db,event,nowMs){
  if(event.engine_version!==POSITION_ENGINE)return true;
  const {data,error}=await db.rpc(
    'recovery_position_viewer_broadcast_source_v1',
    {p_event:event.id});
  if(error)throw new Error('Could not read the recorded race clock.');
  if(!data)return false;
  const broadcast=recordedGameBroadcastV1(
    {...data,scheduled_at:event.scheduled_at},nowMs);
  return nowMs>=broadcast.publicationAtMs+
    data.duration*1000/RECORDED_GAME_BROADCAST_RATE;
}
