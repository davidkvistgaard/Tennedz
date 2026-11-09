import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from
  '../../../../lib/auth/server';
import {assertTeamId,AuthError} from
  '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {preparePhysicalEntryV1} from
  '../../../../lib/race/physical-entry-v1.mjs';

function enabled(){
  if(process.env.PELOTONIA_PHYSICAL_ENTRY_ENABLED!=='true')
    throw new AuthError('PHYSICAL_ENTRY_DISABLED',
      'Physical race entry is not available yet.',404);
}

export const POST=protectedRoute(async(req,context,auth)=>{
  enabled();
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  assertTeamId(body.team_id,auth.team.id);
  const eventId=uuid(body.event_id);
  if(!Array.isArray(body.selected_riders)||
    body.selected_riders.length!==8)
    throw new AuthError('INVALID_LINEUP','Select eight riders.',400);
  const riderIds=body.selected_riders.map(uuid);
  const captainId=uuid(body.captain_id);
  const [{data:event,error:eventError},
    {data:kit,error:kitError}]=await Promise.all([
    auth.db.from('events').select('stage_profile_id')
      .eq('id',eventId).maybeSingle(),
    auth.db.from('club_identities').select('palette,pattern')
      .eq('team_id',auth.team.id).maybeSingle()]);
  if(eventError||kitError)
    throw new AuthError('ENTRY_UNAVAILABLE',
      'Could not load race or club identity.',503);
  if(!event)
    throw new AuthError('RACE_NOT_FOUND',
      'The race was not found.',404);
  const {data:stage,error:stageError}=await auth.db
    .from('stage_profiles').select('distance_km,keypoints')
    .eq('id',event.stage_profile_id).maybeSingle();
  if(stageError||!stage)
    throw new AuthError('ROUTE_UNAVAILABLE',
      'Could not load the race route.',503);
  let prepared;
  try{prepared=preparePhysicalEntryV1({body:{...body,
    selected_riders:riderIds,captain_id:captainId},
  stage,team:auth.team,savedKit:kit});}
  catch(error){throw new AuthError('INVALID_PHYSICAL_ENTRY',
    error.message,400);}
  const result=await rpc(auth.db,
    'recovery_join_event_physical_v1',{
      p_user:auth.user.id,p_event:eventId,
      p_riders:riderIds,p_captain:captainId,
      p_orders:prepared.orders,p_stake:prepared.stake,
      p_team_style:prepared.teamStyle});
  return NextResponse.json(result);
});

export const GET=protectedRoute(async(req,context,auth)=>{
  enabled();
  const eventId=uuid(new URL(req.url).searchParams.get('event_id'));
  const {data,error}=await auth.db
    .from('recovery_physical_entry_inputs')
    .select('schema_version,selected_riders,captain_id,orders,stake,team_style,rider_numbers')
    .eq('event_id',eventId).eq('team_id',auth.team.id)
    .maybeSingle();
  if(error)
    throw new AuthError('ENTRY_UNAVAILABLE',
      'Could not load the physical race entry.',503);
  return NextResponse.json({ok:true,entry:data});
});
