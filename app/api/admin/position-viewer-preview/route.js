import {NextResponse} from 'next/server';
import {protectedRoute,databaseClient,requireGameWrites} from
  '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {loadGameSnapshotPositionRaceRecordingV1,
  verifyGameSnapshotPositionViewerDocumentV1} from
  '../../../../lib/viewer/game-snapshot-position-viewer-v1.mjs';
import {encodeGameSnapshotPositionRaceArchiveV2} from
  '../../../../lib/viewer/game-snapshot-position-archive-v2.mjs';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';

export const maxDuration=300;

async function retryUnavailableRead(read){
  try{return await read();}
  catch(error){
    if(!(error instanceof AuthError)||error.status!==503)
      throw error;
    // The simulation can outlive an idle database connection. A second
    // read is safe; the immutable write below is never retried here.
    return read();
  }
}

function enabled(){
  if(process.env.PELOTONIA_V7_POSITION_PREVIEW_ENABLED!==
      'true')
    throw new AuthError('POSITION_VIEWER_DISABLED',
      'Position race preview is not available yet.',404);
}

export const GET=protectedRoute(async req=>{
  enabled();
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const db=databaseClient();
  const {data,error}=await db.from(
    'recovery_position_race_recordings')
    .select('document,recorded_at')
    .eq('event_id',eventId).maybeSingle();
  if(error)throw new AuthError('POSITION_VIEWER_UNAVAILABLE',
    'Could not load the recorded position race.',503);
  if(!data)throw new AuthError('POSITION_VIEWER_NOT_RECORDED',
    'This position race has not been recorded.',404);
  const broadcast=recordedGameBroadcastV1({
    recorded_at:data.recorded_at,
    race_id:data.document.raceId,
    duration:data.document.feed?.duration,
    events:data.document.feed?.events},Date.now());
  if(!broadcast.recordingPublished)
    throw new AuthError('POSITION_VIEWER_NOT_PUBLISHED',
      'The position race recording is not published yet.',425);
  const document=verifyGameSnapshotPositionViewerDocumentV1(
    data.document);
  return NextResponse.json({...document,
    recording:{version:'physical-position-recording-v1',
      recordedAt:data.recorded_at}});
},{admin:true});

export const POST=protectedRoute(async req=>{
  enabled();
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  const eventId=uuid(body.event_id);
  const db=databaseClient();
  const {data:existing,error:existingError}=await db.from(
    'recovery_position_race_recordings')
    .select('document,recorded_at')
    .eq('event_id',eventId).maybeSingle();
  if(existingError)throw new AuthError('POSITION_VIEWER_UNAVAILABLE',
    'Could not check the position race recording.',503);
  if(existing){
    const document=verifyGameSnapshotPositionViewerDocumentV1(
      existing.document);
    return NextResponse.json({ok:true,event_id:eventId,
      sha256:document.sha256,
      recorded_at:existing.recorded_at,already_recorded:true});
  }
  let recording;
  try{
    recording=await loadGameSnapshotPositionRaceRecordingV1({
      readSnapshot:()=>retryUnavailableRead(()=>rpc(db,
        'recovery_race_snapshot',{p_event:eventId})),
      readEntries:id=>retryUnavailableRead(async()=>{
        const {data,error}=await db.from(
          'recovery_physical_entry_inputs')
          .select('event_id,team_id,schema_version,selected_riders,captain_id,orders,stake,team_style,rider_numbers')
          .eq('event_id',id).order('team_id');
        if(error)throw new AuthError(
          'POSITION_VIEWER_UNAVAILABLE',
          'Could not read committed race entries.',503);
        return data;
      })});
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw new AuthError('POSITION_VIEWER_UNAVAILABLE',
      error.message,409);
  }
  if(recording.bundle.document.input.eventId!==eventId)
    throw new AuthError('POSITION_VIEWER_UNAVAILABLE',
      'Position recording belongs to another event.',409);
  const archive=encodeGameSnapshotPositionRaceArchiveV2(
    recording.bundle);
  const receipt=await rpc(db,
    'recovery_save_position_race_recording_v1',{
      p_event:eventId,
      p_snapshot:recording.snapshot,
      p_entries:recording.entries,
      p_document:recording.bundle.document,
      p_archive_metadata:archive.metadata,
      p_archive_base64:archive.body.toString('base64')});
  return NextResponse.json({ok:true,...receipt});
},{admin:true});
