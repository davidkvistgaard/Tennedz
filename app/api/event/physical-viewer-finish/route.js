import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../lib/race/server';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';
import {physicalSpectatorFinishV1} from
  '../../../../lib/viewer/physical-spectator-projection-v1.mjs';

export const GET=protectedRoute(async(req,_context,{db})=>{
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_SPECTATOR_ENABLED!==
      'true')
    throw new AuthError('PHYSICAL_VIEWER_DISABLED',
      'The recorded race viewer is not available yet.',404);
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const {data,error}=await db.from(
    'recovery_physical_viewer_recordings')
    .select('document,recorded_at')
    .eq('event_id',eventId).maybeSingle();
  if(error)throw new AuthError('PHYSICAL_VIEWER_UNAVAILABLE',
    'Could not load the recorded physical race.',503);
  if(!data)throw new AuthError('PHYSICAL_VIEWER_NOT_RECORDED',
    'This physical race has not been recorded.',404);
  const document=data.document;
  const broadcast=recordedGameBroadcastV1({
    recorded_at:data.recorded_at,
    race_id:document.raceId,
    duration:document.feed?.duration,
    events:document.feed?.events},Date.now());
  if(!broadcast.finishPublished)
    throw new AuthError('PHYSICAL_FINISH_NOT_PUBLISHED',
      'The recorded race has not reached the finish yet.',425);
  return NextResponse.json(physicalSpectatorFinishV1(
    document,eventId,broadcast),
  {headers:{'X-Content-Type-Options':'nosniff'}});
});
