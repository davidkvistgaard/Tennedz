// Pure road transitions for ordered groups ahead of the peloton.
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
// At most two riders per each of the 20 teams can be ahead, so 40 solo groups
// is the natural upper bound. The transition rules do not impose a smaller cap.
export const MAX_ROAD_GROUPS=40;
export function assertRoadGroups(groups){
  if(!Array.isArray(groups)||groups.length>MAX_ROAD_GROUPS)
    throw new Error('Road groups exceed the supported capacity.');
  const ids=new Set(),riders=new Set();
  let previousGap=Infinity;
  for(const group of groups){
    if(!group||typeof group.id!=='string'||!/^road-[1-9]\d*$/.test(group.id)||ids.has(group.id)||
      !Array.isArray(group.riderIds)||group.riderIds.length===0||
      !Array.isArray(group.teamIds)||group.teamIds.length===0||
      group.riderIds.some(id=>typeof id!=='string'||!id)||
      group.teamIds.some(id=>typeof id!=='string'||!id)||
      new Set(group.teamIds).size!==group.teamIds.length||
      !Number.isFinite(group.gapSeconds)||group.gapSeconds<=0||
      group.gapSeconds>=previousGap||
      new Set(group.riderIds).size!==group.riderIds.length||
      new Set(group.teamIds).size!==group.teamIds.length||
      group.riderIds.some(id=>riders.has(id)))throw new Error('Invalid road groups.');
    ids.add(group.id);
    group.riderIds.forEach(id=>riders.add(id));
    previousGap=group.gapSeconds;
  }
}

export function splitRoadGroup(groups,{riderId,teamByRiderId,newGroupId,attackSeconds}){
  assertRoadGroups(groups);
  const teamId=teamByRiderId?.[riderId];
  const sourceIndex=groups.findIndex(group=>group.riderIds.includes(riderId));
  const source=groups[sourceIndex];
  if(sourceIndex<0||source.riderIds.length<2||!source.teamIds.includes(teamId)||
    typeof newGroupId!=='string'||!newGroupId||groups.some(group=>group.id===newGroupId)||
    !Number.isFinite(attackSeconds)||attackSeconds<.01||
    sourceIndex>0&&source.gapSeconds+attackSeconds>=groups[sourceIndex-1].gapSeconds)
    throw new Error('Cannot split this road group.');
  const chasingRiderIds=source.riderIds.filter(id=>id!==riderId);
  const chasingTeamIds=[...new Set(chasingRiderIds.map(id=>teamByRiderId[id]))];
  if(chasingTeamIds.some(id=>!source.teamIds.includes(id)))
    throw new Error('Missing team for a road-group rider.');
  const chasing={...source,riderIds:chasingRiderIds,teamIds:chasingTeamIds};
  const front={id:newGroupId,riderIds:[riderId],teamIds:[teamId],
    gapSeconds:+(source.gapSeconds+attackSeconds).toFixed(2)};
  const result=[...groups.slice(0,sourceIndex),front,chasing,...groups.slice(sourceIndex+1)];
  assertRoadGroups(result);
  return result;
}

export function splitFrontRoadGroup(groups,options){
  if(!groups[0]?.riderIds.includes(options.riderId))
    throw new Error('Cannot split the leading road group.');
  return splitRoadGroup(groups,options);
}

export function joinRoadGroupAhead(groups,{riderId,teamByRiderId}){
  assertRoadGroups(groups);
  const sourceIndex=groups.findIndex(group=>group.riderIds.includes(riderId));
  const teamId=teamByRiderId?.[riderId];
  if(sourceIndex<1||groups[sourceIndex].riderIds.length<2||
    !groups[sourceIndex].teamIds.includes(teamId))
    throw new Error('Cannot join the road group ahead.');
  const result=groups.map(group=>({...group,riderIds:[...group.riderIds],teamIds:[...group.teamIds]}));
  const source=result[sourceIndex],front=result[sourceIndex-1];
  source.riderIds=source.riderIds.filter(id=>id!==riderId);
  source.teamIds=[...new Set(source.riderIds.map(id=>teamByRiderId[id]))];
  front.riderIds.push(riderId);
  front.teamIds=[...new Set([...front.teamIds,teamId])];
  assertRoadGroups(result);
  return result;
}

