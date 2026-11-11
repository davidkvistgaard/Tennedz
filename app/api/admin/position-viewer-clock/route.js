import {NextResponse} from 'next/server';
import {protectedRoute,databaseClient} from
  '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';

export const GET=protectedRoute(async req=>{
  if(process.env.PELOTONIA_V7_POSITION_PREVIEW_ENABLED!==
      'true')
    throw new AuthError('POSITION_VIEWER_DISABLED',
      'Position race preview is not available yet.',404);
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const source=await rpc(databaseClient(),
    'recovery_position_viewer_broadcast_source_v1',
    {p_event:eventId});
  if(!source)throw new AuthError('POSITION_VIEWER_NOT_RECORDED',
    'This position race has not been recorded.',404);
  return NextResponse.json(recordedGameBroadcastV1(
    source,Date.now()),
  {headers:{'X-Content-Type-Options':'nosniff'}});
},{admin:true});
