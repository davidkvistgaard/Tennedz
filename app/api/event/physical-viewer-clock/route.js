import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';

export const GET=protectedRoute(async(req,_context,{db})=>{
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_SPECTATOR_ENABLED!==
      'true')
    throw new AuthError('PHYSICAL_VIEWER_DISABLED',
      'The recorded race viewer is not available yet.',404);
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const source=await rpc(db,
    'recovery_physical_viewer_broadcast_source_v1',
    {p_event:eventId});
  if(!source)throw new AuthError('PHYSICAL_VIEWER_NOT_RECORDED',
    'This physical race has not been recorded.',404);
  return NextResponse.json(recordedGameBroadcastV1(source,Date.now()),
    {headers:{'X-Content-Type-Options':'nosniff'}});
});
