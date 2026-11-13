import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

// Select only a helper who can physically reach the dropped leader. The same
// helper can keep working while both riders remain in the dropped group.
export function selectCaptainSupport(team,states,km){
  if(orderAt(team.orders,km-1).captainSupport!=='drop_back_if_dropped')return null;
  const byId=new Map(states.map(state=>[state.id,state]));
  const leader=byId.get(team.activeLeaderId);
  if(leader?.group!=='dropped')return null;
  const floor=TUNING.captainSupport.helperEnergyFloor;
  const existing=byId.get(team.supportingHelperId);
  if(existing?.group==='dropped'&&existing.deficitSeconds<=leader.deficitSeconds+1&&
    leader.deficitSeconds-existing.deficitSeconds<=TUNING.captainSupport.maxDropBackGapSeconds&&
    Number(team.energy[existing.id])>floor)return existing.id;
  const fresh=team.riders.filter(rider=>team.orders.helperIds.includes(rider.id)&&
    byId.get(rider.id)?.group==='peloton'&&Number(team.energy[rider.id])>floor&&
    leader.deficitSeconds-byId.get(rider.id).deficitSeconds<=
      TUNING.captainSupport.maxDropBackGapSeconds)
    .sort((a,b)=>b.strength-a.strength||String(a.id).localeCompare(String(b.id)))[0];
  return fresh?.id??null;
}

// A helper drops to the captain's position and reduces their deficit. The
// helper cannot be credited with support from a group farther down the road.
export function applyCaptainSupport(states,{team,leaderId,helperId}){
  const teamId=team.id;
  const leader=states.find(state=>state.id===leaderId&&state.teamId===teamId);
  const helper=states.find(state=>state.id===helperId&&state.teamId===teamId);
  if(!leader||!helper)return {states,event:null};
  if(leader.group!=='dropped')return {states,event:{teamId,leaderId,helperId,recoveredSeconds:0}};
  const tune=TUNING.captainSupport;
  if(helper.deficitSeconds>leader.deficitSeconds+1||
    leader.deficitSeconds-helper.deficitSeconds>tune.maxDropBackGapSeconds)
    return {states,event:null};
  const strength=team.riders.find(rider=>rider.id===helperId)?.strength??0;
  const recovery=Math.min(leader.deficitSeconds,tune.maxRecoverySecondsPerKm,
    tune.deficitRecoverySecondsPerStrengthPoint*strength);
  const leaderDeficit=+(leader.deficitSeconds-recovery).toFixed(3);
  const helperDeficit=Math.max(helper.deficitSeconds,leaderDeficit);
  const updated=states.map(state=>state.id===leaderId?{...state,deficitSeconds:leaderDeficit,
    group:leaderDeficit>TUNING.groups.droppedAtSeconds?'dropped':'peloton'}:
    state.id===helperId?{...state,deficitSeconds:helperDeficit,
      group:helperDeficit>TUNING.groups.droppedAtSeconds?'dropped':'peloton'}:state);
  return {states:updated,event:{teamId,leaderId,helperId,recoveredSeconds:+recovery.toFixed(3)}};
}
