import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';
import {PHYSICAL_SPECTATOR_PROJECTION_VERSION} from
  '../../../../lib/viewer/physical-spectator-projection-v1.mjs';

export const GET=protectedRoute(async(req,_context,{db})=>{
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_SPECTATOR_ENABLED!==
      'true')
    throw new AuthError('PHYSICAL_VIEWER_DISABLED',
      'The recorded race viewer is not available yet.',404);
  const url=new URL(req.url);
  const eventId=uuid(url.searchParams.get('event_id'));
  const afterTime=Number(url.searchParams.get('after'));
  const requestedCycle=Number(url.searchParams.get('cycle_epoch'));
  if(!url.searchParams.has('after')||
    !Number.isFinite(afterTime)||afterTime<0)
    throw new AuthError('INVALID_RACE_TIME',
      'A valid recorded frame time is required.',400);
  const source=await rpc(db,
    'recovery_physical_viewer_broadcast_source_v1',
    {p_event:eventId});
  if(!source)throw new AuthError('PHYSICAL_VIEWER_NOT_RECORDED',
    'This physical race has not been recorded.',404);
  const broadcast=recordedGameBroadcastV1(source,Date.now());
  if(!broadcast.recordingPublished)
    throw new AuthError('PHYSICAL_VIEWER_NOT_PUBLISHED',
      'The race recording is not published yet.',425);
  if(afterTime>source.duration)
    throw new AuthError('INVALID_RACE_TIME',
      'The frame time is outside this race.',400);
  const reset=!url.searchParams.has('cycle_epoch')||
    requestedCycle!==broadcast.clock.serverEpochMs;
  const frames=await rpc(db,
    'recovery_physical_viewer_frame_slice_v1',
    {p_event:eventId,p_after:reset?0:afterTime,
      p_elapsed:broadcast.elapsed});
  if(!frames||frames.raceId!==broadcast.raceId)
    throw new AuthError('PHYSICAL_VIEWER_UNAVAILABLE',
      'Could not load recorded race frames.',503);
  return NextResponse.json({...broadcast,...frames,
    version:PHYSICAL_SPECTATOR_PROJECTION_VERSION,
    reset,cycleEpochMs:broadcast.clock.serverEpochMs},
  {headers:{'X-Content-Type-Options':'nosniff'}});
});
