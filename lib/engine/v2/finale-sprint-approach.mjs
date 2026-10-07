import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {probeLastKmNamedAttackRoadFromTour} from
  './finale-last-km-named-attack.mjs';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {recordFinaleSprintPlanFromTour,
  recordFinaleRotationCatchSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_SPRINT_APPROACH_VERSION=
  'v2-finale-sprint-approach-1';
export const FINALE_ROTATION_CATCH_SPRINT_APPROACH_VERSION=
  'v2-finale-rotation-catch-sprint-approach-2';

// Two 100 m slices from 500 to 300 m in an already reunited bunch. Nominated
// lead-out riders pay their recorded work rate; everyone else pays sheltered
// travel. The field keeps its passive pace until a positional benefit exists.
export function recordFinaleSprintApproachFromTour(tour,input){
  const plan=recordFinaleSprintPlanFromTour(tour,input);
  const road=probeLastKmNamedAttackRoadFromTour(tour,{
    teamId:input.attackTeamId});
  const finishM=tour.route.distanceKm*1000;
  const source=road.frames.find(frame=>frame.endDistanceM===finishM-500);
  return recordSprintApproach(tour,{plan,source,
    version:FINALE_SPRINT_APPROACH_VERSION,
    sourceRoadTraceVersion:road.version});
}

// This opt-in path carries the actual rotating-catch energy and elapsed time.
// Paid lead-out work is still not a position or speed benefit.
export function recordFinaleRotationCatchSprintApproachFromTour(tour,input){
  const plan=recordFinaleRotationCatchSprintPlanFromTour(tour,input);
  const road=probeLastKmRotationCatchFromTour(tour,{
    teamId:input.attackTeamId});
  const source={roadGroups:road.at500M.roadGroups,
    pelotonRiderIds:road.at500M.pelotonRiderIds,
    riderEnergy:road.at500M.riderEnergy.map(row=>({
      riderId:row.riderId,energyAfter:row.energy}))};
  const approach=recordSprintApproach(tour,{plan,source,
    version:FINALE_ROTATION_CATCH_SPRINT_APPROACH_VERSION,
    sourceRoadTraceVersion:road.version});
  return {...approach,
    sourceBunchElapsedSeconds:road.at500M.bunchElapsedSeconds,
    bunchElapsedSecondsAt300M:road.at500M.bunchElapsedSeconds+
      approach.frames.reduce((sum,frame)=>
        sum+frame.bunchElapsedSeconds,0)};
}

function recordSprintApproach(tour,{plan,source,version,
  sourceRoadTraceVersion}){
  const finishM=tour.route.distanceKm*1000;
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const ids=source?.pelotonRiderIds;
  if(!source||source.roadGroups.length||ids.length!==ridersById.size||
    new Set(ids).size!==ids.length)
    throw new Error('A lead-out approach needs one reunited complete bunch at 500 m.');
  const helpers=new Map(plan.decisions.filter(row=>row.leadOutRiderId)
    .map(row=>[row.leadOutRiderId,row.leadOutWorkCostPerKm]));
  const segment=tour.route.kilometres.at(-1);
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1});
  const slices=grid.filter(slice=>slice.startDistanceM>=finishM-500&&
    slice.endDistanceM<=finishM-300);
  if(slices.length!==2)
    throw new Error('The lead-out approach needs two 100 m slices.');
  let energies=new Map(source.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  const frames=slices.map(slice=>{
    const speedKph=finalePassiveBunchSpeed({riderIds:ids,
      ridersById,energies,segment});
    const riderEnergy=ids.map(riderId=>{
      const energyAtDecision=energies.get(riderId);
      const workCostPerKm=helpers.get(riderId)??
        TUNING.effortCost.conserve*riderKilometreEffect(
          ridersById.get(riderId),segment,{phase:'chase',
            energy:energyAtDecision,
            exposed:segment.exposed}).energyCostMultiplier;
      const energySpent=energyCostForFinaleSlice(slice,workCostPerKm);
      if(energySpent>energyAtDecision+1e-9)
        throw new Error(`A lead-out rider cannot pay for the next slice: ${riderId}.`);
      return {riderId,role:helpers.has(riderId)?'lead_out':'sheltered',
        energyAtDecision,energySpent,
        energyAfter:Math.max(0,energyAtDecision-energySpent)};
    });
    energies=new Map(riderEnergy.map(row=>[row.riderId,row.energyAfter]));
    return {startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,sourceKm:slice.sourceKm,
      paceSource:'passive_bunch',bunchSpeedKph:speedKph,
      bunchElapsedSeconds:slice.lengthM*3.6/speedKph,
      pelotonRiderIds:[...ids],riderEnergy};
  });
  return {version,
    sourceRoadTraceVersion,
    sprintPlanVersion:plan.version,
    startDistanceM:finishM-500,endDistanceM:finishM-300,
    frames,energyAt300M:frames.at(-1).riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter}))};
}

export function validateFinaleSprintApproachFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleSprintApproachFromTour(tour,input)))
    throw new Error('The finale sprint approach does not replay.');
  return true;
}

export function validateFinaleRotationCatchSprintApproachFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationCatchSprintApproachFromTour(tour,input)))
    throw new Error('The rotating-catch sprint approach does not replay.');
  return true;
}
