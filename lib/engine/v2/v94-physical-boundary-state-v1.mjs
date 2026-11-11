// Project the paid kilometre boundary without consulting source group
// membership or pressure-derived gaps. This is an experimental input
// seam for a future physical-first kilometre scheduler.
import {validateV94PhysicalWholeRaceV1} from
  './v94-physical-whole-race-validation-v1.mjs';

export const V94_PHYSICAL_BOUNDARY_STATE_VERSION=
  'v94-physical-boundary-state-1';
const EPS=.002;

export function projectV94PhysicalBoundaryStatesV1(
  recording,traces){
  validateV94PhysicalWholeRaceV1(recording,traces);
  const teams=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,team.id])));
  return traces.map(trace=>{
    const km=trace.sourceKm;
    const frontClockSeconds=trace.front?.frontClockSeconds??
      trace.frontClockSeconds;
    if(!Number.isFinite(frontClockSeconds))
      throw new Error(`Physical boundary km ${km} lacks front clock.`);
    const byRoad=new Map();
    const riders=trace.finishes.map(finish=>{
      const teamId=teams.get(finish.riderId);
      if(!teamId)throw new Error(
        `Physical boundary km ${km} lacks rider team.`);
      const road=byRoad.get(finish.physicalGroup);
      if(road){
        if(Math.abs(road.clockSeconds-
          finish.clockSeconds)>EPS)
          throw new Error(
            `Physical boundary km ${km} has split road clock.`);
        road.riderIds.push(finish.riderId);
      }else byRoad.set(finish.physicalGroup,{
        roadId:finish.physicalGroup,
        clockSeconds:finish.clockSeconds,
        riderIds:[finish.riderId]});
      return {riderId:finish.riderId,teamId,
        roadId:finish.physicalGroup,
        distanceM:finish.endDistanceM,
        clockSeconds:finish.clockSeconds,
        reserve:finish.energyAfter};
    }).sort((a,b)=>a.riderId.localeCompare(b.riderId));
    const paidRear=new Map((trace.physicalRearGroups??[])
      .map(road=>[road.roadId,road]));
    const roads=[...byRoad.values()].map(road=>{
      road.riderIds.sort();
      if(road.roadId==='peloton'){
        if(Math.abs(road.clockSeconds-
          frontClockSeconds)>EPS)
          throw new Error(
            `Physical boundary km ${km} has split bunch clock.`);
      }else if(road.riderIds.length>1){
        const receipt=paidRear.get(road.roadId);
        const paidIds=receipt?.riderDecisions?.map(row=>
          row.riderId).sort();
        const paidLeaders=receipt?.riderDecisions?.filter(
          decision=>decision.role==='leader')??[];
        if(receipt?.kind!=='rear_group'||
          !receipt.leaderRiderId||
          paidLeaders.length!==1||
          paidLeaders[0].riderId!==receipt.leaderRiderId||
          paidIds?.length!==road.riderIds.length||
          paidIds.some((id,index)=>
            id!==road.riderIds[index]))
          throw new Error(
            `Physical boundary km ${km} lacks paid rear group.`);
      }
      return {...road,
        leadOverFrontSeconds:+(frontClockSeconds-
          road.clockSeconds).toFixed(6)};
    }).sort((a,b)=>a.clockSeconds-b.clockSeconds||
      a.roadId.localeCompare(b.roadId));
    if(!byRoad.has('peloton'))
      throw new Error(
        `Physical boundary km ${km} lacks paid bunch.`);
    return {version:V94_PHYSICAL_BOUNDARY_STATE_VERSION,
      sourceKm:km,boundaryDistanceM:km*1000,
      frontClockSeconds,riders,roads,
      sourceGroupMembershipUsed:false,
      sourceGapUsed:false,officialResults:false};
  });
}
