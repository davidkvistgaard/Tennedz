import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid,rpc} from '../../../../lib/race/server';
import {requirePositionRaceParticipantV1} from
  '../../../../lib/race/position-race-access-v1.mjs';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';

export const GET=protectedRoute(async(req,context,auth)=>{
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  await requirePositionRaceParticipantV1(
    auth.db,eventId,auth.team.id);
  const source=await rpc(auth.db,
    'recovery_position_viewer_broadcast_source_v1',
    {p_event:eventId});
  if(!source)throw new AuthError('POSITION_RACE_NOT_RECORDED',
    'This race has no saved position recording.',404);
  const {data:event,error}=await auth.db.from('events')
    .select('scheduled_at').eq('id',eventId).maybeSingle();
  if(error||!event)throw new AuthError('POSITION_RACE_UNAVAILABLE',
    'Could not check the scheduled race start.',503);
  return NextResponse.json(recordedGameBroadcastV1(
    {...source,scheduled_at:event.scheduled_at},Date.now()));
});
