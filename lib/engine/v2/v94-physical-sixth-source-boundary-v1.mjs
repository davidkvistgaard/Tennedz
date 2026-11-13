// Compare source km-6 break turn plans with the paid km-5 road boundary.
// Source membership or a checkpoint gap cannot create physical contact.
import {isDeepStrictEqual} from 'node:util';

export const V94_PHYSICAL_SIXTH_SOURCE_BOUNDARY_VERSION=
  'v94-physical-sixth-source-boundary-1';
const EPS=1e-7;

export function inspectV94PhysicalSixthSourceBoundaryV1(
  recording,prior){
  const starterCount=recording.committedInputs.teams.reduce(
    (sum,team)=>sum+team.riders.length,0);
  if(prior?.sourceKm!==5||!prior.fullFieldKilometre||
    prior.finishes.length!==starterCount||
    prior.sourceCheckpointCalibrationFailed!==true)
    throw new Error('Sixth source boundary needs paid km 5.');
  const sourcePrevious=recording.frames[4];
  const sourceNext=recording.frames[5];
  if(recording.route.kilometres[5]?.km!==6||
    !Array.isArray(sourcePrevious?.roadGroups)||
    !Array.isArray(sourceNext?.roadGroupTurnPlans))
    throw new Error('Sixth source boundary needs recorded plans.');
  const byId=new Map(prior.finishes.map(row=>
    [row.riderId,row]));
  const sourceRoads=sourcePrevious.roadGroups.map(group=>{
    const plan=sourceNext.roadGroupTurnPlans.find(row=>
      row.roadGroupId===group.id);
    const finishes=group.riderIds.map(id=>byId.get(id));
    if(!plan||finishes.some(row=>!row)||
      plan.turns.some(turn=>!group.riderIds.includes(
        turn.leaderRiderId)))
      throw new Error('Sixth source plan lacks paid prior riders.');
    const clocks=finishes.map(row=>row.clockSeconds);
    const earliestClockSeconds=Math.min(...clocks);
    const latestClockSeconds=Math.max(...clocks);
    const distinctPhysicalRoadIds=[...new Set(finishes.map(row=>
      row.physicalGroup))];
    const physicallyCoLocatedAtBoundary=
      latestClockSeconds-earliestClockSeconds<=EPS&&
      finishes.every(row=>row.endDistanceM===5000);
    const physicalGroupAlreadyFormed=
      physicallyCoLocatedAtBoundary&&
      distinctPhysicalRoadIds.length===1&&
      !distinctPhysicalRoadIds[0].startsWith('solo-');
    const singlePaidSolo=group.riderIds.length===1&&
      physicallyCoLocatedAtBoundary;
    return {sourceRoadGroupId:group.id,
      sourceRiderIds:[...group.riderIds],
      sourceCheckpointGapSeconds:group.gapSeconds,
      sourcePlanStatus:plan.status,
      sourceNamedLeaderRiderIds:plan.turns.map(turn=>
        turn.leaderRiderId),
      earliestClockSeconds,latestClockSeconds,
      boundaryClockSpreadSeconds:
        latestClockSeconds-earliestClockSeconds,
      distinctPhysicalRoadIds,
      physicallyCoLocatedAtBoundary,
      physicalGroupAlreadyFormed,
      singlePaidSolo,
      paidFormationPending:physicallyCoLocatedAtBoundary&&
        !physicalGroupAlreadyFormed&&!singlePaidSolo,
      sourcePlanCannotAttach:!physicalGroupAlreadyFormed&&
        !singlePaidSolo};
  });
  return {version:V94_PHYSICAL_SIXTH_SOURCE_BOUNDARY_VERSION,
    sourceKm:6,atDistanceM:5000,
    priorPhysicalVersion:prior.version,
    sourceRoads,
    paidNewDistanceM:0,paidNewEnergy:0,
    physicalRoadGroups:[],
    sourceCheckpointGapNotPhysical:true,
    officialResults:false};
}

export function validateV94PhysicalSixthSourceBoundaryV1(
  recording,prior,observation){
  if(!isDeepStrictEqual(observation,
    inspectV94PhysicalSixthSourceBoundaryV1(recording,prior)))
    throw new Error('Sixth source boundary differs from paid road.');
  return true;
}
