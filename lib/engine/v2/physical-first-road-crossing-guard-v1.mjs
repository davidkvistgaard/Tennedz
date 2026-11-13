// Distinct roads cannot exchange clock order without a paid contact
// event. A later contact resolver may replace this refusal.
export const PHYSICAL_FIRST_ROAD_CROSSING_GUARD_VERSION=
  'physical-first-road-crossing-guard-2';
export const PHYSICAL_FIRST_LAUNCH_CROSSING_GUARD_VERSION=
  'physical-first-launch-crossing-guard-2';
export const PHYSICAL_FIRST_ROAD_CROSSING_GUARD_V2_VERSION=
  'physical-first-road-crossing-guard-3';
const EPS=.002;
export const projectPhysicalFirstRoadMeetingV1=(sourceKm,firstStart,
  secondStart,firstEnd,secondEnd)=>{
  const startDifference=firstStart-secondStart;
  const endDifference=firstEnd-secondEnd;
  const delta=endDifference-startDifference;
  if(!Number.isInteger(sourceKm)||sourceKm<0||
    !Number.isFinite(delta)||Math.abs(delta)<=EPS)
    return null;
  const fraction=-startDifference/delta;
  if(fraction<0||fraction>1)return null;
  return {atDistanceM:+(sourceKm*1000+
      fraction*1000).toFixed(6),
    atClockSeconds:+(firstStart+
      fraction*(firstEnd-firstStart)).toFixed(6),
    fractionOfKilometre:+fraction.toFixed(9)};
};

export function assertNoUnpaidRoadCrossingsV1(prior,
  advancedRoads){
  if(!Array.isArray(prior?.roads)||
    !Array.isArray(advancedRoads)||
    new Set(prior.roads.map(road=>road.roadId)).size!==
      prior.roads.length||
    new Set(advancedRoads.map(road=>road.roadId)).size!==
      advancedRoads.length)
    throw new Error('Road crossing guard needs distinct roads.');
  const after=new Map(advancedRoads.map(road=>
    [road.roadId,road]));
  for(let i=0;i<prior.roads.length;i++){
    const a=prior.roads[i],nextA=after.get(a.roadId);
    if(!nextA||!Number.isFinite(a.clockSeconds)||
      !Number.isFinite(nextA.finishClockSeconds))
      throw new Error(
        'Road crossing guard lacks a paid road clock.');
    for(let j=i+1;j<prior.roads.length;j++){
      const b=prior.roads[j],nextB=after.get(b.roadId);
      if(!nextB||!Number.isFinite(b.clockSeconds)||
        !Number.isFinite(nextB.finishClockSeconds))
        throw new Error(
          'Road crossing guard lacks a paid road clock.');
      const before=a.clockSeconds-b.clockSeconds;
      const end=nextA.finishClockSeconds-
        nextB.finishClockSeconds;
      if(Math.abs(before)<=EPS||Math.abs(end)<=EPS||
        Math.sign(before)!==Math.sign(end)){
        const error=new Error(
          'Road crossing needs recorded paid contact.');
        error.sourceEvidence={
          version:PHYSICAL_FIRST_ROAD_CROSSING_GUARD_VERSION,
          firstRoadId:a.roadId,secondRoadId:b.roadId,
          startClockDifferenceSeconds:before,
          endClockDifferenceSeconds:end,
          projectedMeeting:projectPhysicalFirstRoadMeetingV1(prior.sourceKm,
            a.clockSeconds,b.clockSeconds,
            nextA.finishClockSeconds,
            nextB.finishClockSeconds)};
        throw error;
      }
    }
  }
  return true;
}

