// Distinct roads cannot exchange clock order without a paid contact
// event. A later contact resolver may replace this refusal.
export const PHYSICAL_FIRST_ROAD_CROSSING_GUARD_VERSION=
  'physical-first-road-crossing-guard-1';
export const PHYSICAL_FIRST_LAUNCH_CROSSING_GUARD_VERSION=
  'physical-first-launch-crossing-guard-1';
const EPS=.002;

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
          endClockDifferenceSeconds:end};
        throw error;
      }
    }
  }
  return true;
}

// A rider may leave a paid road at an exactly recorded boundary. The
// departing road begins at the same clock, but cannot silently cross any
// different road during the kilometre.
export function assertNoUnpaidLaunchCrossingsV1(prior,
  advancedRoads,launchEvents=[]){
  assertNoUnpaidRoadCrossingsV1(prior,advancedRoads);
  if(!Array.isArray(launchEvents)||
    !Number.isInteger(prior?.sourceKm)||
    prior.sourceKm<0)
    throw new Error('Launch guard needs a measured boundary.');
  const before=new Map(prior.roads.map(row=>
    [row.roadId,row]));
  const after=new Map(advancedRoads.map(row=>
    [row.roadId,row]));
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
      (Math.abs(start)<=EPS||Math.abs(end)<=EPS||
        Math.sign(start)!==Math.sign(end))){
      const error=new Error(
        'Launched road needs recorded paid contact.');
      error.sourceEvidence={
        version:PHYSICAL_FIRST_LAUNCH_CROSSING_GUARD_VERSION,
        firstRoadId:firstId,secondRoadId:secondId,
        startClockDifferenceSeconds:start,
        endClockDifferenceSeconds:end};
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
