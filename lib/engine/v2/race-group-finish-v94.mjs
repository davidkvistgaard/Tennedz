// A finish-line view of validated road-clock evidence. Members of a group
// have no recorded wheel order, so this never assigns individual places.
export function recordedGroupFinish(recording){
  const final=recording.frames.at(-1);
  if(!final||final.km!==recording.route.kilometres.length)
    throw new Error('The race has no recorded finish checkpoint.');
  const states=new Map(final.riderGroups.map(rider=>[rider.id,rider]));
  const roster=recording.committedInputs.teams.flatMap(team=>team.riders.map(r=>r.id));
  if(states.size!==roster.length||roster.some(id=>!states.has(id)))
    throw new Error('The finish checkpoint does not cover every rider.');
  const used=new Set();
  const groups=final.roadGroups.map(group=>{
    for(const id of group.riderIds){
      if(used.has(id)||states.get(id)?.group!=='breakaway')
        throw new Error('Invalid finish road-group membership.');
      used.add(id);
    }
    return {id:group.id,secondsAheadOfBunch:group.gapSeconds,
      riderIds:[...group.riderIds].sort()};
  });
  const bunch=[],dropped=[];
  for(const id of roster){
    if(used.has(id))continue;
    const state=states.get(id);
    if(state.group==='peloton')bunch.push(id);
    else if(state.group==='dropped'&&state.deficitSeconds>0)
      dropped.push({riderId:id,secondsBehindBunch:state.deficitSeconds});
    else throw new Error('Invalid finish rider-group state.');
  }
  return {km:final.km,groups,bunchRiderIds:bunch.sort(),
    dropped:dropped.sort((a,b)=>a.secondsBehindBunch-b.secondsBehindBunch||
      a.riderId.localeCompare(b.riderId)),
    finishLineCatch:final.finishLineCatch};
}
