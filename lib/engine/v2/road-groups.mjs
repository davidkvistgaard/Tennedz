// Pure road transitions for ordered groups ahead of the peloton.
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function assertRoadGroups(groups){
  if(!Array.isArray(groups))throw new Error('Expected road groups.');
  const ids=new Set(),riders=new Set();
  let previousGap=Infinity;
  for(const group of groups){
    if(!group||typeof group.id!=='string'||!/^road-[1-9]\d*$/.test(group.id)||ids.has(group.id)||
      !Array.isArray(group.riderIds)||group.riderIds.length===0||
      !Array.isArray(group.teamIds)||group.teamIds.length===0||
      group.riderIds.some(id=>typeof id!=='string'||!id)||
      group.teamIds.some(id=>typeof id!=='string'||!id)||
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

export function splitFrontRoadGroup(groups,{riderId,teamByRiderId,newGroupId,attackSeconds}){
  assertRoadGroups(groups);
  const teamId=teamByRiderId?.[riderId];
  if(groups.length<1||groups[0].riderIds.length<2||
    !groups[0].riderIds.includes(riderId)||!groups[0].teamIds.includes(teamId)||
    typeof newGroupId!=='string'||!newGroupId||groups.some(group=>group.id===newGroupId)||
    !Number.isFinite(attackSeconds)||attackSeconds<.01)
    throw new Error('Cannot split the leading road group.');
  const source=groups[0];
  const chasingRiderIds=source.riderIds.filter(id=>id!==riderId);
  const chasingTeamIds=[...new Set(chasingRiderIds.map(id=>teamByRiderId[id]))];
  if(chasingTeamIds.some(id=>!source.teamIds.includes(id)))
    throw new Error('Missing team for a road-group rider.');
  const chasing={...source,riderIds:chasingRiderIds,teamIds:chasingTeamIds};
  const front={id:newGroupId,riderIds:[riderId],teamIds:[teamId],
    gapSeconds:+(source.gapSeconds+attackSeconds).toFixed(2)};
  const result=[front,chasing,...groups.slice(1)];
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

export function relativeRoadGroupPace(front,chasing,teams,segment){
  assertRoadGroups([front,chasing]);
  const byRider=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,{team,rider}])));
  const pace=group=>{
    const workers=group.riderIds.filter(id=>{
      const entry=byRider.get(id);
      if(!entry)throw new Error('Unknown rider in road-group pace.');
      return orderAt(entry.team.orders,segment.km-1).breakWork==='cooperate';
    });
    const selected=workers.length?workers:group.riderIds;
    const ability=selected.reduce((sum,id)=>{
      const {team,rider}=byRider.get(id);
      return sum+riderKilometreEffect(rider,segment,{phase:'solo',
        energy:Number(team.energy[id]),exposed:segment.exposed}).ability;
    },0)/selected.length;
    return ability+(workers.length?Math.min(workers.length-1,
      TUNING.breakaway.maxCooperatingRiders)*TUNING.breakaway.cooperationPerExtraRider:
      -TUNING.breakaway.noWorkPenaltyPoints);
  };
  return +clamp((pace(front)-pace(chasing))*TUNING.breakaway.driftSecondsPerAbilityPoint,
    -TUNING.breakaway.maxPassiveLossSecondsPerKm,
    TUNING.breakaway.maxPassiveGainSecondsPerKm).toFixed(2);
}

export function validateRoadGroupTransition(previous,current,{joinedRiderIds=[],caughtRiderIds=[],
  splitRiderId=null,formedChaseGroupId=null,mergedGroupIds=[]}={}){
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
  if(splitRiderId!==null&&formedChaseGroupId!==null)
    throw new Error('Two road groups cannot form at once.');
  if(formedChaseGroupId!==null){
    if(previous.length<1||added.length!==1||
      added[0].id!==formedChaseGroupId||
      !current.some(group=>oldIds.has(group.id))||
      current.at(-1).id!==formedChaseGroupId||
      current.at(-1).riderIds.length!==joined.size||
      current.at(-1).riderIds.some(id=>!joined.has(id)))
      throw new Error('Invalid recorded chase group from the peloton.');
  }else if(splitRiderId!==null){
    if(previous.length<1||current.length!==previous.length+1||added.length!==1||removed.length!==0||
      !previous[0].riderIds.includes(splitRiderId)||added[0].riderIds.length!==1||
      added[0].riderIds[0]!==splitRiderId||current[0].id!==added[0].id||
      previous.some((group,index)=>current[index+1].id!==group.id)||mergedGroupIds.length)
      throw new Error('Invalid recorded split from the break.');
  }else if(added.length!==(previous.length===0&&current.length===1?1:0))
    throw new Error('A road group appeared without a recorded split or new break.');
  const retainedIds=previous.filter(group=>newIds.has(group.id)).map(group=>group.id);
  if(current.filter(group=>oldIds.has(group.id)).some((group,index)=>
    group.id!==retainedIds[index]))throw new Error('Recorded road groups changed order.');
  const currentById=new Map(current.map(group=>[group.id,group]));
  for(const [index,group] of previous.entries()){
    if(merged.has(group.id)){
      const target=previous.slice(index+1).find(later=>currentById.has(later.id));
      if(!target||group.riderIds.some(id=>caught.has(id)||
        !currentById.get(target.id).riderIds.includes(id)))
        throw new Error('Invalid recorded road-group merge.');
    }else if(newIds.has(group.id)){
      if(group.riderIds.some(id=>id!==splitRiderId&&!caught.has(id)&&
        !currentById.get(group.id).riderIds.includes(id)))
        throw new Error('Road-group riders changed groups without a merge.');
    }else if(group.riderIds.some(id=>!caught.has(id)))
      throw new Error('A road group disappeared without a catch or merge.');
  }
  return true;
}
