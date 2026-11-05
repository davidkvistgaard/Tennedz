// Experimental source-independent runner. Stops at the first missing
// event contract; it never adopts a historical checkpoint gap.
import {advancePhysicalFirstPelotonKmV1} from
  './physical-first-peloton-km-v1.mjs';
import {advancePhysicalFirstRoadV1,
  advancePhysicalFirstRoadWithStartDropsV1} from
  './physical-first-road-step-v1.mjs';
import {orderAt} from './orders.mjs';
import {createHash} from 'node:crypto';
import {assertNoUnpaidRoadCrossingsV1} from
  './physical-first-road-crossing-guard-v1.mjs';
import {resolvePhysicalFirstRearBoundaryContactV1} from
  './physical-first-rear-boundary-contact-v1.mjs';
import {planPhysicalFirstRearLeaderV1} from
  './physical-first-rear-leader-plan-v1.mjs';

export const PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION=
  'physical-first-whole-race-probe-4';
export const physicalFirstInputHash=({kilometres,teams,
  stakes,emergencyFrontWorkers=[]})=>createHash('sha256')
  .update(JSON.stringify({kilometres,teams,stakes,
    emergencyFrontWorkers})).digest('hex');

export function runPhysicalFirstWholeRaceProbeV1({start,kilometres,
  teams,stakes,raceSeed,emergencyFrontWorkers=[]}){
  if(start?.sourceKm!==0||!Array.isArray(start?.roads)||
    start.roads.length!==1||
    start.roads[0].roadId!=='peloton'||
    start.roads[0].clockSeconds!==0||
    !Array.isArray(start?.riders)||
    start.riders.length!==start.roads[0].riderIds.length||
    !Array.isArray(kilometres)||!kilometres.length||
    !Array.isArray(teams)||!Array.isArray(stakes)||
    typeof raceSeed!=='string'||!raceSeed)
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
      const contact=km===1?{
        state:prior,events:[],leaderPlans:[]}:
        resolvePhysicalFirstRearBoundaryContactV1({
          prior,paidStep:steps.at(-1),
          nextSegment:segment,teams,stakes});
      const workingPrior=contact.state;
      const input={prior:workingPrior,segment,kilometres,teams,stakes,
        emergencyFrontWorkers};
      const peloton=advancePhysicalFirstPelotonKmV1(input);
      const otherSteps=workingPrior.roads.filter(road=>
        road.roadId!=='peloton').map(road=>{
        if(road.riderIds.length===1)
          return advancePhysicalFirstRoadV1({...input,
            roadId:road.roadId,
            leaderRiderId:road.riderIds[0],
            planVersion:
              'physical-first-solo-continuation-1'});
        const leaderPlan=contact.leaderPlans.find(
          row=>row.roadId===road.roadId)??
          planPhysicalFirstRearLeaderV1({
            prior:workingPrior,roadId:road.roadId,
            segment,teams,stakes});
        return {...advancePhysicalFirstRoadWithStartDropsV1({
          ...input,roadId:road.roadId,
          leaderRiderId:leaderPlan.leaderRiderId,
          planVersion:leaderPlan.version}),
        leaderPlan};
      });
      const soloSteps=otherSteps.filter(step=>
        step.priorRoadId.startsWith('solo:'));
      const roads=[...peloton.roads,
        ...otherSteps.flatMap(step=>
          step.roads??[step.road])];
      const finishes=[...peloton.finishes,
        ...otherSteps.flatMap(step=>step.finishes)];
      const byFinish=new Map(finishes.map(row=>
        [row.riderId,row]));
      if(finishes.length!==riderIds.size||
        byFinish.size!==riderIds.size||
        [...riderIds].some(id=>!byFinish.has(id))||
        new Set(roads.map(road=>road.roadId)).size!==
          roads.length)
        throw new Error(
          'Whole-race probe lacks a paid rider finish.');
      assertNoUnpaidRoadCrossingsV1(
        workingPrior,roads);
      const frontClockSeconds=peloton.road.finishClockSeconds;
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
      steps.push({sourceKm:km,
        boundaryContactEvents:contact.events,
        peloton,otherSteps,soloSteps});
      states.push(next);
    }catch(error){
      error.sourceKm=km;
      error.completedThroughKm=km-1;
      throw error;
    }
  }
  return {version:PHYSICAL_FIRST_WHOLE_RACE_PROBE_VERSION,
    raceSeed,commitmentHash:physicalFirstInputHash({
      kilometres,teams,stakes,emergencyFrontWorkers}),
    states,steps,completedThroughKm:kilometres.length,
    officialResults:false};
}
