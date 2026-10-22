import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentCommonTimeStateFromTour} from
  './finale-concurrent-common-time-state.mjs';
import {recordFinaleConcurrentSecondArrivalFromTour} from
  './finale-concurrent-second-arrival.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_BUNCH_ARRIVAL_VERSION=
  'v2-finale-concurrent-bunch-arrival-1';

// Choose the first exact trajectory intersection before the bunch reaches
// the same 250 m boundary. A contact is an event at which this recording
// stops; it never grants drafting, a merged group or free remaining travel.
export function concurrentBunchArrivalEvent({firstPositionM,secondPositionM,
  bunchPositionM,firstSpeedMps,secondSpeedMps,bunchSpeedMps,
  bunchArrivalSeconds}){
  if(![firstPositionM,secondPositionM,bunchPositionM,
    firstSpeedMps,secondSpeedMps,bunchSpeedMps,bunchArrivalSeconds]
    .every(Number.isFinite)||
    !(firstPositionM>secondPositionM)||
    !(secondPositionM>bunchPositionM)||
    firstSpeedMps<=0||secondSpeedMps<=0||bunchSpeedMps<=0||
    bunchArrivalSeconds<=0)
    throw new Error('Concurrent arrival needs ordered positions and positive speeds.');
  const contacts=[];
  if(secondSpeedMps>firstSpeedMps)
    contacts.push({kind:'attackers_contact_uncontinued',
      seconds:(firstPositionM-secondPositionM)/
        (secondSpeedMps-firstSpeedMps)});
  if(bunchSpeedMps>secondSpeedMps)
    contacts.push({kind:'second_attacker_bunch_contact_uncontinued',
      seconds:(secondPositionM-bunchPositionM)/
        (bunchSpeedMps-secondSpeedMps)});
  contacts.sort((a,b)=>a.seconds-b.seconds||a.kind.localeCompare(b.kind));
  const earliest=contacts[0];
  if(!earliest||earliest.seconds>bunchArrivalSeconds)
    return {kind:'bunch_at_first_slice_boundary',
      seconds:bunchArrivalSeconds};
  const simultaneous=contacts.filter(row=>
    Math.abs(row.seconds-earliest.seconds)<1e-9);
  return {kind:simultaneous.length>1?
    'multiple_contacts_uncontinued':earliest.kind,
  seconds:earliest.seconds};
}

