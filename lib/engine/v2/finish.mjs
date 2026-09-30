import seedrandom from 'seedrandom';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';
import {assertRoadGroups} from './road-groups.mjs';
import {orderAt} from './orders.mjs';

export function segmentBaseSeconds(segment){
  const tune=TUNING.finish,grade=segment.gradientPct;
  const slope=grade>0?grade*tune.climbFactor:Math.max(-.12,grade*tune.descentFactor);
  const surface=segment.surface==='cobbles'?tune.cobbleFactor:segment.surface==='road'?0:tune.roughSurfaceFactor;
  return tune.baseSecondsPerKm*(1+slope+surface+segment.weather.windKph*tune.windFactor+
    segment.weather.rainMm*tune.rainFactor);
}

function finishRows({route,teams,states,breakawayRiderIds=[],gapSeconds=0,roadGroups=null,seed}){
  const finalSegment=route.kilometres.at(-1),ahead=new Set(breakawayRiderIds);
  const roadGroupByRider=new Map();
  if(roadGroups!==null){
    assertRoadGroups(roadGroups);
    for(const group of roadGroups)for(const id of group.riderIds)
      roadGroupByRider.set(id,group);
    const rosterIds=new Set(teams.flatMap(team=>team.riders.map(rider=>rider.id)));
    if([...roadGroupByRider.keys()].some(id=>!rosterIds.has(id)))
      throw new Error('Road group contains a rider outside the finish roster.');
  }
  const stateById=new Map(states.map(state=>[state.id,state]));
  const base=route.kilometres.reduce((sum,segment)=>sum+segmentBaseSeconds(segment),0);
  return teams.flatMap(team=>team.riders.map(rider=>{
    const state=stateById.get(rider.id);
    if(!state)throw new Error(`Missing final state for ${rider.id}.`);
    const finale=riderKilometreEffect(rider,finalSegment,{phase:'finale',energy:state.energy,exposed:finalSegment.exposed});
    const effort=orderAt(team.orders,finalSegment.km-1).effort;
    const finaleAbility=finale.ability+TUNING.finish.finaleEffortAbilityPoints[effort];
    const noise=seedrandom(`${seed}:finish:${rider.id}`)()*TUNING.finish.noiseSeconds;
    const roadGroup=roadGroupByRider.get(rider.id);
    if(roadGroups!==null&&(state.group==='breakaway')!==Boolean(roadGroup))
      throw new Error(`Road-group membership differs from final state for ${rider.id}.`);
    const riderGap=roadGroups===null?(ahead.has(rider.id)?gapSeconds:0):roadGroup?.gapSeconds??0;
    const rawTime=base+state.deficitSeconds-riderGap+
      (100-finaleAbility)*TUNING.finish.finaleSecondsPerPoint+noise;
    return {riderId:rider.id,teamId:team.id,name:rider.name??rider.id,
      rawTime,energy:state.energy,group:state.group,roadGroupId:roadGroup?.id??null,
      finaleAbility};
  }));
}

function rankFinish(rows,{gapSeconds,roadGroups=null,preserveGroupOrder=true}){
  const unsorted=rows.map(rider=>({...rider}));
  // A finale can reorder riders within their final group, but it cannot put
  // the bunch ahead of an uncaught break or a dropped rider ahead of the bunch.
  if(preserveGroupOrder){
    let previousGroupEnd=null;
    const bands=roadGroups===null?
      [['breakaway',0],['peloton',gapSeconds],['dropped',.05]]:
      [...roadGroups.map((group,index)=>[group.id,index===0?0:
        roadGroups[index-1].gapSeconds-group.gapSeconds]),
      ['peloton',roadGroups.at(-1)?.gapSeconds??0],['dropped',.05]];
    for(const [band,separation] of bands){
      const members=unsorted.filter(rider=>rider.roadGroupId===band||
        rider.roadGroupId===null&&rider.group===band);
      if(!members.length)continue;
      const earliest=Math.min(...members.map(rider=>rider.rawTime));
      const shift=previousGroupEnd===null?0:Math.max(0,previousGroupEnd+separation-earliest);
      for(const rider of members)rider.rawTime+=shift;
      previousGroupEnd=Math.max(...members.map(rider=>rider.rawTime));
    }
  }
  unsorted.sort((a,b)=>a.rawTime-b.rawTime||String(a.riderId).localeCompare(String(b.riderId)));
  const winnerTime=unsorted[0].rawTime;
  return unsorted.map((rider,index)=>({riderId:rider.riderId,teamId:rider.teamId,name:rider.name,
    position:index+1,timeSeconds:+rider.rawTime.toFixed(2),gapSeconds:+(rider.rawTime-winnerTime).toFixed(2),
    energy:rider.energy,group:rider.group,
    ...(roadGroups===null?{}:{roadGroupId:rider.roadGroupId}),
    finaleAbility:rider.finaleAbility}));
}

export function provisionalFinish(input){
  return rankFinish(finishRows(input),{gapSeconds:input.gapSeconds});
}

// A provisional ordered result for multiple road groups. A catch between road
// groups remains outside the isolated model.
export function provisionalRoadGroupFinish(input){
  if(!Array.isArray(input.roadGroups))throw new Error('Road groups are required.');
  return rankFinish(finishRows(input),{roadGroups:input.roadGroups});
}

