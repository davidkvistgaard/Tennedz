import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../lib/race/server';
import {verifyGameSnapshotPositionViewerDocumentV1} from
  '../../../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {scheduledGameBroadcastV2} from
  '../../../../lib/viewer/scheduled-game-broadcast-v2.mjs';

export const GET=protectedRoute(async(req,context,auth)=>{
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const [recordingResult,eventResult]=await Promise.all([
    auth.db.from('recovery_position_race_recordings')
      .select('document,recorded_at').eq('event_id',eventId)
      .maybeSingle(),
    auth.db.from('events').select('engine_version,scheduled_at')
      .eq('id',eventId).maybeSingle(),
  ]);
  if(recordingResult.error||eventResult.error||!eventResult.data)
    throw new AuthError('POSITION_RACE_UNAVAILABLE',
    'Could not load the saved race.',503);
  if(eventResult.data.engine_version!==
    'physical-first-position-general-race-8')
    throw new AuthError('POSITION_RACE_NOT_PUBLISHED',
      'This race is not published yet.',404);
  const data=recordingResult.data;
  if(!data)throw new AuthError('POSITION_RACE_NOT_RECORDED',
    'This race has no saved position recording.',404);
  const broadcast=scheduledGameBroadcastV2({
    recorded_at:data.recorded_at,
    scheduled_at:eventResult.data.scheduled_at,
    race_id:data.document.raceId,
    duration:data.document.feed?.duration,
    events:data.document.feed?.events},Date.now());
  if(!broadcast.finishPublished)
    throw new AuthError('POSITION_RACE_NOT_PUBLISHED',
      'The recorded finish appears after the shared race ends.',425);
  return NextResponse.json(
    verifyGameSnapshotPositionViewerDocumentV1(data.document));
});
