import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from '../../../../lib/auth/server';
import {AuthError,assertTeamId} from '../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../lib/race/server';
import {prepareV2TacticsRequest} from '../../../../lib/race/v2-tactics-request';

// An isolated draft. The legacy tactics lock, simulator and awards never read it.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_SAVE_ENABLED!=='true')
    throw new AuthError('V2_SAVE_DISABLED','V2 tactics drafts are unavailable.',404);
  requireGameWrites();
  const {eventId,divisionIndex,orders}=await prepareV2TacticsRequest(req,auth);
  const saved=await rpc(auth.db,'recovery_save_v2_tactics_draft',{
    p_user:auth.user.id,p_event:eventId,p_orders:orders,
  });
  return NextResponse.json({...saved,division_index:divisionIndex,orders,saved:true});
});

// Only the entered manager's lineup and private v2 draft are returned. Rival
// plans and the complete tactics lock are never sent to this editor.
export const GET=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_TACTICS_SAVE_ENABLED!=='true')
    throw new AuthError('V2_SAVE_DISABLED','V2 tactics drafts are unavailable.',404);
  const params=new URL(req.url).searchParams;
  if(params.has('team_id'))assertTeamId(params.get('team_id'),auth.team.id);
  const eventId=uuid(params.get('event_id'));
  const [eventResult,entryResult,revealResult,draftResult,
    legacyLockResult,v2LockResult]=await Promise.all([
    auth.db.from('events').select('id,name,kind,gender,status,registration_deadline,tactics_deadline,scheduled_at,stage_profile_id')
      .eq('id',eventId).maybeSingle(),
    auth.db.from('event_teams').select('team_id,selected_riders,captain_id')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_division_reveal_entries').select('division_index')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_v2_tactics_drafts').select('selected_riders,captain_id,orders,saved_at')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_tactics_commits').select('event_id')
      .eq('event_id',eventId).maybeSingle(),
    auth.db.from('recovery_v2_tactics_commits').select('event_id')
      .eq('event_id',eventId).maybeSingle(),
  ]);
  if([eventResult,entryResult,revealResult,draftResult,legacyLockResult,v2LockResult]
    .some(result=>result.error))
    throw new AuthError('V2_PREPARATION_UNAVAILABLE','Could not load your v2 tactics.',503);
  const event=eventResult.data,entry=entryResult.data,reveal=revealResult.data;
  if(!entry||!reveal)
    throw new AuthError('NOT_ENTERED','Your team is not in the revealed race.',403);
  if(event?.kind!=='one_day'||!['M','F'].includes(event.gender)||
    !event.registration_deadline||!event.tactics_deadline||!event.stage_profile_id)
    throw new AuthError('V2_PREPARATION_UNAVAILABLE','This race has no v2 tactics window.',409);
  const stageResult=await auth.db.from('stage_profiles').select('distance_km,keypoints')
    .eq('id',event.stage_profile_id).maybeSingle();
  if(stageResult.error||!stageResult.data)
    throw new AuthError('V2_PREPARATION_UNAVAILABLE','Could not load the race route.',503);
  const draft=draftResult.data;
  const draftCurrent=Boolean(draft&&draft.captain_id===entry.captain_id&&
    draft.selected_riders?.length===entry.selected_riders?.length&&
    draft.selected_riders.every(id=>entry.selected_riders.includes(id)));
  const now=Date.now();
  return NextResponse.json({ok:true,event:{id:event.id,name:event.name,
    gender:event.gender,status:event.status,registration_deadline:event.registration_deadline,
    tactics_deadline:event.tactics_deadline,scheduled_at:event.scheduled_at},
  team_id:auth.team.id,entry:{selected_riders:entry.selected_riders,
    captain_id:entry.captain_id},division_index:reveal.division_index,
  stage:stageResult.data,orders:draftCurrent?draft.orders:null,
  saved_at:draftCurrent?draft.saved_at:null,draft_stale:Boolean(draft&&!draftCurrent),
  editable:event.status==='OPEN'&&Date.parse(event.registration_deadline)<=now&&
    Date.parse(event.tactics_deadline)>now&&!legacyLockResult.data&&!v2LockResult.data,
  server_time:new Date(now).toISOString()});
});
