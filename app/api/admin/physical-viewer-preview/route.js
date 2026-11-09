import {NextResponse} from 'next/server';
import {protectedRoute,databaseClient,requireGameWrites} from
  '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {loadLockedPhysicalGameRaceRecordInputV1} from
  '../../../../lib/viewer/physical-game-race-source-v1.mjs';
import {verifyPhysicalFirstRaceDocument} from
  '../../../../lib/viewer/physical-first-race-document-v3.mjs';
import {recordedGameBroadcastV1} from
  '../../../../lib/viewer/recorded-game-broadcast-v1.mjs';

export const maxDuration=60;

function enabled(){
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_PREVIEW_ENABLED!==
      'true')
    throw new AuthError('PHYSICAL_VIEWER_DISABLED',
      'Physical race preview is not available yet.',404);
}

export const GET=protectedRoute(async req=>{
  enabled();
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const db=databaseClient();
  const {data,error}=await db.from(
    'recovery_physical_viewer_recordings')
    .select('document,recorded_at')
    .eq('event_id',eventId).maybeSingle();
  if(error)throw new AuthError('PHYSICAL_VIEWER_UNAVAILABLE',
    'Could not load the recorded physical race.',503);
  if(!data)throw new AuthError('PHYSICAL_VIEWER_NOT_RECORDED',
    'This physical race has not been recorded.',404);
  const broadcast=recordedGameBroadcastV1({
    recorded_at:data.recorded_at,
    race_id:data.document.raceId,
    duration:data.document.feed?.duration,
    events:data.document.feed?.events},Date.now());
  if(!broadcast.recordingPublished)
    throw new AuthError('PHYSICAL_VIEWER_NOT_PUBLISHED',
      'The physical race recording is not published yet.',425);
  const document=verifyPhysicalFirstRaceDocument(data.document);
  return NextResponse.json({...document,
    recording:{version:'physical-viewer-recording-v1',
      recordedAt:data.recorded_at}});
},{admin:true});

export const POST=protectedRoute(async req=>{
  enabled();
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  const eventId=uuid(body.event_id);
  const db=databaseClient();
  const {data:existing,error:existingError}=await db.from(
    'recovery_physical_viewer_recordings')
    .select('document,recorded_at')
    .eq('event_id',eventId).maybeSingle();
  if(existingError)throw new AuthError('PHYSICAL_VIEWER_UNAVAILABLE',
    'Could not check the physical race recording.',503);
  if(existing){
    const document=verifyPhysicalFirstRaceDocument(
      existing.document);
    return NextResponse.json({ok:true,event_id:eventId,
      sha256:document.sha256,
      recorded_at:existing.recorded_at,already_recorded:true});
  }
  let input;
  try{
    input=await loadLockedPhysicalGameRaceRecordInputV1({
      readSnapshot:()=>rpc(db,'recovery_race_snapshot',
        {p_event:eventId}),
      readEntries:async id=>{
        const {data,error}=await db.from(
          'recovery_physical_entry_inputs')
          .select('event_id,team_id,schema_version,selected_riders,captain_id,orders,stake,team_style,rider_numbers')
          .eq('event_id',id).order('team_id');
        if(error)throw new Error('Could not read committed race entries.');
        return data;
      },
      commitSource:({snapshot,entries,seed,weather})=>rpc(db,
        'recovery_lock_physical_viewer_source_v1',{
          p_event:eventId,p_snapshot:snapshot,p_entries:entries,
          p_seed:seed,p_weather:weather})});
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw new AuthError('PHYSICAL_VIEWER_UNAVAILABLE',
      error.message,409);
  }
  const receipt=await rpc(db,
    'recovery_save_physical_viewer_recording_v1',{
      p_event:eventId,p_snapshot:input.snapshot,
      p_entries:input.entries,p_document:input.document});
  return NextResponse.json({ok:true,...receipt});
},{admin:true});
