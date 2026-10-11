import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplit400StepFromTour} from
  './finale-concurrent-two-split-400-step.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_REAR_400_PLAN_VERSION=
  'v2-finale-concurrent-rear-400-plan-1';

// The rear attacker has reached 400 m on the paid common clock. Choose only
// that rider's next affordable work; the front and bunch retain their current
// decisions. No distance, energy or contact is inferred by this plan.
export function recordFinaleConcurrentRear400PlanFromTour(tour){
  const previous=recordFinaleConcurrentTwoSplit400StepFromTour(tour);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[3];
  if(previous.event!=='rear_at_400_boundary'||
    previous.roadBands.length!==3||
    previous.roadBands[0].kind!=='front'||
    previous.roadBands[1].kind!=='rear_attack'||
    previous.roadBands[2].kind!=='bunch'||
    previous.roadBands[0].riderIds.length!==1||
    previous.roadBands[1].riderIds.length!==1||
    previous.roadBands[0].riderIds[0]!==previous.frontRiderId||
    previous.roadBands[1].riderIds[0]!==previous.rearRiderId||
    Math.abs(previous.rearPositionM-slice.startDistanceM)>1e-8||
    !(previous.bunchPositionM<previous.rearPositionM&&
      previous.rearPositionM<previous.frontPositionM&&
      previous.frontPositionM<slice.endDistanceM))
    throw new Error('Rear-400 plan needs three paid, separated road bands.');
  const rearRow=previous.riders.find(row=>
    row.riderId===previous.rearRiderId);
  const team=tour.committedInputs.teams.find(row=>
    row.riders.some(candidate=>candidate.id===previous.rearRiderId));
  const rider=team?.riders.find(row=>row.id===previous.rearRiderId);
  if(!rearRow||!rider||
    previous.riders.length!==tour.committedInputs.teams
      .reduce((count,row)=>count+row.riders.length,0))
    throw new Error('Rear-400 plan lost its attacker or field.');
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(team.orders,slice.sourceKm-1);
  const energy=rearRow.energyAtEvent;
  const proposed=order.breakWork==='sit_on'||
    energy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,energy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const worker=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=energy+1e-9?proposed:null;
  const rearSpeedKph=worker?.speedKph??finalePassiveFrontSpeed({
    riderIds:[rider.id],ridersById:new Map([[rider.id,rider]]),
    energies:new Map([[rider.id,energy]]),segment});
  const rearCostPerKm=worker?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy,exposed:segment.exposed})
      .energyCostMultiplier;
  if(!Number.isFinite(rearSpeedKph)||rearSpeedKph<=0||
    !Number.isFinite(rearCostPerKm)||rearCostPerKm<0||
    energyCostForFinaleSlice(slice,rearCostPerKm)>energy+1e-9)
    throw new Error('Rear-400 plan has no affordable positive travel.');
  return {version:FINALE_CONCURRENT_REAR_400_PLAN_VERSION,
    sourcePreviousVersion:previous.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds,
    frontRiderId:previous.frontRiderId,
    rearRiderId:previous.rearRiderId,
    rearEnergyAtDecision:energy,
    rearDecision:worker?'paid_pull':'passive',
    rearSpeedKph,rearCostPerKm,
    roadBands:previous.roadBands.map(band=>({...band,
      riderIds:[...band.riderIds]})),
    riders:previous.riders.map(row=>({riderId:row.riderId,
      positionM:row.positionM,energyAtDecision:row.energyAtEvent})),
    riderAttackLoad:previous.riderAttackLoad,
    travelStatus:'planned_unpaid',draftStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentRear400PlanFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentRear400PlanFromTour(tour)))
    throw new Error('Concurrent rear-400 plan does not replay.');
  return true;
}