export function formChasingRoadGroup(groups,{riderIds,teamByRiderId,newGroupId,gapSeconds}){
  assertRoadGroups(groups);
  if(groups.length<1||!Array.isArray(riderIds)||!riderIds.length||
    new Set(riderIds).size!==riderIds.length||
    riderIds.some(id=>groups.some(group=>group.riderIds.includes(id))||!teamByRiderId?.[id])||
    typeof newGroupId!=='string'||groups.some(group=>group.id===newGroupId)||
    !Number.isFinite(gapSeconds)||gapSeconds<=0||gapSeconds>=groups.at(-1).gapSeconds)
    throw new Error('Cannot form a chasing road group.');
  const chasing={id:newGroupId,riderIds:[...riderIds],
    teamIds:[...new Set(riderIds.map(id=>teamByRiderId[id]))],gapSeconds};
  const result=[...groups,chasing];
  assertRoadGroups(result);
  return result;
}

export function advanceRoadGroups(groups,secondsByGroupId){
  assertRoadGroups(groups);
  const moved=groups.map(group=>{
    const delta=secondsByGroupId[group.id];
    if(!Number.isFinite(delta))throw new Error('Missing road-group pace change.');
    return {...group,riderIds:[...group.riderIds],teamIds:[...group.teamIds],
      gapSeconds:+(group.gapSeconds+delta).toFixed(2)};
  });
  const caughtRiderIds=[],mergedGroupIds=[],survivors=[];
  // A group at or behind the bunch has been caught, even if another group
  // passed it during this kilometre. It cannot lend those riders a free merge.
  for(const group of moved){
    if(group.gapSeconds<=0)caughtRiderIds.push(...group.riderIds);
    else survivors.push(group);
  }
  const ordered=[];
  for(const group of survivors){
    ordered.push(group);
    while(ordered.length>1&&ordered.at(-2).gapSeconds<=ordered.at(-1).gapSeconds){
      const front=ordered.splice(ordered.length-2,1)[0];
      const chasing=ordered.at(-1);
      chasing.riderIds.push(...front.riderIds);
      chasing.teamIds=[...new Set([...chasing.teamIds,...front.teamIds])];
      mergedGroupIds.push(front.id);
    }
  }
  assertRoadGroups(ordered);
  return {groups:ordered,caughtRiderIds,mergedGroupIds};
}

export function selectRoadGroupPulls(groups,teams,km,{holdTeamIds=[]}={}){
  assertRoadGroups(groups);
  if(!Number.isInteger(km)||km<1)throw new Error('Invalid road-group kilometre.');
  if(!Array.isArray(holdTeamIds)||new Set(holdTeamIds).size!==holdTeamIds.length)
    throw new Error('Invalid road-group hold teams.');
  const hold=new Set(holdTeamIds);
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,team])));
  const teamsAhead=new Set(),pulls=[];
  for(const [index,group] of groups.entries()){
    for(const id of group.riderIds){
      const team=teamByRider.get(id);
      if(!team)throw new Error('Unknown rider in road-group work.');
      if(hold.has(team.id))continue;
      const ownRidersAhead=groups.slice(0,index).flatMap(ahead=>ahead.riderIds)
        .filter(riderId=>teamByRider.get(riderId)?.id===team.id);
      const fadingForward=ownRidersAhead.length>0&&
        team.orders.forwardResponse==='chase_if_fading'&&
        ownRidersAhead.every(riderId=>Number.isFinite(team.energy?.[riderId])&&
          team.energy[riderId]<=
          TUNING.teamIntent.fadingRiderEnergy)&&
        groups.slice(0,index).filter(ahead=>ahead.teamIds.includes(team.id))
          .every(ahead=>ahead.gapSeconds-group.gapSeconds<=
            TUNING.teamIntent.maxFadingBreakGapSeconds);
      if((!teamsAhead.has(team.id)||fadingForward)&&
        orderAt(team.orders,km-1).breakWork==='cooperate'&&
        Number(team.energy?.[id]??100)>TUNING.breakaway.minPullEnergy)
        pulls.push(id);
    }
    for(const id of group.teamIds)teamsAhead.add(id);
  }
  return pulls;
}

