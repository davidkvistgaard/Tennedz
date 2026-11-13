import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../lib/race/server';
import {requirePositionRaceParticipantV1} from
  '../../../../lib/race/position-race-access-v1.mjs';
import {verifyGameSnapshotPositionViewerDocumentV1} from
  '../../../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {recordedGameBroadcastV1,
  RECORDED_GAME_BROADCAST_RATE} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';
import {winterPositionPointsPreviewV1} from
  '../../../../lib/race/winter-position-points-preview-v1.mjs';

export const GET=protectedRoute(async(req,context,auth)=>{
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  await requirePositionRaceParticipantV1(
    auth.db,eventId,auth.team.id);
  const {data:event,error:eventError}=await auth.db.from('events')
    .select('status,engine_version,stage_profile_id,scheduled_at')
    .eq('id',eventId).maybeSingle();
  if(eventError)throw new AuthError('POINTS_PREVIEW_UNAVAILABLE',
    'Could not check the race.',503);
  if(!event||event.status!=='FINISHED'||
    event.engine_version!==
      'physical-first-position-general-race-8')
    throw new AuthError('POINTS_PREVIEW_PENDING',
      'The recorded finish is not ready.',425);
  const [stageResult,recordingResult]=await Promise.all([
    auth.db.from('stage_profiles').select('tags')
      .eq('id',event.stage_profile_id).maybeSingle(),
    auth.db.from('recovery_position_race_recordings')
      .select('document,recorded_at').eq('event_id',eventId)
      .maybeSingle(),
  ]);
  if(stageResult.error||recordingResult.error)
    throw new AuthError('POINTS_PREVIEW_UNAVAILABLE',
      'Could not load the recorded finish.',503);
  if(!stageResult.data?.tags?.includes('WINTER_2026')||
    !recordingResult.data)
    throw new AuthError('POINTS_PREVIEW_UNAVAILABLE',
      'This race has no winter points preview.',404);
  const {document,recorded_at}=recordingResult.data;
  let broadcast,verified;
  try{
    verified=verifyGameSnapshotPositionViewerDocumentV1(document);
    broadcast=recordedGameBroadcastV1({recorded_at,
      scheduled_at:event.scheduled_at,
      race_id:verified.raceId,duration:verified.feed.duration,
      events:verified.feed.events},Date.now());
  }catch{
    throw new AuthError('POINTS_PREVIEW_UNAVAILABLE',
      'The recorded finish failed validation.',409);
  }
  const firstFinishAt=broadcast.publicationAtMs+
    Math.ceil(verified.feed.duration*1000/
      RECORDED_GAME_BROADCAST_RATE);
  if(Date.now()<firstFinishAt)
    throw new AuthError('POINTS_PREVIEW_PENDING',
      'Points appear after the shared replay reaches the finish.',425);
  if(verified.input.eventId!==eventId)
    throw new AuthError('POINTS_PREVIEW_UNAVAILABLE',
      'The recorded finish belongs to another race.',409);
  try{
    return NextResponse.json({ok:true,event_id:eventId,
      ...winterPositionPointsPreviewV1(verified)});
  }catch{
    throw new AuthError('POINTS_PREVIEW_UNAVAILABLE',
      'The recorded finish cannot support a points preview.',409);
  }
});
