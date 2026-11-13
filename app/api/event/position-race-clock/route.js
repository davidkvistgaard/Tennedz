import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid,rpc} from '../../../../lib/race/server';
import {scheduledGameBroadcastV2} from
  '../../../../lib/viewer/scheduled-game-broadcast-v2.mjs';

export const GET=protectedRoute(async(req,context,auth)=>{
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const {data:event,error}=await auth.db.from('events')
    .select('engine_version,scheduled_at').eq('id',eventId)
    .maybeSingle();
  if(error)throw new AuthError('POSITION_RACE_UNAVAILABLE',
    'Could not check the scheduled race.',503);
  if(event?.engine_version!==
    'physical-first-position-general-race-8')
    throw new AuthError('POSITION_RACE_NOT_PUBLISHED',
      'This race is not published yet.',404);
  const source=await rpc(auth.db,
    'recovery_position_viewer_broadcast_source_v1',
    {p_event:eventId});
  if(!source)throw new AuthError('POSITION_RACE_NOT_RECORDED',
    'This race has no saved position recording.',404);
  return NextResponse.json(scheduledGameBroadcastV2(
    {...source,scheduled_at:event.scheduled_at},Date.now()));
});