// A willing worker still pays more than a sitter, but several workers can
// rotate their turns. Costs belong to the group at the start of the km, even
// if that group is caught or merges before the next recorded frame.
export function roadGroupExposureCosts(groups,pullRiderIds){
  assertRoadGroups(groups);
  if(!Array.isArray(pullRiderIds)||new Set(pullRiderIds).size!==pullRiderIds.length)
    throw new Error('Invalid road-group pull roster.');
  const pulls=new Set(pullRiderIds),costs=new Map();
  for(const group of groups){
    const workers=group.riderIds.filter(id=>pulls.has(id));
    const workerCost=TUNING.breakaway.extraCostPerKm/
      (1+Math.min(Math.max(0,workers.length-1),
        TUNING.breakaway.maxCooperatingRiders)*
        TUNING.breakaway.rotationReliefPerExtraWorker);
    for(const id of group.riderIds)costs.set(id,workers.includes(id)?workerCost:
      TUNING.breakaway.sitOnExtraCostPerKm);
  }
  if([...pulls].some(id=>!costs.has(id)))
    throw new Error('Road-group puller is not in a group.');
  return costs;
}

export function relativeRoadGroupPace(front,chasing,teams,segment,pullRiderIds=null){
  assertRoadGroups([front,chasing]);
  const byRider=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,{team,rider}])));
  const activePulls=pullRiderIds===null?null:new Set(pullRiderIds);
  const pace=group=>{
    const workers=group.riderIds.filter(id=>{
      const entry=byRider.get(id);
      if(!entry)throw new Error('Unknown rider in road-group pace.');
      return activePulls?activePulls.has(id):
        orderAt(entry.team.orders,segment.km-1).breakWork==='cooperate';
    });
    const selected=workers.length?workers:group.riderIds;
    const ability=selected.reduce((sum,id)=>{
      const {team,rider}=byRider.get(id);
      return sum+riderKilometreEffect(rider,segment,{phase:'solo',
        energy:Number(team.energy[id]),exposed:segment.exposed}).ability;
    },0)/selected.length;
    return ability+(workers.length?Math.min(workers.length-1,
      TUNING.breakaway.maxCooperatingRiders)*
      TUNING.breakaway.roadGroupCooperationPerExtraRider:
      -TUNING.breakaway.noWorkPenaltyPoints);
  };
  return +clamp((pace(front)-pace(chasing))*TUNING.breakaway.driftSecondsPerAbilityPoint,
    -TUNING.breakaway.maxPassiveLossSecondsPerKm,
    TUNING.breakaway.maxPassiveGainSecondsPerKm).toFixed(2);
}

