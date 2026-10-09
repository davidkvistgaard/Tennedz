import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentRearCatchFollowupFromTour} from
  './finale-concurrent-rear-catch-followup.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_REAR_BUNCH_ARRIVAL_VERSION=
  'v2-finale-concurrent-rear-bunch-arrival-1';

export function rearBunchArrivalEvent({frontPositionM,bunchPositionM,
  frontNextBoundaryM,bunchNextBoundaryM,frontSpeedMps,bunchSpeedMps}){
  if(![frontPositionM,bunchPositionM,frontNextBoundaryM,
    bunchNextBoundaryM,frontSpeedMps,bunchSpeedMps]
    .every(Number.isFinite)||
    !(bunchPositionM<bunchNextBoundaryM&&
      Math.abs(bunchNextBoundaryM-frontPositionM)<1e-8&&
      frontPositionM<frontNextBoundaryM)||
    frontSpeedMps<=0||bunchSpeedMps<=0)
    throw new Error('Rear-bunch arrival needs ordered positive travel.');
  const frontArrival=(frontNextBoundaryM-frontPositionM)/frontSpeedMps;
  const bunchArrival=(bunchNextBoundaryM-bunchPositionM)/bunchSpeedMps;
  const contact=bunchSpeedMps>frontSpeedMps?
    (frontPositionM-bunchPositionM)/
      (bunchSpeedMps-frontSpeedMps):Infinity;
  if(contact<=Math.min(frontArrival,bunchArrival)+1e-9)
    return {kind:'front_bunch_contact_uncontinued',seconds:contact};
  return frontArrival<bunchArrival?
    {kind:'front_at_next_boundary',seconds:frontArrival}:
    {kind:'bunch_at_second_slice_boundary',seconds:bunchArrival};
}

// The front rider starts the next 100 m slice using the existing ordered
// worker decision. The bunch only completes the remaining paid 250 m work;
// contact and either boundary stop this recording before any new group work.
export function recordFinaleConcurrentRearBunchArrivalFromTour(tour){
  const previous=recordFinaleConcurrentRearCatchFollowupFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[2];
  if(previous.event!=='front_at_next_boundary'||
    previous.roadBands.length!==2||
    Math.abs(previous.frontPositionM-slice.startDistanceM)>1e-8||
    Math.abs(plan.endDistanceM-slice.startDistanceM)>1e-8)
    throw new Error('Rear-bunch arrival needs a separated front at 500 m.');
  const teams=tour.committedInputs.teams;
  const team=teams.find(row=>row.riders.some(rider=>
    rider.id===previous.frontRiderId));
  const rider=team?.riders.find(row=>row.id===previous.frontRiderId);
  const priorFront=previous.riders.find(row=>
    row.riderId===previous.frontRiderId);
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(team.orders,slice.sourceKm-1);
  const proposed=order.breakWork==='sit_on'||
    priorFront.energyAtEvent<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,
      energy:priorFront.energyAtEvent,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const worker=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=priorFront.energyAtEvent+1e-9?
    proposed:null;
  const frontSpeedKph=worker?.speedKph??finalePassiveFrontSpeed({
    riderIds:[previous.frontRiderId],
    ridersById:new Map([[previous.frontRiderId,rider]]),
    energies:new Map([[previous.frontRiderId,priorFront.energyAtEvent]]),
    segment});
  const frontCostPerKm=worker?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy:priorFront.energyAtEvent,
      exposed:segment.exposed}).energyCostMultiplier;
  const event=rearBunchArrivalEvent({
    frontPositionM:previous.frontPositionM,
    bunchPositionM:previous.bunchPositionM,
    frontNextBoundaryM:slice.endDistanceM,
    bunchNextBoundaryM:plan.endDistanceM,
    frontSpeedMps:frontSpeedKph/3.6,
    bunchSpeedMps:plan.bunchSpeedKph/3.6});
  const riders=previous.riders.map(row=>{
    const front=row.riderId===previous.frontRiderId;
    const distanceM=(front?frontSpeedKph:plan.bunchSpeedKph)/3.6*
      event.seconds;
    const costPerKm=front?frontCostPerKm:
      row.energySpent*1000/row.distanceM;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>
        (front?slice.endDistanceM:plan.endDistanceM)+1e-8)
      throw new Error('Rear-bunch arrival exceeds earned work or boundary.');
    return {riderId:row.riderId,
      role:front?worker?'front':'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtPreviousEvent:row.energyAtEvent,
      distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===previous.frontRiderId);
  const bunch=riders.filter(row=>row.riderId!==previous.frontRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    event.kind==='front_bunch_contact_uncontinued'&&
      Math.abs(front.positionM-bunchPositionM)>1e-8||
    event.kind==='front_at_next_boundary'&&
      Math.abs(front.positionM-slice.endDistanceM)>1e-8||
    event.kind==='bunch_at_second_slice_boundary'&&
      Math.abs(bunchPositionM-plan.endDistanceM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Rear-bunch arrival lost a road position.');
  const roadBands=event.kind==='front_bunch_contact_uncontinued'?
    [{kind:'bunch',positionM:bunchPositionM,
      riderIds:riders.map(row=>row.riderId)}]:
    [{kind:'front',positionM:front.positionM,
      riderIds:[previous.frontRiderId]},
    {kind:'bunch',positionM:bunchPositionM,
      riderIds:bunch.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_REAR_BUNCH_ARRIVAL_VERSION,
    sourcePreviousVersion:previous.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSincePreviousSeconds:event.seconds,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds+
      event.seconds,
    frontRiderId:previous.frontRiderId,
    caughtRiderId:previous.caughtRiderId,
    frontDecision:worker?'paid_pull':'passive',
    frontSpeedKph,frontCostPerKm,
    frontNextBoundaryM:slice.endDistanceM,
    bunchNextBoundaryM:plan.endDistanceM,
    frontPositionM:front.positionM,bunchPositionM,
    roadBands,riders,riderAttackLoad:previous.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentRearBunchArrivalFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentRearBunchArrivalFromTour(tour)))
    throw new Error('Concurrent rear-bunch arrival does not replay.');
  return true;
}
