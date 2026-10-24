// Compact, recorded-only checkpoints for the guided Motor Lab viewer.
export function raceViewerEnergySeries(race,riderId){
  return (race?.kilometreFrames??[]).flatMap(frame=>{
    const rider=frame.ownRiders.find(row=>row.riderId===riderId);
    return rider?[{km:frame.km,energy:rider.energy}]:[];
  });
}

function recordedPosition(frame,riderId){
  const group=frame.roadGroups.find(row=>row.riderIds.includes(riderId));
  const isolated=frame.droppedRiders.find(row=>row.riderId===riderId);
  return group?`${group.gapSeconds.toFixed(1)} s ahead with ${group.riderIds.length} ${group.riderIds.length===1?'rider':'riders'}`:
    isolated?`${Math.abs(isolated.deficitSeconds).toFixed(1)} s ${
      isolated.deficitSeconds<0?'ahead of':'behind'} the bunch, alone`:
      'in the bunch';
}

export function raceViewerBreaksAndChase(race){
  const frames=race?.kilometreFrames??[];
  if(!frames.length)return {riders:[],ownChaseKm:0,rivalChaseKm:0};
  const byRider=new Map();
  for(const frame of frames){
    for(const [key,label] of [['attackAttempts','tried to attack'],
      ['joinedRiderIds','joined a break'],['caughtRiderIds','was caught']]){
      for(const riderId of frame[key].filter(id=>id.startsWith('you-'))){
        if(!byRider.has(riderId))byRider.set(riderId,[]);
        byRider.get(riderId).push(`km ${frame.km}: ${label}`);
      }
    }
  }
  const handoff=frames.at(-1);
  return {riders:[...byRider].sort(([a],[b])=>a.localeCompare(b))
    .map(([riderId,events])=>({riderId,
      events:events.length>6?[...events.slice(0,3),
        `${events.length-6} more recorded moments`,...events.slice(-3)]:events,
      atOneKm:recordedPosition(handoff,riderId)})),
  ownChaseKm:frames.filter(frame=>frame.engagedChaseTeamIds?.includes('you')).length,
  rivalChaseKm:frames.filter(frame=>frame.engagedChaseTeamIds?.some(id=>
    id!=='you')).length};
}

export function raceViewerFinale(race,riderId){
  const source=race?.kilometreFrames?.at(-1);
  const atOneKm=source?.ownRiders.find(row=>row.riderId===riderId);
  const band=race?.bandReplays?.find(row=>row.riderIds.includes(riderId));
  const first=band?.frames?.[0];
  const at500=first?.startDistanceM===race?.settings?.distanceKm*1000-500?
    first.riders.find(row=>row.riderId===riderId):null;
  const line=race?.lineTimes?.find(row=>row.riderId===riderId);
  if(!atOneKm&&!at500&&!line)return null;
  return {atOneKmEnergy:atOneKm?.energy??null,
    at500Energy:at500?.energyAtDecision??null,
    at500Role:at500?.role??null,
    at500Seconds:at500?band.passageAt500Seconds??null:null,
    atLineEnergy:line?.energyAtLine??null,
    atLineSeconds:line?.elapsedSecondsFromLastKmStart??null,
    roadBandId:band?.id??null};
}

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
    const position=recordedPosition(frame,finisherId);
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
