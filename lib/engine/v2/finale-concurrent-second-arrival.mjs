import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentCommonTimeStateFromTour} from
  './finale-concurrent-common-time-state.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finalePassiveFrontSpeed,finaleWorkerStep,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_SECOND_ARRIVAL_VERSION=
  'v2-finale-concurrent-second-arrival-1';

// Continue only until the later attacker reaches the first 250 m boundary.
// The earlier rider begins paying for the next grid slice; everyone else
// completes already-committed first-slice work. With positive forward speed,
// the later rider cannot catch the earlier one before reaching that boundary:
// the earlier rider starts there and keeps moving. This still grants neither
// a draft nor a shared group, and infers no proximity threshold.
export function recordFinaleConcurrentSecondArrivalFromTour(tour){
  const common=recordFinaleConcurrentCommonTimeStateFromTour(tour);
  const [first,second]=common.attackerPositions;
  const byId=new Map(common.riders.map(row=>[row.riderId,row]));
  const firstRow=byId.get(first.riderId);
  const secondRow=byId.get(second.riderId);
  const laterArrivalSeconds=secondRow.fullSliceSeconds;
  const remainingSeconds=laterArrivalSeconds-common.eventElapsedSeconds;
  if(!(first.positionM>second.positionM)||
    !(remainingSeconds>0))
    throw new Error('Second arrival needs distinct paid attacker arrivals.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[1];
  if(slice.startDistanceM!==common.plannedEndDistanceM)
    throw new Error('Second arrival needs the adjacent finale slice.');
  const teams=tour.committedInputs.teams;
  const firstTeam=teams.find(team=>team.riders.some(rider=>
    rider.id===first.riderId));
  const rider=firstTeam?.riders.find(row=>row.id===first.riderId);
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const order=orderAt(firstTeam.orders,slice.sourceKm-1);
  const energies=new Map(common.riders.map(row=>
    [row.riderId,row.energyAtEvent]));
  const proposed=order.breakWork==='sit_on'||
    firstRow.energyAtEvent<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider,segment,order,
      energy:firstRow.energyAtEvent,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const front=proposed&&energyCostForFinaleSlice(slice,
    proposed.workCostPerKm)<=firstRow.energyAtEvent+1e-9?
    proposed:null;
  const frontSpeedKph=front?.speedKph??finalePassiveFrontSpeed({
    riderIds:[first.riderId],ridersById:new Map([[first.riderId,rider]]),
    energies,segment});
  const frontWorkCostPerKm=front?.workCostPerKm??
    TUNING.effortCost.conserve*riderKilometreEffect(rider,segment,{
      phase:'chase',energy:firstRow.energyAtEvent,
      exposed:segment.exposed}).energyCostMultiplier;
  const firstSpeedMps=frontSpeedKph/3.6;
  const elapsedSinceFirstSeconds=remainingSeconds;
  const firstDistanceM=firstSpeedMps*elapsedSinceFirstSeconds;
  if(!(elapsedSinceFirstSeconds>0)||
    firstDistanceM>slice.lengthM+1e-9)
    throw new Error('Second arrival passes the next unscheduled boundary.');
  const riders=common.riders.map(row=>{
    if(row.riderId===first.riderId){
      const energySpentSinceFirst=frontWorkCostPerKm*firstDistanceM/1000;
      if(energySpentSinceFirst>row.energyAtEvent+1e-9)
        throw new Error('First attacker cannot pay to the next event.');
      return {riderId:row.riderId,role:front?'front':'sheltered',
        positionM:row.positionM+firstDistanceM,
        energyAtFirstEvent:row.energyAtEvent,
        energySpentSinceFirst,energyAtEvent:Math.max(0,
          row.energyAtEvent-energySpentSinceFirst),
        committedFirstSliceEnergyAfter:row.fullSliceEnergyAfter};
    }
    const fraction=(common.eventElapsedSeconds+
      elapsedSinceFirstSeconds)/row.fullSliceSeconds;
    if(fraction>1+1e-9)
      throw new Error('A rider passed the unscheduled launch boundary.');
    const positionM=common.startDistanceM+
      (common.plannedEndDistanceM-common.startDistanceM)*fraction;
    const energySpentSinceFirst=row.energyCostRemainingToBoundary*
      elapsedSinceFirstSeconds/
      (row.fullSliceSeconds-common.eventElapsedSeconds);
    if(energySpentSinceFirst>row.energyAtEvent+1e-9)
      throw new Error('A launch rider cannot pay to the next event.');
    return {riderId:row.riderId,role:row.role,
      positionM,energyAtFirstEvent:row.energyAtEvent,
      energySpentSinceFirst,energyAtEvent:Math.max(0,
        row.energyAtEvent-energySpentSinceFirst),
      committedFirstSliceEnergyAfter:row.fullSliceEnergyAfter};
  });
  const positions=new Map(riders.map(row=>[row.riderId,row.positionM]));
  const separationM=positions.get(first.riderId)-
    positions.get(second.riderId);
  if(!(separationM>0)||
    Math.abs(separationM-firstDistanceM)>1e-8||
    Math.abs(positions.get(second.riderId)-
      common.plannedEndDistanceM)>1e-8||
    riders.length!==common.riders.length||
    new Set(riders.map(row=>row.riderId)).size!==riders.length)
    throw new Error('Second arrival lost the shared road clock.');
  return {version:FINALE_CONCURRENT_SECOND_ARRIVAL_VERSION,
    sourceCommonVersion:common.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    event:'second_attacker_at_first_slice_boundary',
    elapsedSinceFirstSeconds,
    elapsedSinceLaunchSeconds:common.eventElapsedSeconds+
      elapsedSinceFirstSeconds,
    firstRiderId:first.riderId,secondRiderId:second.riderId,
    firstFrontDecision:front?'paid_pull':'passive',
    firstFrontSpeedKph:frontSpeedKph,
    firstFrontWorkCostPerKm:frontWorkCostPerKm,
    plannedFirstBoundaryM:common.plannedEndDistanceM,
    plannedNextBoundaryM:slice.endDistanceM,
    separationM,
    riders,riderAttackLoad:common.riderAttackLoad,
    roadRelationshipStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentSecondArrivalFromTour(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSecondArrivalFromTour(tour)))
    throw new Error('Concurrent second arrival does not replay.');
  return true;
}
