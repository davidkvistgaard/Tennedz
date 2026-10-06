import {validateRecordedTour} from './recording.mjs';
import {buildFinaleWorkerPlan} from './finale-worker.mjs';
import {simulateFinalePair} from './finale-pair.mjs';
import {simulateFinaleRelay} from './finale-relay.mjs';
import {TUNING} from './tuning.mjs';

// Read-only bridges from a completed kilometre recording to isolated worker
// laboratories. Neither can substitute for a road-group finale.
function soloSnapshot(tour,frontRiderId){
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
  const frontTeam=tour.committedInputs.teams.find(team=>
    team.id===frontState?.teamId);
  if(!frontTeam||frontState.group!=='breakaway')
    throw new Error('The selected solo rider must still be in the front group.');
  const priorGap=tour.frames[sourceKm-2]?.roadGroups.at(-1)?.gapSeconds??0;
  const sourceWarnings=frame.attackPower===0&&frame.chasePower>0&&
    frame.passiveGapDelta>0&&
    frame.chasePower*TUNING.chase.recoverySecondsPerCapacity>=
      priorGap+frame.passiveGapDelta&&frame.roadGroups[0].gapSeconds>0?
    ['residual_gap_after_sufficient_chase']:[];
  return {sourceKm,frame,frontState,frontTeam,sourceWarnings};
}

function chasingHelper(tour,frame,chaseRiderId,frontTeamId){
  const chaseState=frame.riderGroups.find(rider=>rider.id===chaseRiderId);
  const chaseTeam=tour.committedInputs.teams.find(team=>
    team.id===chaseState?.teamId);
  if(!chaseTeam||frontTeamId===chaseTeam.id||
    chaseState.group!=='peloton'||
    !frame.engagedChaseTeamIds.includes(chaseTeam.id))
    throw new Error('The selected rival must be in a team engaged in the bunch chase.');
  return {team:chaseTeam,riderId:chaseRiderId,energy:chaseState.energy};
}

export function probeFinalePairFromTour(tour,{frontRiderId,chaseRiderId}){
  const {sourceKm,frame,frontState,frontTeam,sourceWarnings}=
    soloSnapshot(tour,frontRiderId);
  const chaser=chasingHelper(tour,frame,chaseRiderId,frontTeam.id);
  const input={route:tour.route,
    initialGapSeconds:frame.roadGroups[0].gapSeconds,
    front:buildFinaleWorkerPlan({route:tour.route,team:frontTeam,
      riderId:frontRiderId,energy:frontState.energy,role:'front'}),
    rear:buildFinaleWorkerPlan({route:tour.route,...chaser,role:'chase'})};
  return {sourceKm,sourceTuningVersion:tour.tuningVersion,sourceWarnings,input,
    recording:simulateFinalePair(input)};
}

// The manager-selected rotation is counterfactual; both helpers must really be
// in the bunch and their teams must already be engaged at the source frame.
export function probeFinaleRelayFromTour(tour,{frontRiderId,chaseRiderIds,rotation}){
  const {sourceKm,frame,frontState,frontTeam,sourceWarnings}=
    soloSnapshot(tour,frontRiderId);
  if(!Array.isArray(chaseRiderIds)||chaseRiderIds.length!==2||
    new Set(chaseRiderIds).size!==2)
    throw new Error('The relay needs two different nominated helpers.');
  const input={route:tour.route,initialGapSeconds:frame.roadGroups[0].gapSeconds,
    front:{team:frontTeam,riderId:frontRiderId,energy:frontState.energy},
    chasers:chaseRiderIds.map(id=>chasingHelper(tour,frame,id,frontTeam.id)),
    rotation};
  return {sourceKm,sourceTuningVersion:tour.tuningVersion,sourceWarnings,input,
    recording:simulateFinaleRelay(input)};
}
