import {validateRecordedTour} from './recording.mjs';
import {buildFinaleWorkerPlan} from './finale-worker.mjs';
import {simulateFinalePair} from './finale-pair.mjs';

// A read-only bridge from a completed kilometre recording to the isolated
// two-worker laboratory. It cannot substitute for a road-group finale.
export function probeFinalePairFromTour(tour,{frontRiderId,chaseRiderId}){
  validateRecordedTour(tour);
  const sourceKm=tour.route.distanceKm-5;
  const frame=tour.frames[sourceKm-1];
  if(frame?.km!==sourceKm||frame.roadGroups.length!==1||
    frame.roadGroups[0].riderIds.length!==1||
    frame.roadGroups[0].riderIds[0]!==frontRiderId||
    !Number.isFinite(frame.roadGroups[0].gapSeconds)||
    frame.roadGroups[0].gapSeconds<=0)
    throw new Error('The 5 km snapshot needs the selected rider alone ahead of the bunch.');
  const frontState=frame.riderGroups.find(rider=>rider.id===frontRiderId);
  const chaseState=frame.riderGroups.find(rider=>rider.id===chaseRiderId);
  const frontTeam=tour.committedInputs.teams.find(team=>
    team.id===frontState?.teamId);
  const chaseTeam=tour.committedInputs.teams.find(team=>
    team.id===chaseState?.teamId);
  if(!frontTeam||!chaseTeam||frontTeam.id===chaseTeam.id||
    frontState.group!=='breakaway'||chaseState.group!=='peloton'||
    !frame.engagedChaseTeamIds.includes(chaseTeam.id))
    throw new Error('The selected rival must be in a team engaged in the bunch chase.');
  const input={route:tour.route,
    initialGapSeconds:frame.roadGroups[0].gapSeconds,
    front:buildFinaleWorkerPlan({route:tour.route,team:frontTeam,
      riderId:frontRiderId,energy:frontState.energy,role:'front'}),
    rear:buildFinaleWorkerPlan({route:tour.route,team:chaseTeam,
      riderId:chaseRiderId,energy:chaseState.energy,role:'chase'})};
  return {sourceKm,sourceTuningVersion:tour.tuningVersion,input,
    recording:simulateFinalePair(input)};
}
