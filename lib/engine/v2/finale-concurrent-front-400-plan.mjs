import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentTwoSplit500StepFromTour} from
  './finale-concurrent-two-split-500-step.mjs';
import {recordFinaleConcurrentTwoSplit500RearCatchFromTour} from
  './finale-concurrent-two-split-500-rear-catch.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_FRONT_400_PLAN_VERSION=
  'v2-finale-concurrent-front-400-plan-1';

// Only the front rider has reached 400 m. Select their next affordable
// ordered 100 m pace; the other road bands retain their already paid work.
// This is a decision, not a move or a new group/drafting rule.
export function recordFinaleConcurrentFront400PlanFromTour(tour){
  const step=recordFinaleConcurrentTwoSplit500StepFromTour(tour);
  const rearCaught=step.event===
    'second_attacker_bunch_contact_uncontinued';
  const previous=rearCaught?
    recordFinaleConcurrentTwoSplit500RearCatchFromTour(tour):step;
  const expectedEvent=rearCaught?'front_at_next_boundary':
    'front_at_400_boundary';
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[3];
  if(previous.event!==expectedEvent||
    ![2,3].includes(previous.roadBands.length)||
    previous.roadBands[0].kind!=='front'||
    previous.roadBands[0].riderIds.length!==1||
    previous.roadBands[0].riderIds[0]!==previous.frontRiderId||
    Math.abs(previous.frontPositionM-slice.startDistanceM)>1e-8||
    previous.roadBands.slice(1).some(band=>
      band.positionM>=slice.startDistanceM))
    throw new Error('Front-400 plan needs one separated paid front rider.');
  const frontRow=previous.riders.find(row=>
    row.riderId===previous.frontRiderId);
  const team=tour.committedInputs.teams.find(row=>
    row.riders.some(candidate=>candidate.id===previous.frontRiderId));
  const rider=team?.riders.find(row=>row.id===previous.frontRiderId);
  if(!frontRow||!rider||
    previous.riders.length!==tour.committedInputs.teams
      .reduce((count,row)=>count+row.riders.length,0))
    throw new Error('Front-400 plan lost its front rider or field.');
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(team.orders,slice.sourceKm-1);
  const energy=frontRow.energyAtEvent;
  const proposed=order.breakWork==='sit_on'||
    energy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,energy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const worker=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=energy+1e-9?proposed:null;
  const frontSpeedKph=worker?.speedKph??finalePassiveFrontSpeed({
    riderIds:[rider.id],ridersById:new Map([[rider.id,rider]]),
    energies:new Map([[rider.id,energy]]),segment});
  const frontCostPerKm=worker?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy,exposed:segment.exposed})
      .energyCostMultiplier;
  if(!Number.isFinite(frontSpeedKph)||frontSpeedKph<=0||
    !Number.isFinite(frontCostPerKm)||frontCostPerKm<0||
    energyCostForFinaleSlice(slice,frontCostPerKm)>energy+1e-9)
    throw new Error('Front-400 plan has no affordable positive travel.');
  return {version:FINALE_CONCURRENT_FRONT_400_PLAN_VERSION,
    sourcePreviousVersion:previous.version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    branch:rearCaught?'rear_caught':'two_split',
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    elapsedSinceLaunchSeconds:previous.elapsedSinceLaunchSeconds,
    frontRiderId:rider.id,frontEnergyAtDecision:energy,
    frontDecision:worker?'paid_pull':'passive',
    frontSpeedKph,frontCostPerKm,
    roadBands:previous.roadBands.map(band=>({...band,
      riderIds:[...band.riderIds]})),
    riders:previous.riders.map(row=>({riderId:row.riderId,
      positionM:row.positionM,energyAtDecision:row.energyAtEvent})),
    riderAttackLoad:previous.riderAttackLoad,
    travelStatus:'planned_unpaid',draftStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentFront400PlanFromTour(tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentFront400PlanFromTour(tour)))
    throw new Error('Concurrent front-400 plan does not replay.');
  return true;
}
