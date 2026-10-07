import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleSprintLaunchFromTour,
  FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {recordFinaleSprintPlanFromTour} from './finale-sprint-plan.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_SPRINT_RUN_VERSION='v2-finale-sprint-run-1';

// Keep the first paid 100 m launch as an immutable, replayed source. The
// following two slices carry its earned time lead, spending current energy
// again. A slower rider can lose that lead and rejoin passive bunch pace.
export function recordFinaleSprintRunFromTour(tour,input){
  const launch=recordFinaleSprintLaunchFromTour(tour,input);
  const plan=recordFinaleSprintPlanFromTour(tour,input);
  const ids=launch.pelotonRiderIds;
  const finishers=new Set(plan.decisions.map(row=>row.finisherId));
  const shelteredIds=ids.filter(id=>!finishers.has(id));
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const segment=tour.route.kilometres.at(-1);
  const finishM=tour.route.distanceKm*1000;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1}).filter(slice=>
    slice.startDistanceM>=finishM-200);
  if(slices.length!==2||slices.some(slice=>slice.lengthM!==100)||
    slices[0].startDistanceM!==launch.endDistanceM||
    slices.at(-1).endDistanceM!==finishM)
    throw new Error('The sprint needs two adjacent 100 m finish slices.');
  let previous=new Map(launch.riderEnergy.map(row=>[row.riderId,row]));
  const frames=slices.map(slice=>{
    const energies=new Map(ids.map(id=>[id,
      previous.get(id).energyAfter]));
    const bunchSpeedKph=finalePassiveBunchSpeed({
      riderIds:shelteredIds,ridersById,energies,segment});
    const bunchTravelSeconds=slice.lengthM*3.6/bunchSpeedKph;
    const riderEnergy=ids.map(riderId=>{
      const earlier=previous.get(riderId);
      const energyAtDecision=earlier.energyAfter;
      const sprint=finishers.has(riderId);
      const effect=riderKilometreEffect(ridersById.get(riderId),segment,{
        phase:sprint?'finale':'chase',energy:energyAtDecision,
        exposed:segment.exposed});
      const workCostPerKm=(sprint?FINALE_SPRINT_WORK_COST_PER_KM:
        TUNING.effortCost.conserve)*effect.energyCostMultiplier;
      const energySpent=energyCostForFinaleSlice(slice,workCostPerKm);
      if(energySpent>energyAtDecision+1e-9)
        throw new Error(`A sprint rider cannot pay for the next slice: ${riderId}.`);
      let movementSeconds=bunchTravelSeconds;
      let gainSeconds=0;
      if(sprint){
        const secondsPerKm=segmentBaseSeconds(segment)+
          (50-effect.ability-TUNING.finish.finaleEffortAbilityPoints.hard)*
          TUNING.breakaway.driftSecondsPerAbilityPoint;
        if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
          throw new Error('The sprint rider has no finite finish pace.');
        const attemptedSeconds=secondsPerKm*slice.lengthM/1000;
        movementSeconds=Math.min(attemptedSeconds,
          bunchTravelSeconds+earlier.gainSeconds);
        gainSeconds=Math.max(0,
          earlier.gainSeconds+bunchTravelSeconds-attemptedSeconds);
      }
      return {riderId,role:sprint?'sprint':'sheltered',
        energyAtDecision,energySpent,
        energyAfter:Math.max(0,energyAtDecision-energySpent),
        movementSeconds,gainSeconds};
    });
    previous=new Map(riderEnergy.map(row=>[row.riderId,row]));
    return {startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,bunchSpeedKph,
      bunchTravelSeconds,pelotonRiderIds:[...ids],riderEnergy};
  });
  return {version:FINALE_SPRINT_RUN_VERSION,
    sourceLaunchVersion:launch.version,
    sprintPlanVersion:plan.version,
    startDistanceM:launch.startDistanceM,endDistanceM:finishM,
    launch,frames,
    lineRiderEnergy:frames.at(-1).riderEnergy.map(row=>({
      riderId:row.riderId,energyAfter:row.energyAfter,
      gainSeconds:row.gainSeconds}))};
}

export function validateFinaleSprintRunFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,recordFinaleSprintRunFromTour(tour,input)))
    throw new Error('The finale sprint run does not replay.');
  return true;
}
