import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {recordFinaleRotationCatchOrderedApproachFromTour,
  recordFinaleRotationContainedOrderedApproachFromTour} from
  './finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationContainedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ROTATION_CATCH_ORDERED_SPRINT_VERSION=
  'v2-finale-rotation-catch-ordered-sprint-5';
export const FINALE_ROTATION_CONTAINED_ORDERED_SPRINT_VERSION=
  'v2-finale-rotation-contained-ordered-sprint-6';

// A separate candidate for the last three 100 m slices. A specific lead-out
// nomination retains precedence over its team's rotation; another team may
// still rotate while its distinct finisher sprints. No within-bunch order is
// inferred from a rider's calculated movement advantage.
export function recordFinaleRotationCatchOrderedSprintFromTour(tour,input){
  const approach=recordFinaleRotationCatchOrderedApproachFromTour(tour,input);
  const plan=recordFinaleRotationCatchSprintPlanFromTour(tour,input);
  return recordOrderedSprint(tour,{approach,plan,
    version:FINALE_ROTATION_CATCH_ORDERED_SPRINT_VERSION});
}

export function recordFinaleRotationContainedOrderedSprintFromTour(
  tour,input){
  const approach=recordFinaleRotationContainedOrderedApproachFromTour(
    tour,input);
  const plan=recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  return recordOrderedSprint(tour,{approach,plan,
    version:FINALE_ROTATION_CONTAINED_ORDERED_SPRINT_VERSION});
}

