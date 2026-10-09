import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentSelective500StateFromTour} from
  './finale-concurrent-selective-500-state.mjs';
import {recordFinaleConcurrentSelective500PlanFromTour} from
  './finale-concurrent-selective-500-plan.mjs';
import {recordFinaleConcurrentBunch500ArrivalFromTour} from
  './finale-concurrent-bunch-500-arrival.mjs';
import {concurrentContactRoadBands} from
  './finale-concurrent-contact-state.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_TWO_SPLIT_500_STEP_VERSION=
  'v2-finale-concurrent-two-split-500-step-1';

export function twoSplit500NextEvent({frontPositionM,rearPositionM,
  bunchPositionM,nextBoundaryM,frontSpeedMps,rearSpeedMps,
  bunchSpeedMps}){
  if(![frontPositionM,rearPositionM,bunchPositionM,nextBoundaryM,
    frontSpeedMps,rearSpeedMps,bunchSpeedMps].every(Number.isFinite)||
    !(bunchPositionM<rearPositionM&&rearPositionM<frontPositionM&&
      frontPositionM<nextBoundaryM)||
    Math.min(frontSpeedMps,rearSpeedMps,bunchSpeedMps)<=0)
    throw new Error('Two-split 500 m step needs ordered positive travel.');
  const candidates=[
    {kind:'front_at_400_boundary',seconds:
      (nextBoundaryM-frontPositionM)/frontSpeedMps},
    {kind:'rear_at_400_boundary',seconds:
      (nextBoundaryM-rearPositionM)/rearSpeedMps},
    {kind:'bunch_at_400_boundary',seconds:
      (nextBoundaryM-bunchPositionM)/bunchSpeedMps}];
  if(rearSpeedMps>frontSpeedMps)candidates.push({
    kind:'attackers_contact_uncontinued',seconds:
      (frontPositionM-rearPositionM)/(rearSpeedMps-frontSpeedMps)});
  if(bunchSpeedMps>rearSpeedMps)candidates.push({
    kind:'second_attacker_bunch_contact_uncontinued',seconds:
      (rearPositionM-bunchPositionM)/(bunchSpeedMps-rearSpeedMps)});
  const earliest=Math.min(...candidates.map(row=>row.seconds));
  const tied=candidates.filter(row=>
    Math.abs(row.seconds-earliest)<1e-9);
  const contacts=tied.filter(row=>row.kind.includes('contact'));
  return {kind:contacts.length===2?'multiple_contacts_uncontinued':
    (contacts[0]??tied[0]).kind,seconds:earliest};
}

// The two separated attackers retain their previously paid 100 m pace.
// The bunch alone starts its new selective chase and rotation. Stop before
// changing roles at a measured contact or at the first 400 m boundary.
export function recordFinaleConcurrentTwoSplit500StepFromTour(tour){
  const state=recordFinaleConcurrentSelective500StateFromTour(tour);
  const previous=recordFinaleConcurrentBunch500ArrivalFromTour(tour);
  const plan=recordFinaleConcurrentSelective500PlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[2];
  if(state.branch!=='two_split'||plan.branch!==state.branch||
    previous.event!=='bunch_at_500_boundary'||
    state.roadBands.length!==3||
    Math.abs(state.boundaryM-slice.startDistanceM)>1e-8||
    Math.abs(plan.startDistanceM-slice.startDistanceM)>1e-8)
    throw new Error('Two-split 500 m step needs three paid road bands.');
  const frontRow=previous.riders.find(row=>
    row.riderId===state.frontRiderId);
  const rearRow=previous.riders.find(row=>
    row.riderId===state.rearRiderId);
  const frontSpeedMps=frontRow.distanceM/
    previous.elapsedSincePreviousSeconds;
  const rearSpeedMps=previous.secondSpeedKph/3.6;
  const bunchSpeedMps=plan.bunchSpeedKph/3.6;
  const event=twoSplit500NextEvent({
    frontPositionM:frontRow.positionM,
    rearPositionM:rearRow.positionM,
    bunchPositionM:state.boundaryM,
    nextBoundaryM:slice.endDistanceM,
    frontSpeedMps,rearSpeedMps,bunchSpeedMps});
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const rotationWork=new Map(plan.rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  const riders=previous.riders.map(row=>{
    const front=row.riderId===state.frontRiderId;
    const rear=row.riderId===state.rearRiderId;
    const chaser=row.riderId===plan.chase?.riderId;
    const rotation=rotationWork.get(row.riderId);
    const speedMps=front?frontSpeedMps:
      rear?rearSpeedMps:bunchSpeedMps;
    const distanceM=speedMps*event.seconds;
    const costPerKm=front||rear?
      row.energySpent*1000/row.distanceM:
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
      throw new Error('Two-split 500 m step exceeds earned energy or boundary.');
    return {riderId:row.riderId,
      role:front||rear?row.role:chaser?'chase':
        rotation?'front_rotation':'sheltered',
      positionM:row.positionM+distanceM,
      energyAtDecision:row.energyAtEvent,
      distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const front=riders.find(row=>row.riderId===state.frontRiderId);
  const rear=riders.find(row=>row.riderId===state.rearRiderId);
  const bunch=riders.filter(row=>row.riderId!==state.frontRiderId&&
    row.riderId!==state.rearRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    front.positionM+1e-8<rear.positionM||
    rear.positionM+1e-8<bunchPositionM||
    event.kind==='front_at_400_boundary'&&
      Math.abs(front.positionM-slice.endDistanceM)>1e-8||
    event.kind==='rear_at_400_boundary'&&
      Math.abs(rear.positionM-slice.endDistanceM)>1e-8||
    event.kind==='bunch_at_400_boundary'&&
      Math.abs(bunchPositionM-slice.endDistanceM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Two-split 500 m step lost its physical road state.');
  const contact=event.kind.includes('contact');
  const roadBands=contact?concurrentContactRoadBands({
    event:event.kind,firstRiderId:state.frontRiderId,
    secondRiderId:state.rearRiderId,riders}):[
    {kind:'front',positionM:front.positionM,
      riderIds:[state.frontRiderId]},
    {kind:'rear_attack',positionM:rear.positionM,
      riderIds:[state.rearRiderId]},
    {kind:'bunch',positionM:bunchPositionM,
      riderIds:bunch.map(row=>row.riderId)}];
  return {version:FINALE_CONCURRENT_TWO_SPLIT_500_STEP_VERSION,
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
    frontRiderId:state.frontRiderId,rearRiderId:state.rearRiderId,
    frontPositionM:front.positionM,rearPositionM:rear.positionM,
    bunchPositionM,bunchSpeedKph:plan.bunchSpeedKph,
    chaseRiderId:plan.chase?.riderId??null,
    rotationRiderIds:plan.rotation.selected?.riderIds??[],
    roadBands,riders,riderAttackLoad:state.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentTwoSplit500StepFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentTwoSplit500StepFromTour(tour)))
    throw new Error('Concurrent two-split 500 m step does not replay.');
  return true;
}
