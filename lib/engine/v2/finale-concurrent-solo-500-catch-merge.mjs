import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentSolo500StepFromTour} from
  './finale-concurrent-solo-500-step.mjs';
import {recordFinaleConcurrentSelective500PlanFromTour} from
  './finale-concurrent-selective-500-plan.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_SOLO_500_CATCH_MERGE_VERSION=
  'v2-finale-concurrent-solo-500-catch-merge-1';

// Once the sole attack is physically caught, the chase has no target. The
// chosen rotation pair may finish its already affordable turn; all other
// riders are sheltered until the shared 400 m boundary.
export function recordFinaleConcurrentSolo500CatchMergeFromTour(tour){
  const caught=recordFinaleConcurrentSolo500StepFromTour(tour);
  const plan=recordFinaleConcurrentSelective500PlanFromTour(tour);
  if(caught.event!=='front_bunch_contact_uncontinued'||
    caught.roadBands.length!==1||
    caught.roadBands[0].riderIds.length!==caught.riders.length||
    caught.bunchPositionM>=plan.endDistanceM)
    throw new Error('Solo 500 m merge needs an exact catch inside the slice.');
  const riderIds=caught.riders.map(row=>row.riderId);
  const energies=new Map(caught.riders.map(row=>
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
    id===plan.chase?.riderId||id===caught.frontRiderId))
    throw new Error('Caught riders cannot keep an incompatible front role.');
  const bunchSpeedKph=Math.max(passiveSpeedKph,
    selectedRotation?.speedKph??0);
  const startDistanceM=caught.bunchPositionM;
  const distanceM=plan.endDistanceM-startDistanceM;
  const elapsedSeconds=distanceM*3.6/bunchSpeedKph;
  const sliceLengthM=plan.endDistanceM-plan.startDistanceM;
  const riders=caught.riders.map(row=>{
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
      energyAtCatch:row.energyAtEvent,energySpent,
      energyAtBoundary:Math.max(0,row.energyAtEvent-energySpent),
      positionM:plan.endDistanceM};
  });
  if(riders.length!==caught.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length||
    !Number.isFinite(elapsedSeconds)||elapsedSeconds<=0)
    throw new Error('Solo 500 m merge lost its complete field.');
  return {version:FINALE_CONCURRENT_SOLO_500_CATCH_MERGE_VERSION,
    sourceCatchVersion:caught.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:'bunch_at_400_boundary',
    startDistanceM,endDistanceM:plan.endDistanceM,
    elapsedSinceCatchSeconds:elapsedSeconds,
    elapsedSinceLaunchSeconds:caught.elapsedSinceLaunchSeconds+
      elapsedSeconds,passiveSpeedKph,bunchSpeedKph,
    chaseDecision:'stop_no_front_target',
    rotationRiderIds:selectedRotation?.riderIds??[],
    roadBands:[{kind:'bunch',positionM:plan.endDistanceM,riderIds}],
    riders,riderAttackLoad:caught.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentSolo500CatchMergeFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSolo500CatchMergeFromTour(tour)))
    throw new Error('Concurrent solo 500 m catch merge does not replay.');
  return true;
}
