// Isolated stage-race accounting. The caller supplies classified stage times;
// this module does not invent bonuses, same-group timing or abandonment rules.
import {assertRoadGroups} from './road-groups.mjs';
function validId(value){
  return typeof value==='string'&&value.length>0&&value.length<=160;
}

export function startGeneralClassification({raceCategory,riders}){
  if(!['M','F'].includes(raceCategory)||!Array.isArray(riders)||riders.length<2||
    riders.some(rider=>!validId(rider?.riderId)||!validId(rider?.teamId)||
      rider.gender!==raceCategory)||
    new Set(riders.map(rider=>rider.riderId)).size!==riders.length)
    throw new Error('Invalid classification roster.');
  return {version:1,raceCategory,completedStageIds:[],
    standings:[...riders].sort((a,b)=>a.riderId.localeCompare(b.riderId)).map(rider=>({
      riderId:rider.riderId,teamId:rider.teamId,totalMilliseconds:0,position:null,
    }))};
}

export function recordGeneralClassificationStage(previous,{stageId,classifiedTimes}){
  if(previous?.version!==1||!['M','F'].includes(previous.raceCategory)||
    !Array.isArray(previous.completedStageIds)||!Array.isArray(previous.standings)||
    previous.completedStageIds.some(id=>!validId(id))||
    new Set(previous.completedStageIds).size!==previous.completedStageIds.length||
    previous.standings.some(row=>!validId(row?.riderId)||!validId(row?.teamId)||
      !Number.isSafeInteger(row?.totalMilliseconds)||row.totalMilliseconds<0)||
    !validId(stageId)||previous.completedStageIds.includes(stageId)||
    !Array.isArray(classifiedTimes)||classifiedTimes.length!==previous.standings.length)
    throw new Error('Invalid classification stage.');
  if(previous.completedStageIds.length===0){
    if(previous.standings.some(row=>row.totalMilliseconds!==0||row.position!==null))
      throw new Error('Invalid initial classification.');
  }else{
    validateGeneralClassificationForRace(previous,{raceCategory:previous.raceCategory,
      riders:previous.standings.map(row=>({riderId:row.riderId,teamId:row.teamId}))});
  }
  const previousById=new Map(previous.standings.map(rider=>[rider.riderId,rider]));
  if(previousById.size!==previous.standings.length||
    new Set(classifiedTimes.map(row=>row?.riderId)).size!==classifiedTimes.length)
    throw new Error('Invalid classification roster.');
  const next=classifiedTimes.map(row=>{
    const before=previousById.get(row?.riderId);
    const milliseconds=row?.timeSeconds*1000;
    if(!before||typeof row.timeSeconds!=='number'||!Number.isFinite(milliseconds)||
      milliseconds<0||
      !Number.isSafeInteger(Math.round(milliseconds))||
      Math.abs(milliseconds-Math.round(milliseconds))>1e-6)
      throw new Error('Invalid classified stage time.');
    const totalMilliseconds=before.totalMilliseconds+Math.round(milliseconds);
    if(!Number.isSafeInteger(before.totalMilliseconds)||before.totalMilliseconds<0||
      !Number.isSafeInteger(totalMilliseconds))
      throw new Error('Invalid previous classification time.');
    return {riderId:before.riderId,teamId:before.teamId,totalMilliseconds};
  }).sort((a,b)=>a.totalMilliseconds-b.totalMilliseconds||
    a.riderId.localeCompare(b.riderId));
  let position=0;
  const standings=next.map((rider,index)=>{
    if(index===0||rider.totalMilliseconds!==next[index-1].totalMilliseconds)
      position=index+1;
    return {...rider,position};
  });
  return {version:1,raceCategory:previous.raceCategory,
    completedStageIds:[...previous.completedStageIds,stageId],standings};
}

// Compare provisional road positions with the standings BEFORE this stage.
// A shared stage-time baseline cancels out of the ordering. This estimate has
// no finish prediction and must never replace officially classified times.
export function projectGeneralClassification(classification,{roadGroups,riderStates}){
  if(classification?.version!==1||!Array.isArray(classification.completedStageIds)||
    classification.completedStageIds.length===0||!Array.isArray(classification.standings)||
    !Array.isArray(riderStates)||riderStates.length!==classification.standings.length)
    throw new Error('A completed stage and full rider state are required for GC projection.');
  assertRoadGroups(roadGroups);
  const stateById=new Map(riderStates.map(state=>[state?.id,state]));
  const groupByRider=new Map(roadGroups.flatMap(group=>group.riderIds.map(id=>[id,group])));
  if(stateById.size!==riderStates.length||
    roadGroups.some(group=>{
      const members=new Set(group.riderIds.map(id=>stateById.get(id)?.teamId));
      return members.size!==group.teamIds.length||
        group.teamIds.some(id=>!members.has(id));
    })||
    classification.standings.some(row=>{
      const state=stateById.get(row.riderId);
      return !state||state.teamId!==row.teamId||
        !Number.isSafeInteger(row.totalMilliseconds)||row.totalMilliseconds<0||
        !['breakaway','peloton','dropped'].includes(state.group)||
        !Number.isFinite(state.deficitSeconds)||state.deficitSeconds<0||
        (state.group==='breakaway')!==groupByRider.has(row.riderId);
    })||[...groupByRider.keys()].some(id=>!stateById.has(id)))
    throw new Error('Invalid rider state for GC projection.');
  const projected=classification.standings.map(row=>{
    const state=stateById.get(row.riderId),roadGroup=groupByRider.get(row.riderId);
    const roadOffset=roadGroup?-Math.round(roadGroup.gapSeconds*1000):
      state.group==='dropped'?Math.round(state.deficitSeconds*1000):0;
    if(!Number.isSafeInteger(roadOffset)||
      !Number.isSafeInteger(row.totalMilliseconds+roadOffset))
      throw new Error('Invalid projected classification time.');
    return {riderId:row.riderId,teamId:row.teamId,
      projectedMilliseconds:row.totalMilliseconds+roadOffset,
      roadGroupId:roadGroup?.id??null};
  }).sort((a,b)=>a.projectedMilliseconds-b.projectedMilliseconds||
    a.riderId.localeCompare(b.riderId));
  let position=0;
  return projected.map((row,index)=>{
    if(index===0||row.projectedMilliseconds!==projected[index-1].projectedMilliseconds)
      position=index+1;
    return {...row,position};
  });
}

