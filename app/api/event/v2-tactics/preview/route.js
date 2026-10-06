import {NextResponse} from 'next/server';
import {protectedRoute} from '../../../../../lib/auth/server';
import {AuthError,assertTeamId} from '../../../../../lib/auth/policy.mjs';
import {uuid} from '../../../../../lib/race/server';
import {normalizeEnteredV2Orders} from '../../../../../lib/race/v2-tactics.mjs';

// Preview-only validation. No v2 orders are persisted or used by the live race.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_PREVIEW_ENABLED!=='true')
    throw new AuthError('V2_PREVIEW_DISABLED','This tactics preview is unavailable.',404);
  const body=await req.json().catch(()=>({}));
  if(!body||typeof body!=='object'||Array.isArray(body))
    throw new AuthError('INVALID_V2_ORDERS','Enter a v2 tactics plan.',400);
  assertTeamId(body.team_id,auth.team.id);
  const eventId=uuid(body.event_id);
  const {data:event,error:eventError}=await auth.db.from('events')
    .select('id,kind,gender,status,registration_deadline,tactics_deadline,stage_profile_id')
    .eq('id',eventId).maybeSingle();
  if(eventError)throw new AuthError('V2_PREVIEW_UNAVAILABLE','Could not check the race.',503);
  const now=Date.now();
  if(event?.kind!=='one_day'||!['M','F'].includes(event.gender)||
    event.status!=='OPEN'||!event.stage_profile_id||
    !Number.isFinite(Date.parse(event.registration_deadline))||
    !Number.isFinite(Date.parse(event.tactics_deadline))||
    Date.parse(event.registration_deadline)>now||Date.parse(event.tactics_deadline)<=now)
    throw new AuthError('V2_PREPARATION_CLOSED','This race is outside tactics preparation.',409);
  const [entryResponse,revealResponse,lockResponse,stageResponse]=await Promise.all([
    auth.db.from('event_teams').select('team_id,selected_riders,captain_id')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_division_reveal_entries').select('division_index')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_tactics_commits').select('event_id')
      .eq('event_id',eventId).maybeSingle(),
    auth.db.from('stage_profiles').select('distance_km,keypoints')
      .eq('id',event.stage_profile_id).maybeSingle(),
  ]);
  if(entryResponse.error||revealResponse.error||lockResponse.error||stageResponse.error)
    throw new AuthError('V2_PREVIEW_UNAVAILABLE','Could not check the saved race input.',503);
  if(!entryResponse.data||!revealResponse.data)
    throw new AuthError('NOT_ENTERED','Your team is not in the revealed race.',403);
  if(lockResponse.data||!stageResponse.data)
    throw new AuthError('V2_PREPARATION_CLOSED','This race is outside tactics preparation.',409);
  let orders;
  try{
    orders=normalizeEnteredV2Orders(entryResponse.data,stageResponse.data,body.orders);
  }catch(error){
    throw new AuthError('INVALID_V2_ORDERS',error.message,400);
  }
  return NextResponse.json({ok:true,event_id:eventId,team_id:auth.team.id,
    division_index:revealResponse.data.division_index,orders,saved:false});
});