export function recordFinaleConcurrentBunchArrivalFromTour(tour){
  const common=recordFinaleConcurrentCommonTimeStateFromTour(tour);
  const second=recordFinaleConcurrentSecondArrivalFromTour(tour);
  const prior=new Map(second.riders.map(row=>[row.riderId,row]));
  const commonById=new Map(common.riders.map(row=>[row.riderId,row]));
  const first=prior.get(second.firstRiderId);
  const secondRider=prior.get(second.secondRiderId);
  const bunchRows=common.riders.filter(row=>row.role!=='attack');
  const bunchAtSecond=prior.get(bunchRows[0]?.riderId)?.positionM;
  const bunchFullSeconds=bunchRows[0]?.fullSliceSeconds;
  const remainingSeconds=bunchFullSeconds-second.elapsedSinceLaunchSeconds;
  if(!Number.isFinite(bunchAtSecond)||!(remainingSeconds>0)||
    bunchRows.some(row=>row.fullSliceSeconds!==bunchFullSeconds||
      Math.abs(prior.get(row.riderId)?.positionM-bunchAtSecond)>1e-8))
    throw new Error('Concurrent bunch arrival needs one paid launch bunch.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[1];
  if(slice.startDistanceM!==second.plannedFirstBoundaryM)
    throw new Error('Concurrent bunch arrival needs the adjacent slice.');
  const teams=tour.committedInputs.teams;
  const secondTeam=teams.find(team=>team.riders.some(rider=>
    rider.id===second.secondRiderId));
  const rider=secondTeam?.riders.find(row=>row.id===second.secondRiderId);
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(secondTeam.orders,slice.sourceKm-1);
  const energies=new Map([[second.secondRiderId,
    secondRider.energyAtEvent]]);
  const proposed=order.breakWork==='sit_on'||
    secondRider.energyAtEvent<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,
      energy:secondRider.energyAtEvent,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const front=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=secondRider.energyAtEvent+1e-9?
    proposed:null;
  const secondSpeedKph=front?.speedKph??finalePassiveFrontSpeed({
    riderIds:[second.secondRiderId],
    ridersById:new Map([[second.secondRiderId,rider]]),
    energies,segment});
  const secondWorkCostPerKm=front?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy:secondRider.energyAtEvent,
      exposed:segment.exposed}).energyCostMultiplier;
  const firstSpeedMps=second.firstFrontSpeedKph/3.6;
  const secondSpeedMps=secondSpeedKph/3.6;
  const bunchSpeedMps=(common.plannedEndDistanceM-
    common.startDistanceM)/bunchFullSeconds;
  const event=concurrentBunchArrivalEvent({
    firstPositionM:first.positionM,
    secondPositionM:secondRider.positionM,
    bunchPositionM:bunchAtSecond,
    firstSpeedMps,secondSpeedMps,bunchSpeedMps,
    bunchArrivalSeconds:remainingSeconds});
  const riders=second.riders.map(row=>{
    const fromCommon=commonById.get(row.riderId);
    const isFirst=row.riderId===second.firstRiderId;
    const isSecond=row.riderId===second.secondRiderId;
    const speedMps=isFirst?firstSpeedMps:isSecond?
      secondSpeedMps:bunchSpeedMps;
    const distanceM=speedMps*event.seconds;
    if((isFirst||isSecond)&&
      row.positionM+distanceM>slice.endDistanceM+1e-8)
      throw new Error('An attacker crossed an unscheduled grid boundary.');
    const energySpentSinceSecond=isFirst?
      second.firstFrontWorkCostPerKm*distanceM/1000:
      isSecond?secondWorkCostPerKm*distanceM/1000:
        (row.energyAtEvent-fromCommon.fullSliceEnergyAfter)*
          event.seconds/remainingSeconds;
    if(energySpentSinceSecond>row.energyAtEvent+1e-9||
      energySpentSinceSecond< -1e-9)
      throw new Error('Concurrent rider cannot pay to the bunch event.');
    return {riderId:row.riderId,
      role:isSecond?front?'front':'sheltered':row.role,
      positionM:row.positionM+distanceM,
      energyAtSecondEvent:row.energyAtEvent,
      energySpentSinceSecond,
      energyAtEvent:Math.max(0,
        row.energyAtEvent-energySpentSinceSecond),
      committedFirstSliceEnergyAfter:fromCommon.fullSliceEnergyAfter};
  });
  const positions=new Map(riders.map(row=>[row.riderId,row.positionM]));
  const firstPositionM=positions.get(second.firstRiderId);
  const secondPositionM=positions.get(second.secondRiderId);
  const bunchPositionM=positions.get(bunchRows[0].riderId);
  if(riders.length!==common.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length||
    bunchRows.some(row=>Math.abs(positions.get(row.riderId)-
      bunchPositionM)>1e-8)||
    event.kind==='bunch_at_first_slice_boundary'&&
      Math.abs(bunchPositionM-common.plannedEndDistanceM)>1e-8||
    event.kind==='attackers_contact_uncontinued'&&
      Math.abs(firstPositionM-secondPositionM)>1e-8||
    event.kind==='second_attacker_bunch_contact_uncontinued'&&
      Math.abs(secondPositionM-bunchPositionM)>1e-8||
    event.kind==='multiple_contacts_uncontinued'&&
      (Math.abs(firstPositionM-secondPositionM)>1e-8||
        Math.abs(secondPositionM-bunchPositionM)>1e-8))
    throw new Error('Concurrent bunch event lost its paid positions.');
  return {version:FINALE_CONCURRENT_BUNCH_ARRIVAL_VERSION,
    sourceSecondVersion:second.version,
    sourceCommonVersion:common.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    event:event.kind,
    elapsedSinceSecondSeconds:event.seconds,
    elapsedSinceLaunchSeconds:second.elapsedSinceLaunchSeconds+event.seconds,
    firstRiderId:second.firstRiderId,
    secondRiderId:second.secondRiderId,
    secondFrontDecision:front?'paid_pull':'passive',
    secondFrontSpeedKph:secondSpeedKph,
    secondFrontWorkCostPerKm:secondWorkCostPerKm,
    firstFrontDecision:second.firstFrontDecision,
    firstFrontSpeedKph:second.firstFrontSpeedKph,
    plannedFirstBoundaryM:second.plannedFirstBoundaryM,
    plannedNextBoundaryM:slice.endDistanceM,
    firstPositionM,secondPositionM,bunchPositionM,
    contactPositionM:event.kind==='bunch_at_first_slice_boundary'?null:
      event.kind==='second_attacker_bunch_contact_uncontinued'?
        secondPositionM:firstPositionM,
    riders,riderAttackLoad:second.riderAttackLoad,
    roadRelationshipStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentBunchArrivalFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentBunchArrivalFromTour(tour)))
    throw new Error('Concurrent bunch arrival does not replay.');
  return true;
}
