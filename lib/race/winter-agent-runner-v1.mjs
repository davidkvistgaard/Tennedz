import {AuthError} from '../auth/policy.mjs';
import {preparePhysicalEntryV1} from './physical-entry-v1.mjs';
import {physicalEntryEnabledForEventV1} from './physical-entry-target-v1.mjs';
import {planWinterAgentTacticsV1,
  WINTER_AGENT_TACTICS_VERSION} from './winter-agent-tactics-v1.mjs';

export const WINTER_AGENT_EVENT_ID='109a9235-44e6-d390-1fa9-aec19b65cf3b';

function checked(result,label){
  if(result.error)throw new AuthError('AGENT_TACTICS_UNAVAILABLE',
    `Could not load ${label}.`,503);
  return result.data;
}

export async function runWinterAgentTacticsV1({db,rpc,environment,
  now=new Date()}){
  if(environment.PELOTONIA_WINTER_AGENT_TACTICS_ENABLED!=='true'||
    !physicalEntryEnabledForEventV1(WINTER_AGENT_EVENT_ID,environment))
    return {ok:true,enabled:false};
  const event=checked(await db.from('events')
    .select('id,gender,status,deadline,stage_profile_id')
    .eq('id',WINTER_AGENT_EVENT_ID).maybeSingle(),'the pilot event');
  if(!event||event.gender!=='M'||event.status!=='OPEN'||
    !Number.isFinite(Date.parse(event.deadline))||
    Date.parse(event.deadline)<=now.getTime())
    throw new AuthError('AGENT_TACTICS_CLOSED',
      'The pilot event is not open for tactics.',409);
  const stage=checked(await db.from('stage_profiles')
    .select('distance_km,keypoints,tags')
    .eq('id',event.stage_profile_id).maybeSingle(),'the pilot route');
  if(!stage)throw new AuthError('AGENT_TACTICS_UNAVAILABLE',
    'The pilot route is missing.',503);
  const entries=checked(await db.from('event_teams')
    .select('team_id,selected_riders,captain_id')
    .eq('event_id',WINTER_AGENT_EVENT_ID).order('team_id'),
  'entered teams')??[];
  const existing=checked(await db.from('recovery_physical_entry_inputs')
    .select('team_id').eq('event_id',WINTER_AGENT_EVENT_ID),
  'committed tactics')??[];
  const committed=new Set(existing.map(row=>row.team_id));
  const results=[];
  for(const entry of entries){
    const team=checked(await db.from('teams')
      .select('id,user_id,name').eq('id',entry.team_id)
      .maybeSingle(),'the entered team');
    if(!team)throw new AuthError('AGENT_TACTICS_UNAVAILABLE',
      'An entered team is missing.',503);
    const isAgent=await rpc(db,'recovery_is_winter_agent_v1',{
      p_user:team.user_id,p_event:WINTER_AGENT_EVENT_ID});
    if(!isAgent)continue;
    if(committed.has(team.id)){
      results.push({team_id:team.id,state:'already_committed'});
      continue;
    }
    const [ridersResult,kitResult]=await Promise.all([
      db.from('riders')
        .select('id,sprint,flat,hills,endurance,leadership,strength')
        .in('id',entry.selected_riders),
      db.from('club_identities').select('palette,pattern')
        .eq('team_id',team.id).maybeSingle(),
    ]);
    const riders=checked(ridersResult,'selected riders');
    const kit=checked(kitResult,'the club identity');
    const plan=planWinterAgentTacticsV1({entry,riders,stage});
    const prepared=preparePhysicalEntryV1({body:{
      version:'physical-entry-request-v1',
      selected_riders:entry.selected_riders,
      captain_id:entry.captain_id,orders:plan.orders,
      stake:plan.stake},stage,team,savedKit:kit});
    await rpc(db,'recovery_join_winter_agent_event_physical_v1',{
      p_user:team.user_id,p_event:WINTER_AGENT_EVENT_ID,
      p_riders:entry.selected_riders,p_captain:entry.captain_id,
      p_orders:prepared.orders,p_stake:prepared.stake,
      p_team_style:prepared.teamStyle,
      p_policy_version:WINTER_AGENT_TACTICS_VERSION,
      p_reason:plan.reason});
    results.push({team_id:team.id,state:'committed',
      policy_version:plan.version,reason:plan.reason});
  }
  return {ok:true,enabled:true,event_id:WINTER_AGENT_EVENT_ID,
    committed:results.filter(row=>row.state==='committed').length,
    already_committed:results.filter(row=>
      row.state==='already_committed').length,results};
}
