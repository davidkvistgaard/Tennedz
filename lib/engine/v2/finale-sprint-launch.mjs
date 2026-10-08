import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleSprintApproachFromTour,
  recordFinaleRotationCatchSprintApproachFromTour} from
  './finale-sprint-approach.mjs';
import {recordFinaleRotationCatchOrderedApproachFromTour} from
  './finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleSprintPlanFromTour,
  recordFinaleRotationCatchSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_SPRINT_LAUNCH_VERSION='v2-finale-sprint-launch-1';
export const FINALE_SPRINT_LAUNCH_FATIGUE_VERSION=
  'v2-finale-sprint-launch-2';
export const FINALE_ROTATION_CATCH_SPRINT_LAUNCH_VERSION=
  'v2-finale-rotation-catch-sprint-launch-3';
export const FINALE_ROTATION_CATCH_ORDERED_LAUNCH_VERSION=
  'v2-finale-rotation-catch-ordered-launch-4';
export const FINALE_SPRINT_WORK_COST_PER_KM=28;

// One simultaneous 100 m attempt from the recorded 300 m bunch state.
// A finisher moves ahead within the bunch only when their own sprint pace
// beats its passive pace. No road-group separation or placing is inferred.
export function recordFinaleSprintLaunchFromTour(tour,input,{
  version=FINALE_SPRINT_LAUNCH_VERSION}={}){
  if(![FINALE_SPRINT_LAUNCH_VERSION,
    FINALE_SPRINT_LAUNCH_FATIGUE_VERSION].includes(version))
    throw new Error('Unknown finale sprint launch version.');
  const approach=recordFinaleSprintApproachFromTour(tour,input);
  const plan=recordFinaleSprintPlanFromTour(tour,input);
  return recordSprintLaunch(tour,{approach,plan,version,
    bounded:version===FINALE_SPRINT_LAUNCH_FATIGUE_VERSION});
}

// Opt-in fatigue-bounded launch from the paid rotating-catch approach.
export function recordFinaleRotationCatchSprintLaunchFromTour(tour,input){
  const approach=recordFinaleRotationCatchSprintApproachFromTour(tour,input);
  const plan=recordFinaleRotationCatchSprintPlanFromTour(tour,input);
  const launch=recordSprintLaunch(tour,{approach,plan,
    version:FINALE_ROTATION_CATCH_SPRINT_LAUNCH_VERSION,bounded:true});
  return {...launch,
    sourceBunchElapsedSecondsAt300M:approach.bunchElapsedSecondsAt300M,
    bunchElapsedSecondsAt200M:approach.bunchElapsedSecondsAt300M+
      launch.bunchTravelSeconds};
}

// The current order-aware catch path keeps a nominated lead-out and any
// independent rotating front pair distinct before a fatigue-bounded launch.
export function recordFinaleRotationCatchOrderedLaunchFromTour(tour,input){
  const approach=recordFinaleRotationCatchOrderedApproachFromTour(tour,input);
  const plan=recordFinaleRotationCatchSprintPlanFromTour(tour,input);
  const launch=recordSprintLaunch(tour,{approach,plan,
    version:FINALE_ROTATION_CATCH_ORDERED_LAUNCH_VERSION,bounded:true});
  return {...launch,
    sourceBunchElapsedSecondsAt300M:approach.bunchElapsedSecondsAt300M,
    bunchElapsedSecondsAt200M:approach.bunchElapsedSecondsAt300M+
      launch.bunchTravelSeconds};
}

