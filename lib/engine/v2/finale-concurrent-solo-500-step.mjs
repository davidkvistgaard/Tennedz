import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentSelective500StateFromTour} from
  './finale-concurrent-selective-500-state.mjs';
import {recordFinaleConcurrentSelective500PlanFromTour} from
  './finale-concurrent-selective-500-plan.mjs';
import {recordFinaleConcurrentRearBunchArrivalFromTour} from
  './finale-concurrent-rear-bunch-arrival.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_SOLO_500_STEP_VERSION=
  'v2-finale-concurrent-solo-500-step-1';

export function solo500NextEvent({frontPositionM,bunchPositionM,
  nextBoundaryM,frontSpeedMps,bunchSpeedMps}){
  if(![frontPositionM,bunchPositionM,nextBoundaryM,
    frontSpeedMps,bunchSpeedMps].every(Number.isFinite)||
    !(bunchPositionM<frontPositionM&&
      frontPositionM<nextBoundaryM)||
    frontSpeedMps<=0||bunchSpeedMps<=0)
    throw new Error('Solo 500 m step needs ordered positive travel.');
  const frontArrival=(nextBoundaryM-frontPositionM)/frontSpeedMps;
  const bunchArrival=(nextBoundaryM-bunchPositionM)/bunchSpeedMps;
  const contact=bunchSpeedMps>frontSpeedMps?
    (frontPositionM-bunchPositionM)/
      (bunchSpeedMps-frontSpeedMps):Infinity;
  const earliest=Math.min(frontArrival,bunchArrival,contact);
  return {kind:Math.abs(contact-earliest)<1e-9?
    'front_bunch_contact_uncontinued':
    frontArrival<=bunchArrival?'front_at_400_boundary':
      'bunch_at_400_boundary',seconds:earliest};
}

// The solo rider keeps the paid 100 m pace chosen at their own 500 m arrival.
// The bunch starts only its newly recorded 100 m chase/rotation plan. All
// riders travel for the same time and stop at the first boundary or contact.
export function recordFinaleConcurrentSolo500StepFromTour(tour){
  const state=recordFinaleConcurrentSelective500StateFromTour(tour);
  const previous=recordFinaleConcurrentRearBunchArrivalFromTour(tour);
  const plan=recordFinaleConcurrentSelective500PlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[2];
  if(state.branch!=='solo_ahead'||plan.branch!==state.branch||
    previous.event!=='bunch_at_second_slice_boundary'||
    state.roadBands.length!==2||
    Math.abs(state.boundaryM-slice.startDistanceM)>1e-8||
    Math.abs(plan.startDistanceM-slice.startDistanceM)>1e-8)
    throw new Error('Solo 500 m step needs a paid solo/bunch handoff.');
  const frontRow=previous.riders.find(row=>
    row.riderId===state.frontRiderId);
  const frontSpeedMps=previous.frontSpeedKph/3.6;
  const bunchSpeedMps=plan.bunchSpeedKph/3.6;
  const event=solo500NextEvent({
    frontPositionM:frontRow.positionM,
    bunchPositionM:state.boundaryM,
    nextBoundaryM:slice.endDistanceM,
    frontSpeedMps,bunchSpeedMps});
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const rotationWork=new Map(plan.rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  const riders=previous.riders.map(row=>{
    const front=row.riderId===state.frontRiderId;
    const chaser=row.riderId===plan.chase?.riderId;
    const rotation=rotationWork.get(row.riderId);
    const speedMps=front?frontSpeedMps:bunchSpeedMps;
    const distanceM=speedMps*event.seconds;
    const costPerKm=front?row.energySpent*1000/row.distanceM:
      chaser?plan.chase.workCostPerKm:
        rotation?rotation.energySpent*1000/slice.lengthM:
          TUNING.effortCost.conserve*riderKilometreEffect(
            ridersById.get(row.riderId),segment,{
              phase:'chase',energy:row.energyAtEvent,
              exposed:segment.exposed}).energyCostMultiplier;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>slice.endDistanceM+1e-8)
      throw new Error('Solo 500 m step exceeds earned energy or boundary.');
    return {riderId:row.riderId,
      role:front?row.role:chaser?'chase':
        rotation?'front_rotation':'sheltered',
      positionM:row.positionM+distanceM,
      energyAtDecision:row.energyAtEvent,
      distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===state.frontRiderId);
  const bunch=riders.filter(row=>row.riderId!==state.frontRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    event.kind==='front_bunch_contact_uncontinued'&&
      Math.abs(front.positionM-bunchPositionM)>1e-8||
    event.kind==='front_at_400_boundary'&&
      Math.abs(front.positionM-slice.endDistanceM)>1e-8||
    event.kind==='bunch_at_400_boundary'&&
      Math.abs(bunchPositionM-slice.endDistanceM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Solo 500 m step lost its physical road state.');
  const roadBands=event.kind==='front_bunch_contact_uncontinued'?
    [{kind:'bunch',positionM:bunchPositionM,
      riderIds:riders.map(row=>row.riderId)}]:
    [{kind:'front',positionM:front.positionM,
      riderIds:[state.frontRiderId]},
    {kind:'bunch',positionM:bunchPositionM,
      riderIds:bunch.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_SOLO_500_STEP_VERSION,
    sourceStateVersion:state.version,
    sourcePreviousVersion:previous.version,
    sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSince500Seconds:event.seconds,
    elapsedSinceLaunchSeconds:state.elapsedSinceLaunchSeconds+
      event.seconds,
    startDistanceM:slice.startDistanceM,
    nextBoundaryM:slice.endDistanceM,
    frontRiderId:state.frontRiderId,
    frontPositionM:front.positionM,bunchPositionM,
    bunchSpeedKph:plan.bunchSpeedKph,
    chaseRiderId:plan.chase?.riderId??null,
    rotationRiderIds:plan.rotation.selected?.riderIds??[],
    roadBands,riders,riderAttackLoad:state.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentSolo500StepFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSolo500StepFromTour(tour)))
    throw new Error('Concurrent solo 500 m step does not replay.');
  return true;
}
