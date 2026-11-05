// Distinct roads cannot exchange clock order without a paid contact
// event. A later contact resolver may replace this refusal.
export const PHYSICAL_FIRST_ROAD_CROSSING_GUARD_VERSION=
  'physical-first-road-crossing-guard-1';
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
