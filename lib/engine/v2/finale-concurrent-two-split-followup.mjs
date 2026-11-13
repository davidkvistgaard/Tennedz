import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNextBoundaryFromTour} from
  './finale-concurrent-next-boundary.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_TWO_SPLIT_FOLLOWUP_VERSION=
  'v2-finale-concurrent-two-split-followup-1';

export function twoSplitFollowupEvent({firstPositionM,secondPositionM,
  bunchPositionM,firstNextBoundaryM,secondNextBoundaryM,
  bunchNextBoundaryM,firstSpeedMps,secondSpeedMps,bunchSpeedMps}){
  if(![firstPositionM,secondPositionM,bunchPositionM,
    firstNextBoundaryM,secondNextBoundaryM,bunchNextBoundaryM,
    firstSpeedMps,secondSpeedMps,bunchSpeedMps].every(Number.isFinite)||
    !(bunchPositionM<secondPositionM&&
      secondPositionM<firstPositionM&&
      Math.abs(firstPositionM-secondNextBoundaryM)<1e-8&&
      Math.abs(firstPositionM-bunchNextBoundaryM)<1e-8&&
      firstPositionM<firstNextBoundaryM)||
    firstSpeedMps<=0||secondSpeedMps<=0||bunchSpeedMps<=0)
    throw new Error('Two-split follow-up needs ordered positive travel.');
  const candidates=[
    {kind:'first_at_next_boundary',seconds:
      (firstNextBoundaryM-firstPositionM)/firstSpeedMps},
    {kind:'second_at_second_slice_boundary',seconds:
      (secondNextBoundaryM-secondPositionM)/secondSpeedMps},
    {kind:'bunch_at_second_slice_boundary',seconds:
      (bunchNextBoundaryM-bunchPositionM)/bunchSpeedMps}];
  if(secondSpeedMps>firstSpeedMps)candidates.push({
    kind:'attackers_contact_uncontinued',seconds:
      (firstPositionM-secondPositionM)/
        (secondSpeedMps-firstSpeedMps)});
  if(bunchSpeedMps>secondSpeedMps)candidates.push({
    kind:'second_attacker_bunch_contact_uncontinued',seconds:
      (secondPositionM-bunchPositionM)/
        (bunchSpeedMps-secondSpeedMps)});
  const earliest=Math.min(...candidates.map(row=>row.seconds));
  const tied=candidates.filter(row=>
    Math.abs(row.seconds-earliest)<1e-9);
  const contacts=tied.filter(row=>row.kind.includes('contact'));
  if(contacts.length===2)
    return {kind:'multiple_contacts_uncontinued',seconds:earliest};
  return {kind:(contacts[0]??tied[0]).kind,seconds:earliest};
}

