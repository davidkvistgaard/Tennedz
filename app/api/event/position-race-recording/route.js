import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../lib/race/server';
import {requirePositionRaceParticipantV1} from
  '../../../../lib/race/position-race-access-v1.mjs';
import {verifyGameSnapshotPositionViewerDocumentV1} from
  '../../../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';

export const GET=protectedRoute(async(req,context,auth)=>{
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  await requirePositionRaceParticipantV1(
    auth.db,eventId,auth.team.id);
  const [recordingResult,eventResult]=await Promise.all([
    auth.db.from('recovery_position_race_recordings')
      .select('document,recorded_at').eq('event_id',eventId)
      .maybeSingle(),
    auth.db.from('events').select('scheduled_at')
      .eq('id',eventId).maybeSingle(),
  ]);
  if(recordingResult.error||eventResult.error||!eventResult.data)
    throw new AuthError('POSITION_RACE_UNAVAILABLE',
    'Could not load the saved race.',503);
  const data=recordingResult.data;
  if(!data)throw new AuthError('POSITION_RACE_NOT_RECORDED',
    'This race has no saved position recording.',404);
  const broadcast=recordedGameBroadcastV1({
    recorded_at:data.recorded_at,
    scheduled_at:eventResult.data.scheduled_at,
    race_id:data.document.raceId,
    duration:data.document.feed?.duration,
    events:data.document.feed?.events},Date.now());
  if(!broadcast.recordingPublished)
    throw new AuthError('POSITION_RACE_NOT_PUBLISHED',
      'The shared race playback has not started yet.',425);
  return NextResponse.json(
    verifyGameSnapshotPositionViewerDocumentV1(data.document));
});
