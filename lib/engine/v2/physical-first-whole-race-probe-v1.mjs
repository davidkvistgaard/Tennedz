// Experimental source-independent runner. Stops at the first missing
// event contract; it never adopts a historical checkpoint gap.
import {advancePhysicalFirstPelotonKmV1} from
  './physical-first-peloton-km-v1.mjs';
import {advancePhysicalFirstRoadV1} from
  './physical-first-road-step-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION=
  'physical-first-whole-race-probe-1';
const EPS=.002;

export function runPhysicalFirstWholeRaceProbeV1({start,kilometres,
  teams,stakes,emergencyFrontWorkers=[]}){
  if(start?.sourceKm!==0||!Array.isArray(start?.roads)||
    start.roads.length!==1||
    start.roads[0].roadId!=='peloton'||
    start.roads[0].clockSeconds!==0||
    !Array.isArray(start?.riders)||
    start.riders.length!==start.roads[0].riderIds.length||
    !Array.isArray(kilometres)||!kilometres.length||
    !Array.isArray(teams)||!Array.isArray(stakes))
    throw new Error('Whole-race probe needs a measured start bunch.');
  const riderIds=new Set(start.roads[0].riderIds);
  if(riderIds.size!==start.riders.length||
    new Set(start.riders.map(row=>row.riderId)).size!==
      start.riders.length||
    start.riders.some(row=>!riderIds.has(row.riderId)||
      row.roadId!=='peloton'||row.distanceM!==0||
      row.clockSeconds!==0||
      !Number.isFinite(row.reserve)||
      row.quietKm!==0))
    throw new Error('Whole-race probe has invalid start riders.');
  const teamByRider=new Map(teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team.id])));
  if(teamByRider.size!==riderIds.size||
    start.riders.some(row=>teamByRider.get(row.riderId)!==
      row.teamId))
    throw new Error('Whole-race probe needs committed rider teams.');
  const states=[start],steps=[];
  for(const segment of kilometres){
    const prior=states.at(-1);
    const km=prior.sourceKm+1;
    if(segment?.km!==km)
      throw new Error('Whole-race probe has a route gap.');
    try{
      if(teams.some(team=>orderAt(team.orders,km-1)
        .attack!=='none'))
        throw new Error(
          'Ordered attacks need physical-first rider choices.');
      const input={prior,segment,kilometres,teams,stakes,
        emergencyFrontWorkers};
      const peloton=advancePhysicalFirstPelotonKmV1(input);
      const soloSteps=prior.roads.filter(road=>
        road.roadId!=='peloton').map(road=>{
        if(road.riderIds.length!==1)
          throw new Error(
            'Rear group needs recorded paid contact and leader.');
        return advancePhysicalFirstRoadV1({...input,
          roadId:road.roadId,
          leaderRiderId:road.riderIds[0],
          planVersion:'physical-first-solo-continuation-1'});
      });
      const roads=[...peloton.roads,
        ...soloSteps.map(step=>step.road)];
      const finishes=[...peloton.finishes,
        ...soloSteps.flatMap(step=>step.finishes)];
      const byFinish=new Map(finishes.map(row=>
        [row.riderId,row]));
      if(finishes.length!==riderIds.size||
        byFinish.size!==riderIds.size||
        [...riderIds].some(id=>!byFinish.has(id))||
        new Set(roads.map(road=>road.roadId)).size!==
          roads.length)
        throw new Error(
          'Whole-race probe lacks a paid rider finish.');
      const frontClockSeconds=peloton.road.finishClockSeconds;
      for(const priorRoad of prior.roads){
        if(priorRoad.roadId==='peloton')continue;
        const nextRoad=roads.find(row=>
          row.roadId===priorRoad.roadId);
        const before=priorRoad.clockSeconds-
          prior.roads.find(row=>
            row.roadId==='peloton').clockSeconds;
        const after=nextRoad.finishClockSeconds-
          frontClockSeconds;
        if(Math.abs(before)<=EPS||Math.abs(after)<=EPS||
          Math.sign(before)!==Math.sign(after))
          throw new Error(
            'Road crossing needs recorded paid contact.');
      }
      const next={version:PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION,
        sourceKm:km,boundaryDistanceM:km*1000,
        frontClockSeconds,roads:roads.map(road=>({
          roadId:road.roadId,riderIds:road.riderIds,
          clockSeconds:road.finishClockSeconds,
          leadOverFrontSeconds:+(frontClockSeconds-
            road.finishClockSeconds).toFixed(6)})),
        riders:finishes.map(finish=>({
          riderId:finish.riderId,
          teamId:teamByRider.get(finish.riderId),
          roadId:finish.physicalGroup,
          distanceM:finish.endDistanceM,
          clockSeconds:finish.clockSeconds,
          reserve:finish.energyAfter,
          quietKm:finish.quietKm})),
        sourceGroupMembershipUsed:false,
        sourceGapUsed:false,officialResults:false};
      steps.push({sourceKm:km,peloton,soloSteps});
      states.push(next);
    }catch(error){
      error.sourceKm=km;
      error.completedThroughKm=km-1;
      throw error;
    }
  }
  return {version:PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION,
    states,steps,completedThroughKm:kilometres.length,
    officialResults:false};
}