export function validateRoadGroupTransition(previous,current,{joinedRiderIds=[],caughtRiderIds=[],
  splitRiderId=null,advancedRiderId=null,advancedToGroupId=null,
  formedChaseGroupId=null,mergedGroupIds=[],finaleCatchMoves=[],
  finishLineCatch=false}={}){
  assertRoadGroups(previous);
  assertRoadGroups(current);
  const oldRiders=new Set(previous.flatMap(group=>group.riderIds));
  const newRiders=new Set(current.flatMap(group=>group.riderIds));
  const joined=new Set(joinedRiderIds),caught=new Set(caughtRiderIds);
  if(joined.size!==joinedRiderIds.length||caught.size!==caughtRiderIds.length||
    [...joined].some(id=>oldRiders.has(id))||
    [...caught].some(id=>!oldRiders.has(id)&&!joined.has(id))||
    newRiders.size!==oldRiders.size+joined.size-caught.size||
    [...newRiders].some(id=>!oldRiders.has(id)&&!joined.has(id)||caught.has(id)))
    throw new Error('Road-group riders do not continue across the kilometre.');
  const oldIds=new Set(previous.map(group=>group.id));
  const newIds=new Set(current.map(group=>group.id));
  const added=current.filter(group=>!oldIds.has(group.id));
  const removed=previous.filter(group=>!newIds.has(group.id));
  const merged=new Set(mergedGroupIds);
  if(merged.size!==mergedGroupIds.length||mergedGroupIds.some(id=>!oldIds.has(id)||newIds.has(id)))
    throw new Error('Invalid recorded road-group merge.');
  if([splitRiderId!==null,advancedRiderId!==null,formedChaseGroupId!==null]
    .filter(Boolean).length>1||advancedRiderId===null&&advancedToGroupId!==null)
    throw new Error('Two road groups cannot form at once.');
  if(formedChaseGroupId!==null){
    const caughtAtLine=finishLineCatch&&added.length===0&&joined.size>0&&
      [...joined].every(id=>caught.has(id));
    if(previous.length<1||!current.some(group=>oldIds.has(group.id))||
      (caughtAtLine?current.some(group=>group.id===formedChaseGroupId):
        added.length!==1||added[0].id!==formedChaseGroupId||
        current.at(-1).id!==formedChaseGroupId||
        current.at(-1).riderIds.length!==joined.size||
        current.at(-1).riderIds.some(id=>!joined.has(id))))
      throw new Error('Invalid recorded chase group from the peloton.');
  }else if(splitRiderId!==null){
    const sourceIndex=previous.findIndex(group=>group.riderIds.includes(splitRiderId));
    const sourceDestination=previous.slice(sourceIndex).find(group=>newIds.has(group.id));
    const sourceCurrentIndex=current.findIndex(group=>group.id===sourceDestination?.id);
    if(previous.length<1||sourceIndex<0||!sourceDestination||
      added.length!==1||current.length<2||added[0].riderIds.length!==1||
      added[0].riderIds[0]!==splitRiderId||sourceCurrentIndex<1||
      current[sourceCurrentIndex-1].id!==added[0].id)
      throw new Error('Invalid recorded split from the break.');
  }else if(advancedRiderId!==null){
    const sourceIndex=previous.findIndex(group=>group.riderIds.includes(advancedRiderId));
    const sourceDestination=previous.slice(sourceIndex).find(group=>newIds.has(group.id));
    const sourceCurrentIndex=current.findIndex(group=>group.id===sourceDestination?.id);
    if(sourceIndex<0||!sourceDestination||sourceCurrentIndex<1||added.length||
      current[sourceCurrentIndex-1].id!==advancedToGroupId||
      !current[sourceCurrentIndex-1].riderIds.includes(advancedRiderId)||
      current[sourceCurrentIndex].riderIds.includes(advancedRiderId))
      throw new Error('Invalid recorded move to the road group ahead.');
  }else if(added.length!==(previous.length===0&&current.length===1?1:0))
    throw new Error('A road group appeared without a recorded split or new break.');
  const retainedIds=previous.filter(group=>newIds.has(group.id)).map(group=>group.id);
  if(current.filter(group=>oldIds.has(group.id)).some((group,index)=>
    group.id!==retainedIds[index]))throw new Error('Recorded road groups changed order.');
  const currentById=new Map(current.map(group=>[group.id,group]));
  const movedRiderId=splitRiderId??advancedRiderId;
  if(!Array.isArray(finaleCatchMoves))
    throw new Error('Invalid recorded finale road-group catches.');
  const finaleMoved=new Set();
  for(const move of finaleCatchMoves){
    const sourceIndex=previous.findIndex(group=>group.id===move?.fromGroupId);
    const source=previous[sourceIndex];
    const target=sourceIndex<0?null:previous.slice(sourceIndex+1)
      .find(group=>currentById.has(group.id));
    if(!source?.riderIds.includes(move.riderId)||
      !target||target.id!==move.toGroupId||
      finaleMoved.has(move.riderId)||caught.has(move.riderId)||
      move.riderId===movedRiderId||
      !currentById.has(source.id)||
      currentById.get(source.id).riderIds.includes(move.riderId)||
      !currentById.get(target.id).riderIds.includes(move.riderId))
      throw new Error('Invalid recorded finale road-group catches.');
    finaleMoved.add(move.riderId);
  }
  for(const [index,group] of previous.entries()){
    if(merged.has(group.id)){
      const target=previous.slice(index+1).find(later=>currentById.has(later.id));
      if(!target||group.riderIds.some(id=>id!==movedRiderId&&(caught.has(id)||
        !currentById.get(target.id).riderIds.includes(id))))
        throw new Error('Invalid recorded road-group merge.');
    }else if(newIds.has(group.id)){
      if(group.riderIds.some(id=>id!==movedRiderId&&!caught.has(id)&&
        !finaleMoved.has(id)&&
        !currentById.get(group.id).riderIds.includes(id)))
        throw new Error('Road-group riders changed groups without a merge.');
    }else if(group.riderIds.some(id=>!caught.has(id)))
      throw new Error('A road group disappeared without a catch or merge.');
  }
  return true;
}