function paidBoundarySoloPairs(prior,events){
  const byRoad=new Map(prior.roads.map(row=>
    [row.roadId,row]));
  const pairs=new Set();
  for(const event of events.filter(row=>
    row.type==='paid_contact_without_shared_leader')){
    const roadIds=event.fromRoadIds;
    if(!Array.isArray(roadIds)||roadIds.length<2||
      new Set(roadIds).size!==roadIds.length||
      event.version!==
        'physical-first-rear-boundary-contact-3'||
      event.recordedPaidContact!==true||
      event.sharedRoadCreated!==false||
      event.reason!==
        'no_payable_shelter_compatible_leader'||
      event.atDistanceM!==prior.sourceKm*1000||
      !Number.isFinite(event.atClockSeconds)||
      !Array.isArray(event.riderIds)||
      event.riderIds.length!==roadIds.length||
      new Set(event.riderIds).size!==
        event.riderIds.length||
      !Array.isArray(event.approach)||
      event.approach.length!==roadIds.length||
      roadIds.some(id=>{
        const road=byRoad.get(id);
        const receipt=event.approach.find(row=>
          row.roadId===id);
        return !road||road.riderIds.length!==1||
          !event.riderIds.includes(
            road.riderIds[0])||
          Math.abs(road.clockSeconds-
            event.atClockSeconds)>EPS||
          !receipt||receipt.riderId!==
            road.riderIds[0]||
          Math.abs(receipt.clockSeconds-
            event.atClockSeconds)>EPS||
          !(receipt.paidFromReserve>0);
      }))
      throw new Error(
        'Boundary solo permission lacks paid contact.');
    for(let i=0;i<roadIds.length;i++)
      for(let j=i+1;j<roadIds.length;j++)
        pairs.add(JSON.stringify(
          [roadIds[i],roadIds[j]].sort()));
  }
  return pairs;
}

export function assertNoUnpaidRoadCrossingsV2(prior,
  advancedRoads,boundaryContactEvents=[]){
  if(!Array.isArray(prior?.roads)||
    !Array.isArray(advancedRoads)||
    !Array.isArray(boundaryContactEvents)||
    new Set(prior.roads.map(road=>road.roadId)).size!==
      prior.roads.length||
    new Set(advancedRoads.map(road=>road.roadId)).size!==
      advancedRoads.length)
    throw new Error('Road crossing guard needs distinct roads.');
  const permitted=paidBoundarySoloPairs(prior,
    boundaryContactEvents);
  const after=new Map(advancedRoads.map(row=>
    [row.roadId,row]));
  for(let i=0;i<prior.roads.length;i++){
    const a=prior.roads[i],nextA=after.get(a.roadId);
    if(!nextA||!Number.isFinite(a.clockSeconds)||
      !Number.isFinite(nextA.finishClockSeconds))
      throw new Error(
        'Road crossing guard lacks a paid road clock.');
    for(let j=i+1;j<prior.roads.length;j++){
      const b=prior.roads[j],nextB=after.get(b.roadId);
      if(!nextB||!Number.isFinite(b.clockSeconds)||
        !Number.isFinite(nextB.finishClockSeconds))
        throw new Error(
          'Road crossing guard lacks a paid road clock.');
      const before=a.clockSeconds-b.clockSeconds;
      const end=nextA.finishClockSeconds-
        nextB.finishClockSeconds;
      if(Math.abs(before)<=EPS&&
        permitted.has(JSON.stringify(
          [a.roadId,b.roadId].sort())))continue;
      if(Math.abs(before)<=EPS||
        Math.abs(end)<=EPS||
        Math.sign(before)!==Math.sign(end)){
        const error=new Error(
          'Road crossing needs recorded paid contact.');
        error.sourceEvidence={
          version:
            PHYSICAL_FIRST_ROAD_CROSSING_GUARD_V2_VERSION,
          firstRoadId:a.roadId,
          secondRoadId:b.roadId,
          startClockDifferenceSeconds:before,
          endClockDifferenceSeconds:end,
          projectedMeeting:
            projectPhysicalFirstRoadMeetingV1(
              prior.sourceKm,a.clockSeconds,
              b.clockSeconds,
              nextA.finishClockSeconds,
              nextB.finishClockSeconds)};
        throw error;
      }
    }
  }
  return true;
}

