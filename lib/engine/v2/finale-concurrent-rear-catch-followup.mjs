import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentContactStateFromTour} from
  './finale-concurrent-contact-state.mjs';
import {recordFinaleConcurrentNextBoundaryFromTour} from
  './finale-concurrent-next-boundary.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_REAR_CATCH_FOLLOWUP_VERSION=
  'v2-finale-concurrent-rear-catch-followup-1';

export function rearCatchFollowupEvent({frontPositionM,bunchPositionM,
  nextBoundaryM,frontSpeedMps,bunchSpeedMps}){
  if(![frontPositionM,bunchPositionM,nextBoundaryM,
    frontSpeedMps,bunchSpeedMps].every(Number.isFinite)||
    !(bunchPositionM<frontPositionM&&frontPositionM<nextBoundaryM)||
    frontSpeedMps<=0||bunchSpeedMps<=0)
    throw new Error('Rear-catch follow-up needs ordered positive travel.');
  const arrivalSeconds=(nextBoundaryM-frontPositionM)/frontSpeedMps;
  const catchSeconds=bunchSpeedMps>frontSpeedMps?
    (frontPositionM-bunchPositionM)/
      (bunchSpeedMps-frontSpeedMps):Infinity;
  return catchSeconds<=arrivalSeconds?
    {kind:'front_bunch_contact_uncontinued',seconds:catchSeconds}:
    {kind:'front_at_next_boundary',seconds:arrivalSeconds};
}

// After the rear attacker physically rejoins the bunch, the selected chase
// and rotation hold their paid pace through this slice. Only the caught rider
// changes to sheltered work. Stop at the next boundary or earlier front catch.
export function recordFinaleConcurrentRearCatchFollowupFromTour(tour){
  const contact=recordFinaleConcurrentContactStateFromTour(tour);
  const before=recordFinaleConcurrentNextBoundaryFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  if(contact.event!=='second_attacker_bunch_contact_uncontinued'||
    before.event!==contact.event||
    contact.roadBands.length!==2||
    contact.roadBands[0].riderIds.length!==1||
    contact.roadBands[0].riderIds[0]!==before.firstRiderId)
    throw new Error('Rear-catch follow-up needs one front rider and a caught rear attacker.');
  const frontSpeedMps=before.riders.find(row=>
    row.riderId===before.firstRiderId).distanceM/
    before.elapsedSinceBunchSeconds;
  const bunchSpeedMps=plan.bunchSpeedKph/3.6;
  const event=rearCatchFollowupEvent({
    frontPositionM:before.firstPositionM,
    bunchPositionM:before.bunchPositionM,
    nextBoundaryM:plan.endDistanceM,
    frontSpeedMps,bunchSpeedMps});
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres.at(-1);
  const riders=before.riders.map(row=>{
    const front=row.riderId===before.firstRiderId;
    const caught=row.riderId===before.secondRiderId;
    const speedMps=front?frontSpeedMps:bunchSpeedMps;
    const distanceM=speedMps*event.seconds;
    const workCostPerKm=caught?
      TUNING.effortCost.conserve*riderKilometreEffect(
        ridersById.get(row.riderId),segment,{
          phase:'chase',energy:row.energyAtEvent,
          exposed:segment.exposed}).energyCostMultiplier:
      row.energySpent*1000/row.distanceM;
    const energySpent=workCostPerKm*distanceM/1000;
    if(!Number.isFinite(workCostPerKm)||workCostPerKm<0||
      energySpent>row.energyAtEvent+1e-9)
      throw new Error('Rear-catch continuation exceeds earned energy.');
    return {riderId:row.riderId,
      role:caught?'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtContact:row.energyAtEvent,
      distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===before.firstRiderId);
  const bunch=riders.filter(row=>row.riderId!==before.firstRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    event.kind==='front_at_next_boundary'&&
      Math.abs(front.positionM-plan.endDistanceM)>1e-8||
    event.kind==='front_bunch_contact_uncontinued'&&
      Math.abs(front.positionM-bunchPositionM)>1e-8||
    riders.length!==before.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Rear-catch continuation lost a road position.');
  const roadBands=event.kind==='front_at_next_boundary'?
    [{kind:'front',positionM:front.positionM,
      riderIds:[before.firstRiderId]},
    {kind:'bunch',positionM:bunchPositionM,
      riderIds:bunch.map(row=>row.riderId)}]:
    [{kind:'bunch',positionM:bunchPositionM,
      riderIds:riders.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_REAR_CATCH_FOLLOWUP_VERSION,
    sourceContactVersion:contact.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    event:event.kind,
    elapsedSinceContactSeconds:event.seconds,
    elapsedSinceLaunchSeconds:before.elapsedSinceLaunchSeconds+
      event.seconds,
    nextBoundaryM:plan.endDistanceM,
    frontRiderId:before.firstRiderId,
    caughtRiderId:before.secondRiderId,
    frontPositionM:front.positionM,bunchPositionM,
    roadBands,riders,riderAttackLoad:contact.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentRearCatchFollowupFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentRearCatchFollowupFromTour(tour)))
    throw new Error('Concurrent rear-catch follow-up does not replay.');
  return true;
}
