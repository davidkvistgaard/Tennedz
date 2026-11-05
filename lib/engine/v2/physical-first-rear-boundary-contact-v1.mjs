// A measured boundary tie can turn separately paid solos into one rear
// road only with receipts and a payable next-kilometre leader.
import {planPhysicalFirstRearLeaderV1} from
  './physical-first-rear-leader-plan-v1.mjs';

export const PHYSICAL_FIRST_REAR_BOUNDARY_CONTACT_VERSION=
  'physical-first-rear-boundary-contact-2';
const EPS=.002;

export function resolvePhysicalFirstRearBoundaryContactV1({
  prior,paidStep,nextSegment,teams,stakes}){
  if(!Number.isInteger(prior?.sourceKm)||
    prior.sourceKm<1||
    !Array.isArray(prior?.roads)||
    !Array.isArray(prior?.riders)||
    nextSegment?.km!==prior.sourceKm+1||
    !Array.isArray(teams)||!Array.isArray(stakes))
    throw new Error(
      'Rear boundary contact needs measured paid roads.');
  const paidRoads=[
    ...(paidStep?.peloton?.roads??[]),
    ...(paidStep?.attackSteps??[]).map(step=>
      step.road),
    ...(paidStep?.otherSteps??
      paidStep?.soloSteps??[]).flatMap(step=>
      step.roads??[step.road])];
  const byPaidRoad=new Map(paidRoads.map(row=>
    [row.roadId,row]));
  const byRider=new Map(prior.riders.map(row=>
    [row.riderId,row]));
  if(paidStep?.sourceKm!==prior.sourceKm||
    byPaidRoad.size!==paidRoads.length||
    byRider.size!==prior.riders.length)
    throw new Error(
      'Rear boundary contact lacks unique paid receipts.');
  let state=prior;
  const events=[],leaderPlans=[];
  const soloRoads=prior.roads.filter(road=>
    road.roadId.startsWith('solo:')&&
    road.riderIds.length===1);
  const byClock=new Map();
  for(const road of soloRoads){
    const group=byClock.get(road.clockSeconds)??[];
    group.push(road);
    byClock.set(road.clockSeconds,group);
  }
  for(const tied of byClock.values()){
    if(tied.length<2)continue;
    const sorted=[...tied].sort((a,b)=>
      a.riderIds[0].localeCompare(b.riderIds[0]));
    const memberIds=sorted.map(road=>
      road.riderIds[0]);
    const atClockSeconds=sorted[0].clockSeconds;
    const atDistanceM=prior.sourceKm*1000;
    const approach=sorted.map(road=>{
      const riderId=road.riderIds[0];
      const rider=byRider.get(riderId);
      const paid=byPaidRoad.get(road.roadId);
      const decision=paid?.riderDecisions?.[0];
      const finish=paidStep.peloton.finishes
        .concat((paidStep.attackSteps??[]).flatMap(
          step=>step.finishes))
        .concat((paidStep.otherSteps??
          paidStep.soloSteps??[]).flatMap(
          step=>step.finishes))
        .find(row=>row.riderId===riderId);
      if(!rider||rider.roadId!==road.roadId||
        rider.distanceM!==atDistanceM||
        Math.abs(rider.clockSeconds-
          atClockSeconds)>EPS||
        !['solo','solo_attack'].includes(paid?.kind)||
        paid.riderDecisions.length!==1||
        decision.riderId!==riderId||
        !['leader','solo_attacker'].includes(
          decision.role)||
        !finish||
        finish.physicalGroup!==road.roadId||
        finish.endDistanceM!==atDistanceM||
        Math.abs(finish.clockSeconds-
          atClockSeconds)>EPS||
        Math.abs(finish.energyAfter-
          rider.reserve)>EPS||
        !(finish.paidFromReserve>0))
        throw new Error(
          'Rear boundary contact lacks paid solo approach.');
      return {roadId:road.roadId,riderId,
        paidFromReserve:finish.paidFromReserve,
        clockSeconds:finish.clockSeconds,
        energyAfter:finish.energyAfter};
    });
    const roadId=`rear:${prior.sourceKm}:${memberIds.join('+')}`;
    if(state.roads.some(road=>road.roadId===roadId))
      throw new Error(
        'Rear boundary contact would reuse a road ID.');
    const sourceRoadIds=new Set(sorted.map(
      road=>road.roadId));
    const merged={...state,
      roads:state.roads.filter(road=>
        !sourceRoadIds.has(road.roadId)).concat([{
        roadId,riderIds:memberIds,
        clockSeconds:atClockSeconds}]),
      riders:state.riders.map(row=>
        memberIds.includes(row.riderId)?
          {...row,roadId}:row)};
    const leaderPlan=planPhysicalFirstRearLeaderV1({
      prior:merged,roadId,segment:nextSegment,
      teams,stakes});
    events.push({
      version:PHYSICAL_FIRST_REAR_BOUNDARY_CONTACT_VERSION,
      sourceKm:prior.sourceKm,
      atDistanceM,atClockSeconds,
      roadId,fromRoadIds:sorted.map(road=>
        road.roadId),riderIds:memberIds,
      approach,leaderPlan,
      recordedPaidContact:true,
      officialResults:false});
    leaderPlans.push(leaderPlan);
    state=merged;
  }
  return {version:PHYSICAL_FIRST_REAR_BOUNDARY_CONTACT_VERSION,
    state,events,leaderPlans,officialResults:false};
}
