import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ROTATION_CATCH_ORDERED_APPROACH_VERSION=
  'v2-finale-rotation-catch-ordered-approach-3';

// The more specific sprint nomination takes precedence over a team's own
// front-rotation order. All other rotating teams remain eligible and pay.
// A lead-out worker cannot be charged as a front worker in the same slice.
export function recordFinaleRotationCatchOrderedApproachFromTour(tour,input){
  const road=probeLastKmRotationCatchFromTour(tour,{
    teamId:input.attackTeamId});
  const plan=recordFinaleRotationCatchSprintPlanFromTour(tour,input);
  const finishM=tour.route.distanceKm*1000;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1})
    .filter(slice=>slice.startDistanceM>=finishM-500&&
      slice.endDistanceM<=finishM-300);
  if(slices.length!==2||slices.some(slice=>slice.lengthM!==100))
    throw new Error('The ordered approach needs two adjacent 100 m slices.');
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const ids=road.at500M.pelotonRiderIds;
  const helpers=new Map(plan.decisions.filter(row=>row.leadOutRiderId)
    .map(row=>[row.leadOutRiderId,row.leadOutWorkCostPerKm]));
  const busyTeamIds=plan.decisions.filter(row=>row.leadOutRiderId)
    .map(row=>row.teamId);
  const segment=tour.route.kilometres.at(-1);
  let energies=new Map(road.at500M.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  const frames=slices.map(slice=>{
    const supersededRotationTeamIds=busyTeamIds.filter(teamId=>
      orderAt(teams.find(team=>team.id===teamId).orders,
        slice.sourceKm-1).frontWork==='rotate');
    const rotation=recordFinaleFrontRotationSlice({slice,
      route:tour.route,teams,pelotonRiderIds:ids,energies,busyTeamIds});
    const workers=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    if([...helpers.keys()].some(id=>workers.has(id)))
      throw new Error('A lead-out rider cannot rotate in the same slice.');
    const riderEnergy=ids.map(riderId=>{
      const energyAtDecision=energies.get(riderId);
      const role=helpers.has(riderId)?'lead_out':
        workers.has(riderId)?'front_rotation':'sheltered';
      const energySpent=role==='lead_out'?
        energyCostForFinaleSlice(slice,helpers.get(riderId)):
        role==='front_rotation'?workers.get(riderId).energySpent:
          energyCostForFinaleSlice(slice,TUNING.effortCost.conserve*
            riderKilometreEffect(ridersById.get(riderId),segment,{
              phase:'chase',energy:energyAtDecision,
              exposed:segment.exposed}).energyCostMultiplier);
      if(energySpent>energyAtDecision+1e-9)
        throw new Error(`An ordered approach rider cannot pay: ${riderId}.`);
      return {riderId,role,energyAtDecision,energySpent,
        energyAfter:Math.max(0,energyAtDecision-energySpent)};
    });
    energies=new Map(riderEnergy.map(row=>[row.riderId,row.energyAfter]));
    return {startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,sourceKm:slice.sourceKm,
      supersededRotationTeamIds,rotation,
      paceSource:rotation.selected&&
        rotation.selected.speedKph>rotation.passiveBunchSpeedKph?
          'front_rotation':'passive_bunch',
      bunchSpeedKph:rotation.bunchSpeedKph,
      bunchElapsedSeconds:slice.lengthM*3.6/rotation.bunchSpeedKph,
      pelotonRiderIds:[...ids],riderEnergy};
  });
  return {version:FINALE_ROTATION_CATCH_ORDERED_APPROACH_VERSION,
    sourceRoadTraceVersion:road.version,sprintPlanVersion:plan.version,
    startDistanceM:finishM-500,endDistanceM:finishM-300,
    sourceBunchElapsedSeconds:road.at500M.bunchElapsedSeconds,
    frames,energyAt300M:frames.at(-1).riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter})),
    bunchElapsedSecondsAt300M:road.at500M.bunchElapsedSeconds+
      frames.reduce((sum,frame)=>sum+frame.bunchElapsedSeconds,0)};
}

export function validateFinaleRotationCatchOrderedApproachFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationCatchOrderedApproachFromTour(tour,input)))
    throw new Error('The ordered rotating-catch approach does not replay.');
  return true;
}
