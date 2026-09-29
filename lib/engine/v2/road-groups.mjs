// Pure transition rules for the isolated two-group simulator. Gaps are
// absolute seconds ahead of the peloton, with groups ordered front to back.
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function assertRoadGroups(groups){
  if(!Array.isArray(groups)||groups.length>2)throw new Error('Expected up to two road groups.');
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
  if(groups.length!==1||groups[0].riderIds.length<2||
    !groups[0].riderIds.includes(riderId)||!groups[0].teamIds.includes(teamId)||
    typeof newGroupId!=='string'||!newGroupId||newGroupId===groups[0].id||
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
  return [front,chasing];
}

export function advanceRoadGroups(groups,secondsByGroupId){
  assertRoadGroups(groups);
  const moved=groups.map(group=>{
    const delta=secondsByGroupId[group.id];
    if(!Number.isFinite(delta))throw new Error('Missing road-group pace change.');
    return {...group,riderIds:[...group.riderIds],teamIds:[...group.teamIds],
      gapSeconds:+(group.gapSeconds+delta).toFixed(2)};
  });
  const caughtRiderIds=[],mergedGroupIds=[];
  if(moved.length===2&&moved[0].gapSeconds<=moved[1].gapSeconds){
    const [front,chasing]=moved;
    chasing.riderIds=[...chasing.riderIds,...front.riderIds];
    chasing.teamIds=[...new Set([...chasing.teamIds,...front.teamIds])];
    mergedGroupIds.push(front.id);
    moved.shift();
  }
  while(moved.length&&moved.at(-1).gapSeconds<=0){
    const caught=moved.pop();
    caughtRiderIds.push(...caught.riderIds);
  }
  assertRoadGroups(moved);
  return {groups:moved,caughtRiderIds,mergedGroupIds};
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
  splitRiderId=null,mergedGroupIds=[]}={}){
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
  if(splitRiderId!==null){
    if(previous.length!==1||current.length!==2||added.length!==1||removed.length!==0||
      !oldRiders.has(splitRiderId)||added[0].riderIds.length!==1||
      added[0].riderIds[0]!==splitRiderId||current[0].id!==added[0].id||
      current[1].id!==previous[0].id||mergedGroupIds.length)
      throw new Error('Invalid recorded split from the break.');
  }else if(added.length!==(previous.length===0&&current.length===1?1:0))
    throw new Error('A road group appeared without a recorded split or new break.');
  if(mergedGroupIds.length){
    if(previous.length!==2||current.length!==1||
      mergedGroupIds.length!==1||mergedGroupIds[0]!==previous[0].id||
      current[0].id!==previous[1].id||caught.size)
      throw new Error('Invalid recorded road-group merge.');
  }else if(removed.some(group=>group.riderIds.some(id=>!caught.has(id))))
    throw new Error('A road group disappeared without a catch or merge.');
  return true;
}
