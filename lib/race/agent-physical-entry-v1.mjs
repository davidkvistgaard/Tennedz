import {createHmac,timingSafeEqual} from 'node:crypto';
import {AuthError} from '../auth/policy.mjs';
import {preparePhysicalEntryV1} from './physical-entry-v1.mjs';
import {physicalEntryEnabledForEventV1} from './physical-entry-target-v1.mjs';

const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const AGENT_COHORT='winter-2026';
const TOKEN=/^Bearer v1\.([0-9a-f]{64})$/i;

function id(value){
  if(typeof value!=='string'||!UUID.test(value))
    throw new AuthError('INVALID_ID','Invalid race or team ID.',400);
  return value.toLowerCase();
}

export function agentPhysicalEntryTokenV1(secret,eventId,teamId){
  if(typeof secret!=='string'||secret.length<32)
    throw new AuthError('AGENT_ENTRY_UNAVAILABLE',
      'Agent race entry is not configured.',503);
  return `v1.${createHmac('sha256',secret).update(
    `pelotonia-agent-physical-entry-v1\n${id(eventId)}\n${id(teamId)}`
  ).digest('hex')}`;
}

export function assertAgentPhysicalEntryTokenV1(
  authorization,secret,eventId,teamId){
  const expected=agentPhysicalEntryTokenV1(secret,eventId,teamId);
  const provided=TOKEN.exec(authorization??'')?.[1];
  if(!provided||!timingSafeEqual(Buffer.from(provided,'hex'),
    Buffer.from(expected.slice(3),'hex')))
    throw new AuthError('UNAUTHENTICATED_AGENT',
      'Agent authorization is required.',401);
}

export function assertAgentPhysicalEntryScopeV1({body,entry,user,team}){
  if(user?.app_metadata?.pelotonia_agent!==AGENT_COHORT||
    team?.user_id!==user?.id||team?.id!==body?.team_id||
    !entry||!Array.isArray(entry.selected_riders)||
    !Array.isArray(body.selected_riders)||
    entry.selected_riders.length!==8||
    entry.selected_riders.some((value,index)=>
      value!==body.selected_riders[index])||
    entry.captain_id!==body.captain_id)
    throw new AuthError('AGENT_ENTRY_FORBIDDEN',
      'This agent may only submit tactics for its entered lineup.',403);
}

export async function submitAgentPhysicalEntryV1({body,authorization,
  environment,db,rpc}){
  const eventId=id(body?.event_id);
  const teamId=id(body?.team_id);
  if(!physicalEntryEnabledForEventV1(eventId,environment))
    throw new AuthError('PHYSICAL_ENTRY_DISABLED',
      'Physical race entry is not available for this race.',404);
  assertAgentPhysicalEntryTokenV1(authorization,
    environment.PELOTONIA_AGENT_ENTRY_SIGNING_KEY,eventId,teamId);
  if(!Array.isArray(body.selected_riders)||
    body.selected_riders.length!==8)
    throw new AuthError('INVALID_LINEUP','Select eight riders.',400);
  body.selected_riders.forEach(id);
  id(body.captain_id);
  const [{data:team,error:teamError},
    {data:entry,error:entryError},
    {data:event,error:eventError}]=await Promise.all([
    db.from('teams').select('id,user_id,name').eq('id',teamId)
      .maybeSingle(),
    db.from('event_teams').select('selected_riders,captain_id')
      .eq('event_id',eventId).eq('team_id',teamId).maybeSingle(),
    db.from('events').select('stage_profile_id')
      .eq('id',eventId).maybeSingle()]);
  if(teamError||entryError||eventError)
    throw new AuthError('AGENT_ENTRY_UNAVAILABLE',
      'Could not check the agent race entry.',503);
  if(!team||!entry||!event)
    throw new AuthError('AGENT_ENTRY_FORBIDDEN',
      'This agent has no entry in this race.',403);
  const {data:userData,error:userError}=await db.auth.admin
    .getUserById(team.user_id);
  if(userError||!userData?.user)
    throw new AuthError('AGENT_ENTRY_UNAVAILABLE',
      'Could not verify the agent manager.',503);
  assertAgentPhysicalEntryScopeV1({body,entry,
    user:userData.user,team});
  const [{data:kit,error:kitError},
    {data:stage,error:stageError}]=await Promise.all([
    db.from('club_identities').select('palette,pattern')
      .eq('team_id',teamId).maybeSingle(),
    db.from('stage_profiles').select('distance_km,keypoints')
      .eq('id',event.stage_profile_id).maybeSingle()]);
  if(kitError||stageError||!stage)
    throw new AuthError('AGENT_ENTRY_UNAVAILABLE',
      'Could not load the race route or club identity.',503);
  let prepared;
  try{prepared=preparePhysicalEntryV1({body,stage,team,
    savedKit:kit});}
  catch(error){throw new AuthError('INVALID_PHYSICAL_ENTRY',
    error.message,400);}
  return rpc(db,'recovery_join_agent_event_physical_v1',{
    p_user:team.user_id,p_event:eventId,
    p_riders:body.selected_riders,p_captain:body.captain_id,
    p_orders:prepared.orders,p_stake:prepared.stake,
    p_team_style:prepared.teamStyle});
}
