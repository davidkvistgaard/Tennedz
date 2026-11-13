import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedAllChaseContactFromTour} from
  './finale-concurrent-named-all-chase-contact.mjs';
import {recordFinaleConcurrentChasedFollowupFromTour} from
  './finale-concurrent-chased-followup.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleMergedStep} from './finale-group-step.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_CHASED_CATCH_MERGE_VERSION=
  'v2-finale-concurrent-chased-catch-merge-1';

// Once the only surviving named attacker is caught, all riders complete the
// current slice in one passive bunch. The all-chase order has no front target.
export function recordFinaleConcurrentChasedCatchMergeFromTour(tour){
  const contact=recordFinaleConcurrentNamedAllChaseContactFromTour(tour);
  const followup=recordFinaleConcurrentChasedFollowupFromTour(tour);
  if(followup.outcome!=='caught_uncontinued'||
    followup.roadGroups.length||
    followup.pelotonRiderIds.length!==
      tour.committedInputs.teams.reduce((sum,team)=>
        sum+team.riders.length,0))
    throw new Error('Concurrent catch merge needs one complete caught bunch.');
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[1];
  const segment=tour.route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const atCatch=new Map(followup.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const travel=followup.endDistanceM===slice.endDistanceM?null:(()=>{
    const speedKph=finalePassiveBunchSpeed({
      riderIds:followup.pelotonRiderIds,
      ridersById,energies:atCatch,segment});
    return advanceFinaleMergedStep({slice,
      startDistanceM:followup.endDistanceM,
      riderIds:followup.pelotonRiderIds,
      pullRiderId:null,speedKph,passiveChase:true,
      riderPlans:followup.pelotonRiderIds.map(riderId=>({
        riderId,energy:atCatch.get(riderId),
        workCostPerKm:TUNING.effortCost.conserve*
          riderKilometreEffect(ridersById.get(riderId),segment,{
            phase:'chase',energy:atCatch.get(riderId),
            exposed:segment.exposed}).energyCostMultiplier}))});
  })();
  const after=new Map(travel?.riders.map(row=>
    [row.riderId,row])??[]);
  const riderEnergy=followup.riderEnergy.map(row=>{
    const continued=after.get(row.riderId);
    return {riderId:row.riderId,
      firstRole:row.role,
      energyAtSliceStart:row.energyAtDecision,
      energySpentBeforeCatch:row.energySpent,
      energyAtCatch:row.energyAfter,
      postCatchRole:'sheltered',
      postCatchEnergySpent:continued?.energySpent??0,
      energyAfter:continued?.energy??row.energyAfter};
  });
  const sliceElapsedSeconds=followup.bunchElapsedSeconds+
    (travel?.travelSeconds??0);
  return {version:FINALE_CONCURRENT_CHASED_CATCH_MERGE_VERSION,
    sourceContactVersion:contact.version,
    sourceFollowupVersion:followup.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:slice.startDistanceM,
    catchDistanceM:followup.catchDistanceM,
    endDistanceM:slice.endDistanceM,
    preCatch:followup,
    postCatchTravel:travel,
    sliceElapsedSeconds,
    elapsedSecondsFromLastKmStart:
      contact.bunchElapsedSeconds+sliceElapsedSeconds,
    pelotonRiderIds:followup.pelotonRiderIds,
    roadGroups:[],riderEnergy,
    riderAttackLoad:followup.riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentChasedCatchMergeFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentChasedCatchMergeFromTour(tour)))
    throw new Error('Concurrent chased catch merge does not replay.');
  return true;
}