// Report a threatened top-ten place as an observable race fact. This does not
// decide whether a team should chase: its committed orders and other tactical
// obligations remain separate from the classification calculation.
export function identifyTopTenThreats(classification,{roadGroups,riderStates},
  {warningMarginSeconds=0}={}){
  if(!Number.isFinite(warningMarginSeconds)||warningMarginSeconds<0||
    warningMarginSeconds>30)throw new Error('Invalid GC warning margin.');
  const projected=projectGeneralClassification(classification,{roadGroups,riderStates});
  const projectedById=new Map(projected.map(row=>[row.riderId,row]));
  const priorById=new Map(classification.standings.map(row=>[row.riderId,row]));
  const statesById=new Map(riderStates.map(state=>[state.id,state]));
  return classification.standings.filter(row=>row.position!==null&&row.position<=10&&
    statesById.get(row.riderId).group==='peloton'&&
    (projectedById.get(row.riderId).position>10||warningMarginSeconds>0)).map(row=>({
      teamId:row.teamId,riderId:row.riderId,priorPosition:row.position,
      projectedPosition:projectedById.get(row.riderId).position,
      rivalRiderIds:projected.filter(rival=>rival.teamId!==row.teamId&&
        rival.roadGroupId!==null&&
        rival.projectedMilliseconds<=projectedById.get(row.riderId).projectedMilliseconds+
          Math.round(warningMarginSeconds*1000)&&
        priorById.get(rival.riderId).position>10)
        .map(rival=>rival.riderId),
    })).filter(threat=>threat.rivalRiderIds.length>0);
}

export function identifyTopTenOpportunities(classification,{roadGroups,riderStates}){
  const projected=projectGeneralClassification(classification,{roadGroups,riderStates});
  const projectedById=new Map(projected.map(row=>[row.riderId,row]));
  const statesById=new Map(riderStates.map(state=>[state.id,state]));
  const tenth=classification.standings.filter(row=>row.position<=10).at(-1);
  if(!tenth)return [];
  return classification.standings.filter(row=>row.position>10&&row.position<=15&&
    statesById.get(row.riderId).group==='peloton'&&
    projectedById.get(row.riderId).position>10).map(row=>({
      teamId:row.teamId,riderId:row.riderId,priorPosition:row.position,
      projectedPosition:projectedById.get(row.riderId).position,
      gapToTopTenSeconds:(row.totalMilliseconds-tenth.totalMilliseconds)/1000,
    }));
}

// A team close to the top-ten boundary can precommit to marking a nearby GC
// rival's attack. The rival must still be in the peloton; actual chase capacity
// is resolved separately on the kilometre in which the attack occurs.
export function gcGuardRiderIds(classification,opportunities,{leaderRiderId,teamId,
  maxPriorGapSeconds}){
  if(!Number.isFinite(maxPriorGapSeconds)||maxPriorGapSeconds<0||
    maxPriorGapSeconds>60)throw new Error('Invalid GC guard gap.');
  const leader=classification.standings.find(row=>row.riderId===leaderRiderId);
  if(!leader||leader.teamId!==teamId||leader.position<9||leader.position>10)return [];
  return opportunities.filter(opportunity=>opportunity.teamId!==teamId&&
    classification.standings.find(row=>row.riderId===opportunity.riderId)
      .totalMilliseconds-leader.totalMilliseconds<=maxPriorGapSeconds*1000)
    .map(opportunity=>opportunity.riderId);
}

export function validateGeneralClassificationForRace(classification,{raceCategory,riders}){
  if(!Array.isArray(riders)||riders.some(rider=>!validId(rider?.riderId)||
    !validId(rider?.teamId))||
    new Set(riders.map(rider=>rider.riderId)).size!==riders.length||
    classification?.version!==1||classification.raceCategory!==raceCategory||
    !Array.isArray(classification.completedStageIds)||
    classification.completedStageIds.length<1||
    classification.completedStageIds.some(id=>!validId(id))||
    new Set(classification.completedStageIds).size!==classification.completedStageIds.length||
    !Array.isArray(classification.standings)||
    classification.standings.length!==riders.length)
    throw new Error('Invalid committed GC classification.');
  const roster=new Map(riders.map(rider=>[rider.riderId,rider.teamId]));
  const seen=new Set();
  for(const [index,row] of classification.standings.entries()){
    if(!validId(row?.riderId)||!validId(row?.teamId)||
      !roster.has(row.riderId)||roster.get(row.riderId)!==row.teamId||
      seen.has(row.riderId)||!Number.isSafeInteger(row.totalMilliseconds)||
      row.totalMilliseconds<0||!Number.isInteger(row.position)||
      row.position<1||row.position>riders.length||
      index>0&&classification.standings[index-1].totalMilliseconds>row.totalMilliseconds||
      row.position!==(index>0&&classification.standings[index-1].totalMilliseconds===
        row.totalMilliseconds?classification.standings[index-1].position:index+1))
      throw new Error('Invalid committed GC classification.');
    seen.add(row.riderId);
  }
  if(seen.size!==roster.size)throw new Error('Invalid committed GC classification.');
  return true;
}