// The final burst may catch only the slower members of the leading group.
// Its outcome is calculated once and then written into the last replay frame.
export function resolveFinishingSprint(input){
  const rows=finishRows(input);
  const bunch=rows.filter(rider=>rider.group==='peloton');
  const bunchLeader=bunch.length?Math.min(...bunch.map(rider=>rider.rawTime)):Infinity;
  const caughtRiderIds=rows.filter(rider=>rider.group==='breakaway'&&rider.rawTime>=bunchLeader)
    .map(rider=>rider.riderId);
  const caught=new Set(caughtRiderIds);
  const remainingBreakawayRiderIds=input.breakawayRiderIds.filter(id=>!caught.has(id));
  const remaining=rows.filter(rider=>remainingBreakawayRiderIds.includes(rider.riderId));
  const gapSeconds=caught.size===0?input.gapSeconds:remaining.length?
    Math.max(.01,+(bunchLeader-Math.max(...remaining.map(rider=>rider.rawTime))).toFixed(2)):0;
  for(const rider of rows)if(caught.has(rider.riderId))rider.group='peloton';
  return {caughtRiderIds,remainingBreakawayRiderIds,gapSeconds,
    results:rankFinish(rows,{gapSeconds})};
}

// The bunch can catch any rider whose own final burst fails, even when that
// rider started in a group ahead of another surviving group. A faster rear
// group may catch other riders ahead; catching everyone merges the groups.
export function resolveRearRoadGroupFinishingSprint(input){
  if(!Array.isArray(input.roadGroups)||input.roadGroups.length<2)
    throw new Error('At least two road groups are required.');
  const rows=finishRows({...input,roadGroups:input.roadGroups});
  const bunchLeader=Math.min(...rows.filter(rider=>rider.group==='peloton')
    .map(rider=>rider.rawTime));
  const roadGroups=input.roadGroups.map(group=>({...group,
    riderIds:[...group.riderIds],teamIds:[...group.teamIds]}));
  const caughtRiderIds=[];
  for(let index=roadGroups.length-1;index>=0;index--){
    const group=roadGroups[index];
    const caughtHere=rows.filter(rider=>rider.roadGroupId===group.id&&
      rider.rawTime>=bunchLeader);
    if(!caughtHere.length)continue;
    caughtRiderIds.push(...caughtHere.map(rider=>rider.riderId));
    const caughtHereIds=new Set(caughtHere.map(rider=>rider.riderId));
    const remaining=rows.filter(rider=>rider.roadGroupId===group.id&&
      !caughtHereIds.has(rider.riderId));
    if(!remaining.length){roadGroups.splice(index,1);continue;}
    group.riderIds=group.riderIds.filter(id=>!caughtHereIds.has(id));
    group.teamIds=[...new Set(remaining.map(rider=>rider.teamId))];
  }
  const caught=new Set(caughtRiderIds);
  for(const rider of rows)if(caught.has(rider.riderId)){
    rider.group='peloton';
    rider.roadGroupId=null;
  }
  const eligible=new Set(input.eligibleMergeIds??roadGroups.map(group=>group.id));
  const mergedRoadGroupIds=[],finaleRoadGroupCatches=[];
  for(let index=roadGroups.length-2;index>=0;index--){
    const front=roadGroups[index],rear=roadGroups[index+1];
    if(!eligible.has(front.id)||!eligible.has(rear.id))continue;
    const frontRows=rows.filter(rider=>rider.roadGroupId===front.id);
    const rearRows=rows.filter(rider=>rider.roadGroupId===rear.id);
    const rearBest=Math.min(...rearRows.map(rider=>rider.rawTime));
    const caughtByRear=frontRows.filter(rider=>rider.rawTime>=rearBest);
    if(!caughtByRear.length)continue;
    for(const rider of caughtByRear)rider.roadGroupId=rear.id;
    rear.riderIds=[...caughtByRear.map(rider=>rider.riderId),...rear.riderIds];
    rear.teamIds=[...new Set([...caughtByRear.map(rider=>rider.teamId),
      ...rear.teamIds])];
    if(caughtByRear.length<frontRows.length){
      const caughtIds=new Set(caughtByRear.map(rider=>rider.riderId));
      front.riderIds=front.riderIds.filter(id=>!caughtIds.has(id));
      front.teamIds=[...new Set(frontRows.filter(rider=>!caughtIds.has(rider.riderId))
        .map(rider=>rider.teamId))];
      finaleRoadGroupCatches.push(...caughtByRear.map(rider=>({
        riderId:rider.riderId,fromGroupId:front.id,toGroupId:rear.id,
      })));
    }else{
      mergedRoadGroupIds.push(front.id);
      roadGroups.splice(index,1);
    }
  }
  let gapAhead=Infinity;
  for(const group of roadGroups){
    const slowest=Math.max(...rows.filter(rider=>rider.roadGroupId===group.id)
      .map(rider=>rider.rawTime));
    group.gapSeconds=Math.min(gapAhead/2,Math.max(.000001,bunchLeader-slowest));
    gapAhead=group.gapSeconds;
  }
  assertRoadGroups(roadGroups);
  return {caughtRiderIds,mergedRoadGroupIds,finaleRoadGroupCatches,roadGroups,
    results:rankFinish(rows,{roadGroups})};
}
