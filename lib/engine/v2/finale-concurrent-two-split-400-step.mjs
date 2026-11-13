import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplit500StepFromTour} from
  './finale-concurrent-two-split-500-step.mjs';
import {recordFinaleConcurrentFront400PlanFromTour} from
  './finale-concurrent-front-400-plan.mjs';
import {concurrentContactRoadBands} from
  './finale-concurrent-contact-state.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {firstThreeBandEvent} from './finale-concurrent-three-band-event.mjs';

export const FINALE_CONCURRENT_TWO_SPLIT_400_STEP_VERSION=
  'v2-finale-concurrent-two-split-400-step-1';

export function twoSplit400NextEvent({frontPositionM,rearPositionM,
  bunchPositionM,frontNextBoundaryM,rearNextBoundaryM,
  bunchNextBoundaryM,frontSpeedMps,rearSpeedMps,bunchSpeedMps}){
  if(![frontPositionM,rearPositionM,bunchPositionM,
    frontNextBoundaryM,rearNextBoundaryM,bunchNextBoundaryM,
    frontSpeedMps,rearSpeedMps,bunchSpeedMps].every(Number.isFinite)||
    !(bunchPositionM<rearPositionM&&rearPositionM<frontPositionM&&
      frontPositionM<frontNextBoundaryM&&
      rearPositionM<rearNextBoundaryM&&
      bunchPositionM<bunchNextBoundaryM&&
      Math.abs(rearNextBoundaryM-bunchNextBoundaryM)<1e-8)||
    Math.min(frontSpeedMps,rearSpeedMps,bunchSpeedMps)<=0)
    throw new Error('Two-split 400 m event needs ordered positive travel.');
  return firstThreeBandEvent({frontPositionM,rearPositionM,bunchPositionM,
    frontNextBoundaryM,rearNextBoundaryM,bunchNextBoundaryM,
    frontSpeedMps,rearSpeedMps,bunchSpeedMps,
    frontBoundaryKind:'front_at_300_boundary',
    rearBoundaryKind:'rear_at_400_boundary',
    bunchBoundaryKind:'bunch_at_400_boundary'});
}

// The front rider has paid to 400 m and starts only their newly affordable
// 100 m work. The rear attacker and bunch complete their previous 500–400 m
// choices on the same clock. Stop before any work changes at contact.
export function recordFinaleConcurrentTwoSplit400StepFromTour(tour){
  const previous=recordFinaleConcurrentTwoSplit500StepFromTour(tour);
  const plan=recordFinaleConcurrentFront400PlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[3];
  if(previous.event!=='front_at_400_boundary'||
    plan.branch!=='two_split'||previous.roadBands.length!==3||
    Math.abs(previous.frontPositionM-slice.startDistanceM)>1e-8||
    Math.abs(plan.startDistanceM-slice.startDistanceM)>1e-8||
    Math.abs(plan.endDistanceM-slice.endDistanceM)>1e-8||
    previous.frontRiderId!==plan.frontRiderId||
    !(previous.bunchPositionM<previous.rearPositionM&&
      previous.rearPositionM<previous.frontPositionM))
    throw new Error('Two-split 400 m step needs three paid road bands.');
  const rearRow=previous.riders.find(row=>
    row.riderId===previous.rearRiderId);
  const bunchRow=previous.riders.find(row=>
    row.riderId!==previous.frontRiderId&&
      row.riderId!==previous.rearRiderId);
  const frontSpeedMps=plan.frontSpeedKph/3.6;
  const rearSpeedMps=rearRow.distanceM/previous.elapsedSince500Seconds;
  const bunchSpeedMps=bunchRow.distanceM/previous.elapsedSince500Seconds;
  const event=twoSplit400NextEvent({
    frontPositionM:previous.frontPositionM,
    rearPositionM:previous.rearPositionM,
    bunchPositionM:previous.bunchPositionM,
    frontNextBoundaryM:slice.endDistanceM,
    rearNextBoundaryM:slice.startDistanceM,
    bunchNextBoundaryM:slice.startDistanceM,
    frontSpeedMps,rearSpeedMps,bunchSpeedMps});
  const riders=previous.riders.map(row=>{
    const front=row.riderId===previous.frontRiderId;
    const rear=row.riderId===previous.rearRiderId;
    const distanceM=(front?frontSpeedMps:rear?rearSpeedMps:
      bunchSpeedMps)*event.seconds;
    const costPerKm=front?plan.frontCostPerKm:
      row.energySpent*1000/row.distanceM;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>
        (front?slice.endDistanceM:slice.startDistanceM)+1e-8)
      throw new Error('Two-split 400 m travel exceeds energy or boundary.');
    return {riderId:row.riderId,
      role:front?plan.frontDecision==='paid_pull'?'front':
        'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtDecision:row.energyAtEvent,distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===previous.frontRiderId);
  const rear=riders.find(row=>row.riderId===previous.rearRiderId);
  const bunch=riders.filter(row=>row.riderId!==previous.frontRiderId&&
    row.riderId!==previous.rearRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    front.positionM+1e-8<rear.positionM||
    rear.positionM+1e-8<bunchPositionM||
    event.kind==='front_at_300_boundary'&&
      Math.abs(front.positionM-slice.endDistanceM)>1e-8||
    event.kind==='rear_at_400_boundary'&&
      Math.abs(rear.positionM-slice.startDistanceM)>1e-8||
    event.kind==='bunch_at_400_boundary'&&
      Math.abs(bunchPositionM-slice.startDistanceM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Two-split 400 m step lost a physical road position.');
  const contact=event.kind.includes('contact');
  const roadBands=contact?concurrentContactRoadBands({
    event:event.kind,firstRiderId:previous.frontRiderId,
    secondRiderId:previous.rearRiderId,riders}):[
    {kind:'front',positionM:front.positionM,
      riderIds:[previous.frontRiderId]},
    {kind:'rear_attack',positionM:rear.positionM,
      riderIds:[previous.rearRiderId]},
    {kind:'bunch',positionM:bunchPositionM,
      riderIds:bunch.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_TWO_SPLIT_400_STEP_VERSION,
    sourcePreviousVersion:previous.version,
    sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSince400Seconds:event.seconds,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds+
      event.seconds,
    frontRiderId:previous.frontRiderId,
    rearRiderId:previous.rearRiderId,
    frontNextBoundaryM:slice.endDistanceM,
    rearNextBoundaryM:slice.startDistanceM,
    bunchNextBoundaryM:slice.startDistanceM,
    frontPositionM:front.positionM,rearPositionM:rear.positionM,
    bunchPositionM,roadBands,riders,
    riderAttackLoad:previous.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentTwoSplit400StepFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentTwoSplit400StepFromTour(tour)))
    throw new Error('Concurrent two-split 400 m step does not replay.');
  return true;
}
