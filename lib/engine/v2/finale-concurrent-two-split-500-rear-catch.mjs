import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplit500StepFromTour} from
  './finale-concurrent-two-split-500-step.mjs';
import {recordFinaleConcurrentSelective500PlanFromTour} from
  './finale-concurrent-selective-500-plan.mjs';
import {rearCatchFollowupEvent} from
  './finale-concurrent-rear-catch-followup.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_TWO_SPLIT_500_REAR_CATCH_VERSION=
  'v2-finale-concurrent-two-split-500-rear-catch-1';

// The rear attacker has met the bunch at an exact paid intersection. The
// leader and existing bunch workers retain their current affordable pace;
// only the caught rider changes to sheltered work for the remainder.
export function recordFinaleConcurrentTwoSplit500RearCatchFromTour(tour){
  const contact=recordFinaleConcurrentTwoSplit500StepFromTour(tour);
  const plan=recordFinaleConcurrentSelective500PlanFromTour(tour);
  if(contact.event!=='second_attacker_bunch_contact_uncontinued'||
    contact.roadBands.length!==2||
    contact.roadBands[0].riderIds.length!==1||
    contact.roadBands[0].riderIds[0]!==contact.frontRiderId||
    Math.abs(contact.rearPositionM-contact.bunchPositionM)>1e-8||
    !(contact.bunchPositionM<contact.frontPositionM&&
      contact.frontPositionM<plan.endDistanceM)||
    plan.chase?.riderId===contact.rearRiderId||
    contact.rotationRiderIds.includes(contact.rearRiderId))
    throw new Error('500 m rear catch needs one front rider and an exact rear-bunch contact.');
  const frontRow=contact.riders.find(row=>
    row.riderId===contact.frontRiderId);
  const frontSpeedMps=frontRow.distanceM/contact.elapsedSince500Seconds;
  const bunchSpeedMps=plan.bunchSpeedKph/3.6;
  const event=rearCatchFollowupEvent({
    frontPositionM:contact.frontPositionM,
    bunchPositionM:contact.bunchPositionM,
    nextBoundaryM:plan.endDistanceM,
    frontSpeedMps,bunchSpeedMps});
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres.at(-1);
  const riders=contact.riders.map(row=>{
    const front=row.riderId===contact.frontRiderId;
    const caught=row.riderId===contact.rearRiderId;
    const distanceM=(front?frontSpeedMps:bunchSpeedMps)*event.seconds;
    const costPerKm=caught?
      TUNING.effortCost.conserve*riderKilometreEffect(
        ridersById.get(row.riderId),segment,{
          phase:'chase',energy:row.energyAtEvent,
          exposed:segment.exposed}).energyCostMultiplier:
      row.energySpent*1000/row.distanceM;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>plan.endDistanceM+1e-8)
      throw new Error('500 m rear-catch continuation exceeds earned energy or boundary.');
    return {riderId:row.riderId,role:caught?'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtContact:row.energyAtEvent,distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===contact.frontRiderId);
  const bunch=riders.filter(row=>row.riderId!==contact.frontRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    event.kind==='front_at_next_boundary'&&
      Math.abs(front.positionM-plan.endDistanceM)>1e-8||
    event.kind==='front_bunch_contact_uncontinued'&&
      Math.abs(front.positionM-bunchPositionM)>1e-8||
    riders.length!==contact.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('500 m rear-catch continuation lost a road position.');
  const roadBands=event.kind==='front_at_next_boundary'?[{
    kind:'front',positionM:front.positionM,
    riderIds:[contact.frontRiderId]},
  {kind:'bunch',positionM:bunchPositionM,
    riderIds:bunch.map(row=>row.riderId)}]:[{
    kind:'bunch',positionM:bunchPositionM,
    riderIds:riders.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_TWO_SPLIT_500_REAR_CATCH_VERSION,
    sourceContactVersion:contact.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSinceContactSeconds:event.seconds,
    elapsedSinceLaunchSeconds:contact.elapsedSinceLaunchSeconds+
      event.seconds,
    nextBoundaryM:plan.endDistanceM,
    frontRiderId:contact.frontRiderId,
    caughtRiderId:contact.rearRiderId,
    frontPositionM:front.positionM,bunchPositionM,
    roadBands,riders,riderAttackLoad:contact.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentTwoSplit500RearCatchFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentTwoSplit500RearCatchFromTour(tour)))
    throw new Error('Concurrent two-split 500 m rear catch does not replay.');
  return true;
}
