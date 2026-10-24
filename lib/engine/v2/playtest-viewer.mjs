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

function recordedChasers(frame){
  return frame?.chasingTeamIds??frame?.engagedChaseTeamIds??[];
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
  const finishRoad=race.lastKmRoad?.at(-1);
  return {riders:[...byRider].sort(([a],[b])=>a.localeCompare(b))
    .map(([riderId,events])=>{
      const lastJoin=[...frames].reverse().find(frame=>
        frame.joinedRiderIds.includes(riderId));
      const laterCatch=lastJoin&&frames.find(frame=>
        frame.km>=lastJoin.km&&frame.caughtRiderIds.includes(riderId));
      const sourceFront=handoff.roadGroups.find(group=>
        group.riderIds.includes(riderId));
      const paidFinalContact=race.frontCatch??race.sharedWheelContact;
      const finalCatch=lastJoin&&!laterCatch&&sourceFront&&
        paidFinalContact?.roadGroupId===sourceFront.id&&
        Number.isFinite(paidFinalContact.atDistanceM)&&
        race.lineTimes?.some(row=>row.riderId===riderId)&&
        (race.frontCatch?.caughtRiderIds?.includes(riderId)||
          paidFinalContact===race.sharedWheelContact&&
          finishRoad?.groups?.every(group=>
            !group.riderIds.includes(riderId)));
      const frontAtLine=race.lineTimes?.some(row=>row.riderId===riderId)&&
        finishRoad?.groups?.some(group=>group.gapSeconds>0&&
          group.riderIds.includes(riderId));
      const aloneAheadAtLine=race.lineTimes?.some(row=>row.riderId===riderId)&&
        finishRoad?.droppedPassages?.some(row=>row.riderId===riderId&&
          row.deficitSeconds<0);
      const fate=lastJoin?laterCatch?
        `Caught at km ${laterCatch.km}`:finalCatch?
          `Caught at ${(paidFinalContact.atDistanceM/1000).toFixed(3)} km on the paid final road`:frontAtLine?
          'Still in a recorded front group at the line':aloneAheadAtLine?
            'Still ahead alone on the recorded finish road':
            'No catch recorded, but no separate front finish is confirmed':
        'No front-group join recorded';
      return {riderId,fate,
      events:events.length>6?[...events.slice(0,3),
        `${events.length-6} more recorded moments`,...events.slice(-3)]:events,
      atOneKm:recordedPosition(handoff,riderId)};
    }),
  ownChaseKm:frames.filter(frame=>recordedChasers(frame).includes('you')).length,
  rivalChaseKm:frames.filter(frame=>recordedChasers(frame).some(id=>
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

export function raceViewerRoad(frame,fieldSize){
  if(!frame)return [];
  const front=frame.roadGroups.map(group=>({
    key:group.id,label:group.id.replace('road-','Front group '),
    gapSeconds:group.gapSeconds,riderCount:group.riderIds.length,
    ownRiderIds:group.riderIds.filter(id=>id.startsWith('you-'))}));
  const solo=frame.droppedRiders.map(row=>({
    key:`solo:${row.riderId}`,label:`${row.riderId} riding alone`,
    gapSeconds:-row.deficitSeconds,riderCount:1,
    ownRiderIds:row.riderId.startsWith('you-')?[row.riderId]:[]}));
  const occupied=new Set([...frame.roadGroups.flatMap(group=>group.riderIds),
    ...frame.droppedRiders.map(row=>row.riderId)]);
  const bunch={key:'bunch',label:'Bunch',gapSeconds:0,
    riderCount:fieldSize-occupied.size,
    ownRiderIds:frame.ownRiders.map(row=>row.riderId)
      .filter(id=>!occupied.has(id))};
  return [...front,...solo,bunch].sort((a,b)=>
    b.gapSeconds-a.gapSeconds||a.key.localeCompare(b.key));
}

export function raceViewerLateEffort(race,riderId){
  const order=race?.managerOrders?.find(row=>row.teamId==='you');
  const fiveKm=race?.kilometreFrames?.find(frame=>
    frame.km>=race.settings.distanceKm-5);
  const oneKm=race?.kilometreFrames?.at(-1);
  const fiveRider=fiveKm?.ownRiders.find(row=>row.riderId===riderId);
  const oneRider=oneKm?.ownRiders.find(row=>row.riderId===riderId);
  const phase=order?.phaseOrders?.find(row=>
    row.atKm===race.settings.distanceKm-5&&row.effort);
  return {effort:phase?.effort??order?.effort??null,
    atFiveKmEnergy:fiveRider?.energy??null,
    atFiveKmRoad:fiveKm?recordedPosition(fiveKm,riderId):null,
    atOneKmEnergy:oneRider?.energy??null,
    atOneKmRoad:oneKm?recordedPosition(oneKm,riderId):null,
    atOneKmFrontGapSeconds:oneKm?Math.max(0,...oneKm.roadGroups.map(
      group=>group.gapSeconds)):null};
}

export function raceViewerLateTeamWork(race,teamId='you'){
  const frames=(race?.kilometreFrames??[]).filter(frame=>
    frame.km>race.settings.distanceKm-5);
  const owns=id=>id.startsWith(`${teamId}-`);
  return {recordedKm:frames.length,
    catches:frames.filter(frame=>frame.caughtRiderIds?.length)
      .map(frame=>({km:frame.km,riderIds:[...frame.caughtRiderIds]})),
    attacks:frames.reduce((count,frame)=>count+
      (frame.attackAttempts??[]).filter(owns).length,0),
    chaseKm:frames.filter(frame=>
      frame.chasingTeamIds?.includes(teamId)).length,
    breakPullKm:frames.filter(frame=>
      frame.pullRiderIds?.some(owns)).length,
    bunchPaceKm:frames.filter(frame=>
      frame.paidBunchPaceTeamId===teamId).length};
}

export function raceViewerEffortInsight(before,after){
  if(before.planWithoutLateEffort!==after.planWithoutLateEffort||
    before.finisherId!==after.finisherId||
    before.lateEffort.effort===after.lateEffort.effort)
    return 'Other choices or the nominated finisher also changed. These two runs do not isolate the 5 km effort.';
  const energyDelta=after.energyAtLine-before.energyAtLine;
  const energy=before.energyAtLine!==null&&after.energyAtLine!==null&&
    Number.isFinite(energyDelta)?
    energyDelta===0?'the same energy at the line':
      `${Math.abs(energyDelta).toFixed(1)} ${energyDelta>0?'more':'less'} energy at the line`:
    'no comparable line energy';
  const beforePlace=Number(before.place);
  const afterPlace=Number(after.place);
  const comparablePlace=before.place!==null&&before.place!==undefined&&
    after.place!==null&&after.place!==undefined&&
    Number.isInteger(beforePlace)&&Number.isInteger(afterPlace);
  const place=comparablePlace?
    `conditional place ${afterPlace} instead of ${beforePlace}`:
    'no exact conditional place comparison';
  const noPlaceGain=after.lateEffort.effort==='hard'&&
    before.lateEffort.effort!=='hard'&&energyDelta<0&&
    comparablePlace&&beforePlace===afterPlace?
    ' Here, hard spent more energy without improving the conditional place. Check the road trace before judging the tactic.':'';
  return `Only your 5 km effort changed. In the current run, ${before.finisherId} had ${energy} and ${place}.${noPlaceGain}`;
}

function roadMembership(frame){
  return JSON.stringify([
    frame.roadGroups.map(group=>[group.id,[...group.riderIds].sort()])
      .sort(([a],[b])=>a.localeCompare(b)),
    frame.droppedRiders.map(row=>row.riderId).sort()]);
}

export function raceViewerTimeline(race){
  const frames=race?.kilometreFrames??[];
  return frames.flatMap((frame,index)=>{
    const previous=frames[index-1];
    const messages=[];
    if(index===0)messages.push('Race recording begins');
    if(previous&&roadMembership(frame)!==roadMembership(previous))
      messages.push(`Road changed: ${frame.roadGroups.length} front ${
        frame.roadGroups.length===1?'group':'groups'}, ${
        frame.droppedRiders.length} riding alone`);
    if(frame.attackAttempts.length)
      messages.push(`${frame.attackAttempts.length} attack ${
        frame.attackAttempts.length===1?'attempt':'attempts'}: ${
        frame.attackAttempts.join(', ')}`);
    if(frame.joinedRiderIds.length)
      messages.push(`${frame.joinedRiderIds.join(', ')} joined a front group`);
    if(frame.caughtRiderIds.length)
      messages.push(frame.caughtRiderIds.length===1?
        `${frame.caughtRiderIds[0]} was caught`:
        `${frame.caughtRiderIds.length} riders were caught: ${
          frame.caughtRiderIds.join(', ')}`);
    const ownChase=recordedChasers(frame).includes('you');
    const previousOwnChase=recordedChasers(previous).includes('you');
    if(ownChase!==previousOwnChase)
      messages.push(`Your team ${ownChase?'chased':'stopped chasing'}`);
    if(index===frames.length-1)messages.push('Final kilometre begins');
    return messages.length?[{index,km:frame.km,messages}]:[];
  });
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
      chasing:recordedChasers(frame).includes('you'),moments};
  });
}
