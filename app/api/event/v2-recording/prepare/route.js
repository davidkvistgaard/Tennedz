import {NextResponse} from 'next/server';
import {protectedRoute,requireGameWrites} from '../../../../../lib/auth/server';
import {AuthError,assertTeamId} from '../../../../../lib/auth/policy.mjs';
import {rpc,uuid} from '../../../../../lib/race/server';
import {previewLockedV2RecordedDivisions} from '../../../../../lib/race/v2-candidate.mjs';
import {buildV2OneDayResultContract,validateV2OneDayResultAgainstLock}
  from '../../../../../lib/race/v2-result-contract.mjs';
import {projectV2RecordedDivisionForTeam} from '../../../../../lib/race/v2-viewer.mjs';

// Records a private, provisional v2 candidate only. The existing event,
// player-visible results, replay and ranking ledger remain untouched.
export const POST=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_RECORDING_ENABLED!=='true')
    throw new AuthError('V2_RECORDING_DISABLED','V2 recording is unavailable.',404);
  requireGameWrites();
  const body=await req.json().catch(()=>({}));
  if(!body||typeof body!=='object'||Array.isArray(body))
    throw new AuthError('INVALID_RACE','Choose a scheduled race.',400);
  assertTeamId(body.team_id,auth.team.id);
  const eventId=uuid(body.event_id);
  const [entry,reveal]=await Promise.all([
    auth.db.from('event_teams').select('team_id').eq('event_id',eventId)
      .eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_division_reveal_entries').select('division_index')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
  ]);
  if(entry.error||reveal.error)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','Could not check the race entry.',503);
  if(!entry.data||!reveal.data)
    throw new AuthError('NOT_ENTERED','Your team is not in the revealed race.',403);
  const existing=await auth.db.from('recovery_v2_recorded_candidates')
    .select('recorded_at').eq('event_id',eventId).maybeSingle();
  if(existing.error)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','Could not check the recording.',503);
  if(existing.data)
    return NextResponse.json({ok:true,event_id:eventId,
      division_index:reveal.data.division_index,
      recorded_at:existing.data.recorded_at,already_recorded:true});
  const locked=await auth.db.from('recovery_v2_tactics_commits')
    .select('input_snapshot').eq('event_id',eventId).maybeSingle();
  if(locked.error)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','Could not load the tactics lock.',503);
  if(!locked.data)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','The v2 tactics input is not locked.',409);
  const input=locked.data.input_snapshot;
  let contract;
  try{
    const candidate=previewLockedV2RecordedDivisions(input);
    contract=buildV2OneDayResultContract(candidate,{tier:input.event.race_tier});
    validateV2OneDayResultAgainstLock(input,contract);
  }catch(error){
    throw new AuthError('V2_RECORDING_INVALID',error.message,409);
  }
  const saved=await rpc(auth.db,'recovery_save_v2_recorded_candidate',{
    p_event:eventId,p_contract:contract,
  });
  return NextResponse.json({ok:true,event_id:eventId,
    division_index:reveal.data.division_index,
    recorded_at:saved.recordedAt,already_recorded:saved.alreadyRecorded});
});

export const GET=protectedRoute(async(req,context,auth)=>{
  if(process.env.RACE_LAB_ENABLED!=='true'||
    process.env.PELOTONIA_V2_RECORDING_ENABLED!=='true')
    throw new AuthError('V2_RECORDING_DISABLED','V2 recording is unavailable.',404);
  const url=new URL(req.url);
  assertTeamId(url.searchParams.get('team_id'),auth.team.id);
  const eventId=uuid(url.searchParams.get('event_id'));
  const [entry,reveal]=await Promise.all([
    auth.db.from('event_teams').select('team_id').eq('event_id',eventId)
      .eq('team_id',auth.team.id).maybeSingle(),
    auth.db.from('recovery_division_reveal_entries').select('division_index')
      .eq('event_id',eventId).eq('team_id',auth.team.id).maybeSingle(),
  ]);
  if(entry.error||reveal.error)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','Could not check the race entry.',503);
  if(!entry.data||!reveal.data)
    throw new AuthError('NOT_ENTERED','Your team is not in the revealed race.',403);
  const stored=await auth.db.from('recovery_v2_recorded_candidates')
    .select('result_contract,recorded_at').eq('event_id',eventId).maybeSingle();
  if(stored.error)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','Could not load the recording.',503);
  if(!stored.data)
    throw new AuthError('V2_RECORDING_UNAVAILABLE','The v2 recording is not ready.',404);
  let projection;
  try{
    projection=projectV2RecordedDivisionForTeam(stored.data.result_contract,auth.team.id);
  }catch{
    throw new AuthError('V2_RECORDING_INVALID','The saved v2 recording needs review.',409);
  }
  if(projection.divisionIndex!==reveal.data.division_index)
    throw new AuthError('V2_RECORDING_INVALID','The saved v2 recording needs review.',409);
  return NextResponse.json({...projection,recordedAt:stored.data.recorded_at});
});