function recordOrderedSprint(tour,{approach,plan,version}){
  const teams=tour.committedInputs.teams;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const finishM=tour.route.distanceKm*1000;
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1}).filter(slice=>
    slice.startDistanceM>=finishM-300);
  if(slices.length!==3||slices.some(slice=>slice.lengthM!==100)||
    slices[0].startDistanceM!==approach.endDistanceM||
    slices.at(-1).endDistanceM!==finishM)
    throw new Error('The ordered sprint needs three adjacent 100 m slices.');
  const ids=approach.frames.at(-1).pelotonRiderIds;
  const finishers=new Set(plan.decisions.map(row=>row.finisherId));
  const busyTeamIds=plan.decisions.filter(row=>
    row.leadOutRiderId||teams.find(team=>team.id===row.teamId)
      .orders.helperIds.includes(row.finisherId)).map(row=>row.teamId);
  const segment=tour.route.kilometres.at(-1);
  let previous=new Map(approach.energyAt300M.map(row=>
    [row.riderId,{energyAfter:row.energy,gainSeconds:0}]));
  const frames=slices.map(slice=>{
    const energies=new Map(ids.map(id=>[id,previous.get(id).energyAfter]));
    const supersededRotationTeamIds=busyTeamIds.filter(teamId=>
      orderAt(teams.find(team=>team.id===teamId).orders,
        slice.sourceKm-1).frontWork==='rotate');
    const rotation=recordFinaleFrontRotationSlice({slice,route:tour.route,
      teams,pelotonRiderIds:ids,energies,busyTeamIds});
    const workers=new Map(rotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    if([...finishers].some(id=>workers.has(id)))
      throw new Error('A sprint finisher cannot rotate in the same slice.');
    const activeFinishers=new Set([...finishers].filter(id=>{
      const energy=energies.get(id);
      const effect=riderKilometreEffect(ridersById.get(id),segment,{
        phase:'finale',energy,exposed:segment.exposed});
      const affordable=energyCostForFinaleSlice(slice,
        FINALE_SPRINT_WORK_COST_PER_KM*effect.energyCostMultiplier)<=
          energy+1e-9;
      if(!affordable&&previous.get(id).gainSeconds>0)
        throw new Error(`A leading sprint rider needs an exposed coast rule: ${id}.`);
      return affordable;
    }));
    const shelteredIds=ids.filter(id=>!activeFinishers.has(id));
    const passiveBunchSpeedKph=finalePassiveBunchSpeed({
      riderIds:shelteredIds,ridersById,energies,segment});
    const bunchSpeedKph=Math.max(passiveBunchSpeedKph,
      rotation.selected?.speedKph??0);
    const bunchTravelSeconds=slice.lengthM*3.6/bunchSpeedKph;
    const riderEnergy=ids.map(riderId=>{
      const earlier=previous.get(riderId);
      const energyAtDecision=energies.get(riderId);
      const sprint=activeFinishers.has(riderId);
      const role=sprint?'sprint':workers.has(riderId)?
        'front_rotation':finishers.has(riderId)?
          'exhausted_sprint':'sheltered';
      const effect=riderKilometreEffect(ridersById.get(riderId),segment,{
        phase:sprint?'finale':'chase',energy:energyAtDecision,
        exposed:segment.exposed});
      const energySpent=role==='front_rotation'?
        workers.get(riderId).energySpent:
        energyCostForFinaleSlice(slice,
          (sprint?FINALE_SPRINT_WORK_COST_PER_KM:
            TUNING.effortCost.conserve)*effect.energyCostMultiplier);
      if(energySpent>energyAtDecision+1e-9)
        throw new Error(`An ordered sprint rider cannot pay: ${riderId}.`);
      let attemptedMovementSeconds=bunchTravelSeconds;
      let gainSeconds=0;
      let effortAbilityPoints=null;
      if(sprint){
        effortAbilityPoints=TUNING.finish.finaleEffortAbilityPoints.hard*
          Math.min(1,energyAtDecision/TUNING.finish.fullEffortEnergy);
        const secondsPerKm=segmentBaseSeconds(segment)+
          (50-effect.ability-effortAbilityPoints)*
          TUNING.breakaway.driftSecondsPerAbilityPoint;
        if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
          throw new Error('The sprint rider has no finite finish pace.');
        attemptedMovementSeconds=secondsPerKm*slice.lengthM/1000;
        gainSeconds=Math.max(0,earlier.gainSeconds+
          bunchTravelSeconds-attemptedMovementSeconds);
      }
      return {riderId,role,energyAtDecision,energySpent,
        energyAfter:Math.max(0,energyAtDecision-energySpent),
        attemptedMovementSeconds,effortAbilityPoints,
        movementSeconds:sprint?
          Math.min(attemptedMovementSeconds,
            bunchTravelSeconds+earlier.gainSeconds):bunchTravelSeconds,
        gainSeconds};
    });
    previous=new Map(riderEnergy.map(row=>[row.riderId,row]));
    return {startDistanceM:slice.startDistanceM,
      endDistanceM:slice.endDistanceM,sourceKm:slice.sourceKm,
      supersededRotationTeamIds,rotation,
      paceSource:rotation.selected&&
        rotation.selected.speedKph>passiveBunchSpeedKph?
          'front_rotation':'passive_bunch',
      passiveBunchSpeedKph,bunchSpeedKph,bunchTravelSeconds,
      pelotonRiderIds:[...ids],riderEnergy};
  });
  return {version,
    sourceApproachVersion:approach.version,sprintPlanVersion:plan.version,
    startDistanceM:approach.endDistanceM,endDistanceM:finishM,
    sourceBunchElapsedSecondsAt300M:approach.bunchElapsedSecondsAt300M,
    busyTeamIds,frames,
    bunchElapsedSecondsAtLine:approach.bunchElapsedSecondsAt300M+
      frames.reduce((sum,frame)=>sum+frame.bunchTravelSeconds,0),
    lineRiderEnergy:frames.at(-1).riderEnergy.map(row=>({
      riderId:row.riderId,energyAfter:row.energyAfter,
      gainSeconds:row.gainSeconds}))};
}

export function validateFinaleRotationContainedOrderedSprintFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationContainedOrderedSprintFromTour(tour,input)))
    throw new Error('The contained ordered sprint does not replay.');
  return true;
}

export function validateFinaleRotationCatchOrderedSprintFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationCatchOrderedSprintFromTour(tour,input)))
    throw new Error('The ordered rotating-catch sprint does not replay.');
  return true;
}
