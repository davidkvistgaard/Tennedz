import {NextResponse} from 'next/server';
import {protectedRoute,databaseClient} from
  '../../../../lib/auth/server';
import {AuthError} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {loadPhysicalGameRaceDocumentV1} from
  '../../../../lib/viewer/physical-game-race-source-v1.mjs';

export const maxDuration=60;

export const GET=protectedRoute(async req=>{
  if(process.env.PELOTONIA_PHYSICAL_VIEWER_PREVIEW_ENABLED!==
      'true')
    throw new AuthError('PHYSICAL_VIEWER_DISABLED',
      'Physical race preview is not available yet.',404);
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const db=databaseClient();
  let document;
  try{
    document=await loadPhysicalGameRaceDocumentV1({
      readSnapshot:()=>rpc(db,'recovery_race_snapshot',
        {p_event:eventId}),
      readEntries:async id=>{
        const {data,error}=await db.from(
          'recovery_physical_entry_inputs')
          .select('event_id,team_id,schema_version,selected_riders,captain_id,orders,stake,team_style,rider_numbers')
          .eq('event_id',id);
        if(error)throw new Error('Could not read committed race entries.');
        return data;
      }});
  }catch(error){
    if(error instanceof AuthError)throw error;
    throw new AuthError('PHYSICAL_VIEWER_UNAVAILABLE',
      error.message,409);
  }
  return NextResponse.json(document);
},{admin:true});
