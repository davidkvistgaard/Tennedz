import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplit500RearCatchFromTour} from
  './finale-concurrent-two-split-500-rear-catch.mjs';
import {recordFinaleConcurrentFront400PlanFromTour} from
  './finale-concurrent-front-400-plan.mjs';
import {rearBunchArrivalEvent} from
  './finale-concurrent-rear-bunch-arrival.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';

export const FINALE_CONCURRENT_REAR_CAUGHT_400_STEP_VERSION=
  'v2-finale-concurrent-rear-caught-400-step-1';

// The front rider starts only their newly planned 100 m work at 400 m.
// The bunch, including the caught attacker, finishes the prior 500–400 m
// decision. One clock stops at the first boundary or exact intersection.
export function recordFinaleConcurrentRearCaught400StepFromTour(tour){
  const previous=recordFinaleConcurrentTwoSplit500RearCatchFromTour(tour);
  const plan=recordFinaleConcurrentFront400PlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[3];
  if(plan.branch!=='rear_caught'||
    previous.event!=='front_at_next_boundary'||
    previous.roadBands.length!==2||
    Math.abs(previous.frontPositionM-slice.startDistanceM)>1e-8||
    Math.abs(plan.startDistanceM-slice.startDistanceM)>1e-8||
    Math.abs(plan.endDistanceM-slice.endDistanceM)>1e-8||
    previous.bunchPositionM>=slice.startDistanceM||
    previous.frontRiderId!==plan.frontRiderId)
    throw new Error('Rear-caught 400 m step needs a paid front and bunch.');
  const bunchRow=previous.riders.find(row=>
    row.riderId!==previous.frontRiderId);
  const frontSpeedMps=plan.frontSpeedKph/3.6;
  const bunchSpeedMps=bunchRow.distanceM/
    previous.elapsedSinceContactSeconds;
  const event=rearBunchArrivalEvent({
    frontPositionM:previous.frontPositionM,
    bunchPositionM:previous.bunchPositionM,
    frontNextBoundaryM:slice.endDistanceM,
    bunchNextBoundaryM:slice.startDistanceM,
    frontSpeedMps,bunchSpeedMps});
  const riders=previous.riders.map(row=>{
    const front=row.riderId===previous.frontRiderId;
    const distanceM=(front?frontSpeedMps:bunchSpeedMps)*event.seconds;
    const costPerKm=front?plan.frontCostPerKm:
      row.energySpent*1000/row.distanceM;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>
        (front?slice.endDistanceM:slice.startDistanceM)+1e-8)
      throw new Error('Rear-caught 400 m travel exceeds energy or boundary.');
    return {riderId:row.riderId,
      role:front?plan.frontDecision==='paid_pull'?'front':
        'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtDecision:row.energyAtEvent,distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===previous.frontRiderId);
  const bunch=riders.filter(row=>row.riderId!==previous.frontRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    front.positionM+1e-8<bunchPositionM||
    event.kind==='front_at_next_boundary'&&
      Math.abs(front.positionM-slice.endDistanceM)>1e-8||
    event.kind==='bunch_at_second_slice_boundary'&&
      Math.abs(bunchPositionM-slice.startDistanceM)>1e-8||
    event.kind==='front_bunch_contact_uncontinued'&&
      Math.abs(front.positionM-bunchPositionM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Rear-caught 400 m step lost its physical road state.');
  const contact=event.kind==='front_bunch_contact_uncontinued';
  const roadBands=contact?[{kind:'bunch',positionM:bunchPositionM,
    riderIds:riders.map(row=>row.riderId)}]:[
    {kind:'front',positionM:front.positionM,
      riderIds:[previous.frontRiderId]},
    {kind:'bunch',positionM:bunchPositionM,
      riderIds:bunch.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_REAR_CAUGHT_400_STEP_VERSION,
    sourcePreviousVersion:previous.version,
    sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSince400Seconds:event.seconds,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds+
      event.seconds,
    frontRiderId:previous.frontRiderId,
    caughtRiderId:previous.caughtRiderId,
    frontNextBoundaryM:slice.endDistanceM,
    bunchNextBoundaryM:slice.startDistanceM,
    frontPositionM:front.positionM,bunchPositionM,
    roadBands,riders,riderAttackLoad:previous.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentRearCaught400StepFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentRearCaught400StepFromTour(tour)))
    throw new Error('Concurrent rear-caught 400 m step does not replay.');
  return true;
}