// At the first rider's paid 500 m arrival, the two other road bands retain
// their already selected second-slice work. Only the first rider chooses the
// adjacent 100 m work. Charge everyone to the first boundary or intersection.
export function recordFinaleConcurrentTwoSplitFollowupFromTour(tour){
  const previous=recordFinaleConcurrentNextBoundaryFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[2];
  if(previous.event!=='first_attacker_at_next_boundary'||
    Math.abs(previous.firstPositionM-slice.startDistanceM)>1e-8||
    Math.abs(plan.endDistanceM-slice.startDistanceM)>1e-8||
    !(previous.firstPositionM>previous.secondPositionM&&
      previous.secondPositionM>previous.bunchPositionM))
    throw new Error('Two-split follow-up needs three paid road bands.');
  const teams=tour.committedInputs.teams;
  const team=teams.find(row=>row.riders.some(rider=>
    rider.id===previous.firstRiderId));
  const rider=team?.riders.find(row=>row.id===previous.firstRiderId);
  const priorFirst=previous.riders.find(row=>
    row.riderId===previous.firstRiderId);
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(team.orders,slice.sourceKm-1);
  const proposed=order.breakWork==='sit_on'||
    priorFirst.energyAtEvent<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,
      energy:priorFirst.energyAtEvent,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const worker=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=priorFirst.energyAtEvent+1e-9?
    proposed:null;
  const firstSpeedKph=worker?.speedKph??finalePassiveFrontSpeed({
    riderIds:[previous.firstRiderId],
    ridersById:new Map([[previous.firstRiderId,rider]]),
    energies:new Map([[previous.firstRiderId,priorFirst.energyAtEvent]]),
    segment});
  const firstCostPerKm=worker?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy:priorFirst.energyAtEvent,
      exposed:segment.exposed}).energyCostMultiplier;
  const priorSecond=previous.riders.find(row=>
    row.riderId===previous.secondRiderId);
  const secondSpeedMps=priorSecond.distanceM/
    previous.elapsedSinceBunchSeconds;
  const event=twoSplitFollowupEvent({
    firstPositionM:previous.firstPositionM,
    secondPositionM:previous.secondPositionM,
    bunchPositionM:previous.bunchPositionM,
    firstNextBoundaryM:slice.endDistanceM,
    secondNextBoundaryM:plan.endDistanceM,
    bunchNextBoundaryM:plan.endDistanceM,
    firstSpeedMps:firstSpeedKph/3.6,secondSpeedMps,
    bunchSpeedMps:plan.bunchSpeedKph/3.6});
  const riders=previous.riders.map(row=>{
    const first=row.riderId===previous.firstRiderId;
    const second=row.riderId===previous.secondRiderId;
    const speedMps=first?firstSpeedKph/3.6:
      second?secondSpeedMps:plan.bunchSpeedKph/3.6;
    const distanceM=speedMps*event.seconds;
    const costPerKm=first?firstCostPerKm:
      row.energySpent*1000/row.distanceM;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>
        (first?slice.endDistanceM:plan.endDistanceM)+1e-8)
      throw new Error('Two-split follow-up exceeds earned work or boundary.');
    return {riderId:row.riderId,
      role:first?worker?'front':'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtPreviousEvent:row.energyAtEvent,
      distanceM,energySpent,
      energyAtEvent:Math.max(0,row.energyAtEvent-energySpent)};
  });
  const first=riders.find(row=>row.riderId===previous.firstRiderId);
  const second=riders.find(row=>row.riderId===previous.secondRiderId);
  const bunch=riders.filter(row=>row.riderId!==previous.firstRiderId&&
    row.riderId!==previous.secondRiderId);
  const bunchPositionM=bunch[0].positionM;
  if(bunch.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    first.positionM+1e-8<second.positionM||
    second.positionM+1e-8<bunchPositionM||
    event.kind==='first_at_next_boundary'&&
      Math.abs(first.positionM-slice.endDistanceM)>1e-8||
    event.kind==='second_at_second_slice_boundary'&&
      Math.abs(second.positionM-plan.endDistanceM)>1e-8||
    event.kind==='bunch_at_second_slice_boundary'&&
      Math.abs(bunchPositionM-plan.endDistanceM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Two-split follow-up lost a road position.');
  const firstAndSecond=Math.abs(first.positionM-second.positionM)<1e-8;
  const secondAndBunch=Math.abs(second.positionM-bunchPositionM)<1e-8;
  const roadBands=firstAndSecond&&secondAndBunch?
    [{kind:'bunch',positionM:bunchPositionM,
      riderIds:riders.map(row=>row.riderId)}]:
    firstAndSecond?
      [{kind:'front',positionM:first.positionM,
        riderIds:[previous.firstRiderId,previous.secondRiderId]},
      {kind:'bunch',positionM:bunchPositionM,
        riderIds:bunch.map(row=>row.riderId)}]:
      secondAndBunch?
        [{kind:'front',positionM:first.positionM,
          riderIds:[previous.firstRiderId]},
        {kind:'bunch',positionM:bunchPositionM,
          riderIds:[previous.secondRiderId,...bunch.map(row=>row.riderId)]}]:
        [{kind:'front',positionM:first.positionM,
          riderIds:[previous.firstRiderId]},
        {kind:'rear_attack',positionM:second.positionM,
          riderIds:[previous.secondRiderId]},
        {kind:'bunch',positionM:bunchPositionM,
          riderIds:bunch.map(row=>row.riderId)}];
  if(event.kind.includes('contact')&&roadBands.length===3)
    throw new Error('Two-split contact lacks an exact intersection.');
  return {version:FINALE_CONCURRENT_TWO_SPLIT_FOLLOWUP_VERSION,
    sourcePreviousVersion:previous.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSincePreviousSeconds:event.seconds,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds+
      event.seconds,
    firstRiderId:previous.firstRiderId,
    secondRiderId:previous.secondRiderId,
    firstDecision:worker?'paid_pull':'passive',
    firstSpeedKph,firstCostPerKm,
    firstNextBoundaryM:slice.endDistanceM,
    secondNextBoundaryM:plan.endDistanceM,
    bunchNextBoundaryM:plan.endDistanceM,
    firstPositionM:first.positionM,
    secondPositionM:second.positionM,bunchPositionM,
    roadBands,riders,riderAttackLoad:previous.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentTwoSplitFollowupFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentTwoSplitFollowupFromTour(tour)))
    throw new Error('Concurrent two-split follow-up does not replay.');
  return true;
}