// A rider may leave a paid road at an exactly recorded boundary. The
// departing road begins at the same clock, but cannot silently cross any
// different road during the kilometre.
function assertNoUnpaidLaunchCrossings(prior,
  advancedRoads,launchEvents,
  boundaryContactEvents,version){
  if(version===2)
    assertNoUnpaidRoadCrossingsV2(prior,
      advancedRoads,boundaryContactEvents);
  else assertNoUnpaidRoadCrossingsV1(prior,
    advancedRoads);
  if(!Array.isArray(launchEvents)||
    !Number.isInteger(prior?.sourceKm)||
    prior.sourceKm<0)
    throw new Error('Launch guard needs a measured boundary.');
  const before=new Map(prior.roads.map(row=>
    [row.roadId,row]));
  const after=new Map(advancedRoads.map(row=>
    [row.roadId,row]));
  const permitted=version===2?
    paidBoundarySoloPairs(prior,
      boundaryContactEvents):new Set();
  const newIds=advancedRoads.filter(row=>
    !before.has(row.roadId)).map(row=>row.roadId);
  if(newIds.length!==launchEvents.length||
    new Set(launchEvents.map(row=>row.toRoadId))
      .size!==launchEvents.length||
    new Set(launchEvents.map(row=>row.riderId))
      .size!==launchEvents.length)
    throw new Error('New road lacks a unique paid launch.');
  const sourceByNewRoad=new Map();
  for(const event of launchEvents){
    const source=before.get(event.fromRoadId);
    const departed=after.get(event.toRoadId);
    const remaining=after.get(event.fromRoadId);
    if(!source||!departed||!remaining||
      before.has(event.toRoadId)||
      !Array.isArray(source.riderIds)||
      !source.riderIds.includes(event.riderId)||
      remaining.riderIds?.includes(event.riderId)||
      departed.riderIds?.length!==1||
      departed.riderIds[0]!==event.riderId||
      event.atDistanceM!==prior.sourceKm*1000||
      Math.abs(event.atClockSeconds-
        source.clockSeconds)>EPS||
      departed.startDistanceM!==event.atDistanceM||
      Math.abs(departed.startClockSeconds-
        event.atClockSeconds)>EPS||
      departed.endDistanceM!==event.atDistanceM+1000||
      !Number.isFinite(departed.finishClockSeconds)||
      departed.finishClockSeconds<=
        departed.startClockSeconds)
      throw new Error('New road lacks measured paid departure.');
    sourceByNewRoad.set(event.toRoadId,event.fromRoadId);
  }
  const compare=(firstId,secondId,firstSource,
    secondSource)=>{
    const first=before.get(firstSource);
    const second=before.get(secondSource);
    const start=first.clockSeconds-
      second.clockSeconds;
    const end=after.get(firstId).finishClockSeconds-
      after.get(secondId).finishClockSeconds;
    if(firstSource!==secondSource&&
      !(Math.abs(start)<=EPS&&
        permitted.has(JSON.stringify(
          [firstSource,secondSource].sort())))&&
      (Math.abs(start)<=EPS||Math.abs(end)<=EPS||
        Math.sign(start)!==Math.sign(end))){
      const error=new Error(
        'Launched road needs recorded paid contact.');
      error.sourceEvidence={
        version:PHYSICAL_FIRST_LAUNCH_CROSSING_GUARD_VERSION,
        firstRoadId:firstId,secondRoadId:secondId,
        startClockDifferenceSeconds:start,
        endClockDifferenceSeconds:end,
        projectedMeeting:projectPhysicalFirstRoadMeetingV1(prior.sourceKm,
          first.clockSeconds,second.clockSeconds,
          after.get(firstId).finishClockSeconds,
          after.get(secondId).finishClockSeconds)};
      throw error;
    }
  };
  for(const [newId,sourceId] of sourceByNewRoad){
    for(const old of prior.roads)
      compare(newId,old.roadId,sourceId,
        old.roadId);
    for(const [otherId,otherSource] of
      sourceByNewRoad){
      if(newId>=otherId)continue;
      compare(newId,otherId,sourceId,otherSource);
    }
  }
  return true;
}

export function assertNoUnpaidLaunchCrossingsV1(prior,
  advancedRoads,launchEvents=[]){
  return assertNoUnpaidLaunchCrossings(prior,
    advancedRoads,launchEvents,[],1);
}

export function assertNoUnpaidLaunchCrossingsV2(prior,
  advancedRoads,launchEvents=[],
  boundaryContactEvents=[]){
  return assertNoUnpaidLaunchCrossings(prior,
    advancedRoads,launchEvents,
    boundaryContactEvents,2);
}
