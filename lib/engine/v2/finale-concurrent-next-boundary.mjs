import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentBunchArrivalFromTour,
  concurrentBunchArrivalEvent} from './finale-concurrent-bunch-arrival.mjs';
import {recordFinaleConcurrentSecondArrivalFromTour} from
  './finale-concurrent-second-arrival.mjs';
import {recordFinaleConcurrentNextSlicePlanFromTour} from
  './finale-concurrent-next-slice-plan.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NEXT_BOUNDARY_VERSION=
  'v2-finale-concurrent-next-boundary-1';

// First arrival at 500 m or the first exact intersection. The two attackers
// keep their already chosen second-slice pace/cost; the bunch uses the newly
// selected payable chase/rotation. Contact stops the trace without merging.
export function recordFinaleConcurrentNextBoundaryFromTour(tour){
  const state=recordFinaleConcurrentBunchArrivalFromTour(tour);
  const second=recordFinaleConcurrentSecondArrivalFromTour(tour);
  const plan=recordFinaleConcurrentNextSlicePlanFromTour(tour);
  if(state.event!=='bunch_at_first_slice_boundary'||
    plan.startDistanceM!==state.bunchPositionM)
    throw new Error('Next boundary needs the paid separated bunch state.');
  const firstSpeedMps=state.firstFrontSpeedKph/3.6;
  const secondSpeedMps=state.secondFrontSpeedKph/3.6;
  const bunchSpeedMps=plan.bunchSpeedKph/3.6;
  const firstArrivalSeconds=(plan.endDistanceM-state.firstPositionM)/
    firstSpeedMps;
  if(!Number.isFinite(firstArrivalSeconds)||firstArrivalSeconds<=0)
    throw new Error('The first attacker has no next boundary interval.');
  const event=concurrentBunchArrivalEvent({
    firstPositionM:state.firstPositionM,
    secondPositionM:state.secondPositionM,
    bunchPositionM:state.bunchPositionM,
    firstSpeedMps,secondSpeedMps,bunchSpeedMps,
    bunchArrivalSeconds:firstArrivalSeconds});
  const kind=event.kind==='bunch_at_first_slice_boundary'?
    'first_attacker_at_next_boundary':event.kind;
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const segment=tour.route.kilometres.at(-1);
  const rotationWork=new Map(plan.rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  const sliceLengthM=plan.endDistanceM-plan.startDistanceM;
  const riders=state.riders.map(row=>{
    const isFirst=row.riderId===state.firstRiderId;
    const isSecond=row.riderId===state.secondRiderId;
    const speedMps=isFirst?firstSpeedMps:isSecond?
      secondSpeedMps:bunchSpeedMps;
    const distanceM=speedMps*event.seconds;
    const positionM=row.positionM+distanceM;
    if(positionM>plan.endDistanceM+1e-8)
      throw new Error('A rider crossed an unrecorded next boundary.');
    const rotation=rotationWork.get(row.riderId);
    const chaser=row.riderId===plan.chase?.riderId;
    const workCostPerKm=isFirst?second.firstFrontWorkCostPerKm:
      isSecond?state.secondFrontWorkCostPerKm:
        chaser?plan.chase.workCostPerKm:
          rotation?rotation.energySpent*1000/sliceLengthM:
            TUNING.effortCost.conserve*riderKilometreEffect(
              ridersById.get(row.riderId),segment,{
                phase:'chase',energy:row.energyAtEvent,
                exposed:segment.exposed}).energyCostMultiplier;
    const energySpent=workCostPerKm*distanceM/1000;
    if(energySpent>row.energyAtEvent+1e-9||energySpent< -1e-9)
      throw new Error('Next-boundary travel exceeds earned rider energy.');
    return {riderId:row.riderId,
      role:isFirst||isSecond?row.role:chaser?'chase':
        rotation?'front_rotation':'sheltered',
      positionM,energyAtDecision:row.energyAtEvent,
      distanceM,energySpent,energyAtEvent:Math.max(0,
        row.energyAtEvent-energySpent)};
  });
  const byId=new Map(riders.map(row=>[row.riderId,row]));
  const firstPositionM=byId.get(state.firstRiderId).positionM;
  const secondPositionM=byId.get(state.secondRiderId).positionM;
  const bunchIds=riders.filter(row=>row.riderId!==state.firstRiderId&&
    row.riderId!==state.secondRiderId);
  const bunchPositionM=bunchIds[0]?.positionM;
  if(riders.length!==state.riders.length||
    byId.size!==state.riders.length||
    bunchIds.some(row=>Math.abs(row.positionM-bunchPositionM)>1e-8)||
    kind==='first_attacker_at_next_boundary'&&
      Math.abs(firstPositionM-plan.endDistanceM)>1e-8||
    kind==='attackers_contact_uncontinued'&&
      Math.abs(firstPositionM-secondPositionM)>1e-8||
    kind==='second_attacker_bunch_contact_uncontinued'&&
      Math.abs(secondPositionM-bunchPositionM)>1e-8||
    kind==='multiple_contacts_uncontinued'&&
      (Math.abs(firstPositionM-secondPositionM)>1e-8||
        Math.abs(secondPositionM-bunchPositionM)>1e-8))
    throw new Error('Next-boundary event lost its physical road state.');
  return {version:FINALE_CONCURRENT_NEXT_BOUNDARY_VERSION,
    sourceStateVersion:state.version,sourcePlanVersion:plan.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    event:kind,elapsedSinceBunchSeconds:event.seconds,
    elapsedSinceLaunchSeconds:state.elapsedSinceLaunchSeconds+
      event.seconds,
    firstRiderId:state.firstRiderId,
    secondRiderId:state.secondRiderId,
    firstPositionM,secondPositionM,bunchPositionM,
    plannedNextBoundaryM:plan.endDistanceM,
    contactPositionM:kind==='first_attacker_at_next_boundary'?null:
      kind==='second_attacker_bunch_contact_uncontinued'?
        secondPositionM:firstPositionM,
    bunchSpeedKph:plan.bunchSpeedKph,
    chaseRiderId:plan.chase?.riderId??null,
    rotationRiderIds:plan.rotation.selected?.riderIds??[],
    riders,riderAttackLoad:state.riderAttackLoad,
    roadRelationshipStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNextBoundaryFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNextBoundaryFromTour(tour)))
    throw new Error('Concurrent next boundary does not replay.');
  return true;
}
