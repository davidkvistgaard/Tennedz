import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentRearCatchFollowupFromTour} from
  './finale-concurrent-rear-catch-followup.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_DOUBLE_CATCH_MERGE_VERSION=
  'v2-finale-concurrent-double-catch-merge-1';

// With both named attacks physically caught, the chase has no remaining
// front target. Its helper and both attackers become sheltered; the already
// selected rotation pair may finish its turn. No sprint order is inferred.
export function recordFinaleConcurrentDoubleCatchMergeFromTour(tour){
  const catchState=recordFinaleConcurrentRearCatchFollowupFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  if(catchState.event!=='front_bunch_contact_uncontinued'||
    catchState.roadBands.length!==1||
    catchState.roadBands[0].riderIds.length!==catchState.riders.length||
    catchState.bunchPositionM>=plan.endDistanceM)
    throw new Error('Double-catch merge needs both attacks caught inside the slice.');
  const riderIds=catchState.riders.map(row=>row.riderId);
  const energies=new Map(catchState.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres.at(-1);
  const passiveSpeedKph=finalePassiveBunchSpeed({
    riderIds,ridersById,energies,segment});
  const selectedRotation=plan.rotation.selected;
  const rotationWork=new Map(selectedRotation?.work.map(row=>
    [row.riderId,row])??[]);
  if([...rotationWork.keys()].some(id=>!energies.has(id)||
    id===plan.chase?.riderId||
    id===catchState.frontRiderId||
    id===catchState.caughtRiderId))
    throw new Error('Caught riders cannot keep an incompatible front role.');
  const bunchSpeedKph=Math.max(passiveSpeedKph,
    selectedRotation?.speedKph??0);
  const startDistanceM=catchState.bunchPositionM;
  const distanceM=plan.endDistanceM-startDistanceM;
  const elapsedSeconds=distanceM*3.6/bunchSpeedKph;
  const sliceLengthM=plan.endDistanceM-plan.startDistanceM;
  const riders=catchState.riders.map(row=>{
    const rotation=rotationWork.get(row.riderId);
    const workCostPerKm=rotation?
      rotation.energySpent*1000/sliceLengthM:
      TUNING.effortCost.conserve*riderKilometreEffect(
        ridersById.get(row.riderId),segment,{
          phase:'chase',energy:row.energyAtEvent,
          exposed:segment.exposed}).energyCostMultiplier;
    const energySpent=workCostPerKm*distanceM/1000;
    if(!Number.isFinite(workCostPerKm)||workCostPerKm<0||
      energySpent>row.energyAtEvent+1e-9)
      throw new Error('The reunited bunch cannot pay its remaining travel.');
    return {riderId:row.riderId,
      role:rotation?'front_rotation':'sheltered',
      energyAtCatch:row.energyAtEvent,
      energySpent,
      energyAtBoundary:Math.max(0,row.energyAtEvent-energySpent),
      positionM:plan.endDistanceM};
  });
  if(riders.length!==catchState.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length||
    !Number.isFinite(elapsedSeconds)||elapsedSeconds<=0)
    throw new Error('Double-catch merge lost its complete field.');
  return {version:FINALE_CONCURRENT_DOUBLE_CATCH_MERGE_VERSION,
    sourceCatchVersion:catchState.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    event:'bunch_at_next_boundary',
    startDistanceM,endDistanceM:plan.endDistanceM,
    elapsedSinceCatchSeconds:elapsedSeconds,
    elapsedSinceLaunchSeconds:catchState.elapsedSinceLaunchSeconds+
      elapsedSeconds,
    passiveSpeedKph,bunchSpeedKph,
    chaseDecision:'stop_no_front_target',
    rotationRiderIds:selectedRotation?.riderIds??[],
    roadBands:[{kind:'bunch',positionM:plan.endDistanceM,riderIds}],
    riders,riderAttackLoad:catchState.riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentDoubleCatchMergeFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentDoubleCatchMergeFromTour(tour)))
    throw new Error('Concurrent double-catch merge does not replay.');
  return true;
}
