// Compact, recorded-only checkpoints for the guided Motor Lab viewer.
export function raceViewerCheckpoints(race,finisherId){
  const frames=race?.kilometreFrames??[];
  if(!frames.length)return [];
  const chosen=new Set([0,frames.length-1]);
  for(const fraction of [.25,.5,.75])chosen.add(Math.round((frames.length-1)*fraction));
  const fiveKmIndex=frames.findIndex(frame=>frame.km>=race.settings.distanceKm-5);
  if(fiveKmIndex>=0)chosen.add(fiveKmIndex);
  const eventIndices=[];
  for(let index=0;index<frames.length;index++){
    const frame=frames[index];
    if(frame.attackAttempts.some(id=>id.startsWith('you-'))||
      frame.joinedRiderIds.some(id=>id.startsWith('you-'))||
      frame.caughtRiderIds.some(id=>id.startsWith('you-')))
      eventIndices.push(index);
  }
  for(const index of [...eventIndices.slice(0,4),...eventIndices.slice(-4)])
    chosen.add(index);
  return [...chosen].sort((a,b)=>a-b).map(index=>{
    const frame=frames[index];
    const rider=frame.ownRiders.find(row=>row.riderId===finisherId);
    const group=frame.roadGroups.find(row=>row.riderIds.includes(finisherId));
    const isolated=frame.droppedRiders.find(row=>row.riderId===finisherId);
    const position=group?`${group.gapSeconds.toFixed(1)} s ahead with ${group.riderIds.length} ${group.riderIds.length===1?'rider':'riders'}`:
      isolated?`${Math.abs(isolated.deficitSeconds).toFixed(1)} s ${
        isolated.deficitSeconds<0?'ahead of':'behind'} the bunch, alone`:
        'in the bunch';
    const moments=[
      ...frame.attackAttempts.filter(id=>id.startsWith('you-')).map(id=>`${id} tried to attack`),
      ...frame.joinedRiderIds.filter(id=>id.startsWith('you-')).map(id=>`${id} joined a break`),
      ...frame.caughtRiderIds.filter(id=>id.startsWith('you-')).map(id=>`${id} was caught`),
    ];
    return {index,km:frame.km,terrain:frame.terrain,position,
      energy:rider?.energy??null,frontCount:frame.roadGroups.length,
      chasing:frame.engagedChaseTeamIds?.includes('you')??false,moments};
  });
}
