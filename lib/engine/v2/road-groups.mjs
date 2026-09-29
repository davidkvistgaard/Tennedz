// Pure transition rules for the next multi-group simulator increment. Gaps are
// absolute seconds ahead of the peloton, with groups ordered front to back.
function assertGroups(groups){
  if(!Array.isArray(groups)||groups.length>2)throw new Error('Expected up to two road groups.');
  const ids=new Set(),riders=new Set();
  let previousGap=Infinity;
  for(const group of groups){
    if(!group||typeof group.id!=='string'||!group.id||ids.has(group.id)||
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
  assertGroups(groups);
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
  assertGroups(groups);
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
  assertGroups(moved);
  return {groups:moved,caughtRiderIds,mergedGroupIds};
}
