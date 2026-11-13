import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplitFollowupFromTour} from
  './finale-concurrent-two-split-followup.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_BUNCH_500_ARRIVAL_VERSION=
  'v2-finale-concurrent-bunch-500-arrival-1';

export function concurrentBunch500Event({firstPositionM,secondPositionM,
  bunchPositionM,firstNextBoundaryM,secondNextBoundaryM,
  bunchNextBoundaryM,firstSpeedMps,secondSpeedMps,bunchSpeedMps}){
  if(![firstPositionM,secondPositionM,bunchPositionM,
    firstNextBoundaryM,secondNextBoundaryM,bunchNextBoundaryM,
    firstSpeedMps,secondSpeedMps,bunchSpeedMps].every(Number.isFinite)||
    !(bunchPositionM<bunchNextBoundaryM&&
      Math.abs(secondPositionM-bunchNextBoundaryM)<1e-8&&
      secondPositionM<firstPositionM&&
      firstPositionM<firstNextBoundaryM&&
      Math.abs(firstNextBoundaryM-secondNextBoundaryM)<1e-8)||
    firstSpeedMps<=0||secondSpeedMps<=0||bunchSpeedMps<=0)
    throw new Error('Bunch-500 arrival needs ordered positive travel.');
  const candidates=[
    {kind:'first_at_next_boundary',seconds:
      (firstNextBoundaryM-firstPositionM)/firstSpeedMps},
    {kind:'second_at_next_boundary',seconds:
      (secondNextBoundaryM-secondPositionM)/secondSpeedMps},
    {kind:'bunch_at_500_boundary',seconds:
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

// The trailing attacker has just paid to 500 m. Give only that rider a new
// ordered 100 m pace; the leader and bunch retain their paid slice decisions.
// Stop at the first boundary or exact intersection before changing any work.
export function recordFinaleConcurrentBunch500ArrivalFromTour(tour){
  const previous=recordFinaleConcurrentTwoSplitFollowupFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[2];
  if(previous.event!=='second_at_second_slice_boundary'||
    previous.roadBands.length!==3||
    Math.abs(previous.secondPositionM-slice.startDistanceM)>1e-8||
    Math.abs(plan.endDistanceM-slice.startDistanceM)>1e-8)
    throw new Error('Bunch-500 arrival needs three paid road bands.');
  const teams=tour.committedInputs.teams;
  const team=teams.find(row=>row.riders.some(rider=>
    rider.id===previous.secondRiderId));
  const rider=team?.riders.find(row=>row.id===previous.secondRiderId);
  const priorSecond=previous.riders.find(row=>
    row.riderId===previous.secondRiderId);
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(team.orders,slice.sourceKm-1);
  const proposed=order.breakWork==='sit_on'||
    priorSecond.energyAtEvent<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,
      energy:priorSecond.energyAtEvent,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const worker=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=priorSecond.energyAtEvent+1e-9?
    proposed:null;
  const secondSpeedKph=worker?.speedKph??finalePassiveFrontSpeed({
    riderIds:[previous.secondRiderId],
    ridersById:new Map([[previous.secondRiderId,rider]]),
    energies:new Map([[previous.secondRiderId,priorSecond.energyAtEvent]]),
    segment});
  const secondCostPerKm=worker?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy:priorSecond.energyAtEvent,
      exposed:segment.exposed}).energyCostMultiplier;
  const event=concurrentBunch500Event({
    firstPositionM:previous.firstPositionM,
    secondPositionM:previous.secondPositionM,
    bunchPositionM:previous.bunchPositionM,
    firstNextBoundaryM:slice.endDistanceM,
    secondNextBoundaryM:slice.endDistanceM,
    bunchNextBoundaryM:plan.endDistanceM,
    firstSpeedMps:previous.firstSpeedKph/3.6,
    secondSpeedMps:secondSpeedKph/3.6,
    bunchSpeedMps:plan.bunchSpeedKph/3.6});
  const riders=previous.riders.map(row=>{
    const first=row.riderId===previous.firstRiderId;
    const second=row.riderId===previous.secondRiderId;
    const speedMps=first?previous.firstSpeedKph/3.6:
      second?secondSpeedKph/3.6:plan.bunchSpeedKph/3.6;
    const distanceM=speedMps*event.seconds;
    const costPerKm=second?secondCostPerKm:
      row.energySpent*1000/row.distanceM;
    const energySpent=costPerKm*distanceM/1000;
    if(!Number.isFinite(costPerKm)||costPerKm<0||
      energySpent>row.energyAtEvent+1e-9||
      row.positionM+distanceM>
        (first||second?slice.endDistanceM:plan.endDistanceM)+1e-8)
      throw new Error('Bunch-500 arrival exceeds earned work or boundary.');
    return {riderId:row.riderId,
      role:second?worker?'front':'sheltered':row.role,
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
    event.kind==='second_at_next_boundary'&&
      Math.abs(second.positionM-slice.endDistanceM)>1e-8||
    event.kind==='bunch_at_500_boundary'&&
      Math.abs(bunchPositionM-plan.endDistanceM)>1e-8||
    riders.length!==previous.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Bunch-500 arrival lost a road position.');
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
    throw new Error('Bunch-500 contact lacks an exact intersection.');
  return {version:FINALE_CONCURRENT_BUNCH_500_ARRIVAL_VERSION,
    sourcePreviousVersion:previous.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,event:event.kind,
    elapsedSincePreviousSeconds:event.seconds,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds+
      event.seconds,
    firstRiderId:previous.firstRiderId,
    secondRiderId:previous.secondRiderId,
    secondDecision:worker?'paid_pull':'passive',
    secondSpeedKph,secondCostPerKm,
    firstNextBoundaryM:slice.endDistanceM,
    secondNextBoundaryM:slice.endDistanceM,
    bunchNextBoundaryM:plan.endDistanceM,
    firstPositionM:first.positionM,
    secondPositionM:second.positionM,bunchPositionM,
    roadBands,riders,riderAttackLoad:previous.riderAttackLoad,
    draftStatus:'unresolved',resultStatus:'unclassified',
    pointsStatus:'withheld'};
}

export function validateFinaleConcurrentBunch500ArrivalFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentBunch500ArrivalFromTour(tour)))
    throw new Error('Concurrent bunch-500 arrival does not replay.');
  return true;
}