function recordSprintLaunch(tour,{approach,plan,version,bounded}){
  const route=tour.route,finishM=route.distanceKm*1000;
  const slice=finaleDistanceGrid(route,{remainingKm:1}).find(row=>
    row.startDistanceM===finishM-300);
  if(!slice||slice.lengthM!==100)
    throw new Error('The sprint launch needs a 100 m decision slice.');
  const ids=approach.frames.at(-1).pelotonRiderIds;
  const energies=new Map(approach.energyAt300M.map(row=>
    [row.riderId,row.energy]));
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const finishers=new Set(plan.decisions.map(row=>row.finisherId));
  const segment=route.kilometres.at(-1);
  const activeFinishers=!bounded?finishers:
    new Set([...finishers].filter(id=>{
      const energy=energies.get(id);
      const effect=riderKilometreEffect(ridersById.get(id),segment,{
        phase:'finale',energy,exposed:segment.exposed});
      return energyCostForFinaleSlice(slice,
        FINALE_SPRINT_WORK_COST_PER_KM*effect.energyCostMultiplier)<=
          energy+1e-9;
    }));
  const shelteredIds=ids.filter(id=>!activeFinishers.has(id));
  const bunchSpeedKph=finalePassiveBunchSpeed({riderIds:shelteredIds,
    ridersById,energies,segment});
  const bunchTravelSeconds=slice.lengthM*3.6/bunchSpeedKph;
  const riderEnergy=ids.map(riderId=>{
    const energyAtDecision=energies.get(riderId);
    const sprint=activeFinishers.has(riderId);
    const exhaustedSprint=finishers.has(riderId)&&!sprint;
    const effect=riderKilometreEffect(ridersById.get(riderId),segment,{
      phase:sprint?'finale':'chase',energy:energyAtDecision,
      exposed:segment.exposed});
    const workCostPerKm=sprint?FINALE_SPRINT_WORK_COST_PER_KM*
      effect.energyCostMultiplier:TUNING.effortCost.conserve*
        effect.energyCostMultiplier;
    const energySpent=energyCostForFinaleSlice(slice,workCostPerKm);
    if(energySpent>energyAtDecision+1e-9)
      throw new Error(`A sprint rider cannot pay for the launch: ${riderId}.`);
    let movementSeconds=bunchTravelSeconds;
    let attemptedMovementSeconds=bunchTravelSeconds;
    let effortAbilityPoints=null;
    if(sprint){
      effortAbilityPoints=TUNING.finish.finaleEffortAbilityPoints.hard*
        (bounded?
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy):1);
      const secondsPerKm=segmentBaseSeconds(segment)+
        (50-effect.ability-effortAbilityPoints)*
        TUNING.breakaway.driftSecondsPerAbilityPoint;
      if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
        throw new Error('The sprint rider has no finite launch pace.');
      attemptedMovementSeconds=secondsPerKm*slice.lengthM/1000;
      movementSeconds=Math.min(bunchTravelSeconds,
        attemptedMovementSeconds);
    }
    return {riderId,role:sprint?'sprint':exhaustedSprint?
      'exhausted_sprint':'sheltered',
      energyAtDecision,energySpent,
      energyAfter:Math.max(0,energyAtDecision-energySpent),
      movementSeconds,gainSeconds:bunchTravelSeconds-movementSeconds,
      ...(bounded?
        {attemptedMovementSeconds,effortAbilityPoints}:{})};
  });
  return {version,
    sourceApproachVersion:approach.version,
    sprintPlanVersion:plan.version,
    startDistanceM:slice.startDistanceM,endDistanceM:slice.endDistanceM,
    bunchSpeedKph,bunchTravelSeconds,
    pelotonRiderIds:[...ids],riderEnergy};
}

export function validateFinaleSprintLaunchFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleSprintLaunchFromTour(tour,input,{
      version:recorded?.version})))
    throw new Error('The finale sprint launch does not replay.');
  return true;
}

export function validateFinaleRotationCatchSprintLaunchFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationCatchSprintLaunchFromTour(tour,input)))
    throw new Error('The rotating-catch sprint launch does not replay.');
  return true;
}

export function validateFinaleRotationCatchOrderedLaunchFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationCatchOrderedLaunchFromTour(tour,input)))
    throw new Error('The ordered rotating-catch launch does not replay.');
  return true;
}
