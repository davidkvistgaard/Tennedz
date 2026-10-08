import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {recordFinaleRotationSoloLateCatchFromTour,
  recordFinaleRotationSoloSliceFromTour,
  recordFinaleRotationSoloCatchSliceFromTour,
  recordFinaleRotationSoloSecondCatchFromTour} from
  './finale-rotation-solo-slice.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {recordFinaleRotationSoloSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {FINALE_SPRINT_WORK_COST_PER_KM} from
  './finale-sprint-launch.mjs';
import {finalePassiveBunchSpeed} from './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {segmentBaseSeconds} from './finish.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ROTATION_SOLO_LATE_CATCH_SPRINT_VERSION=
  'v2-finale-rotation-solo-late-catch-sprint-1';
export const FINALE_ROTATION_SOLO_SECOND_CATCH_SPRINT_VERSION=
  'v2-finale-rotation-solo-second-catch-sprint-1';
export const FINALE_ROTATION_SOLO_FIRST_CATCH_SPRINT_VERSION=
  'v2-finale-rotation-solo-first-catch-sprint-1';

// Narrow finish candidate after actual late contact. A 500 m lead-out must
// first alter the earlier separated-road work, so this version rejects it.
export function recordFinaleRotationSoloLateCatchSprintFromTour(tour,input){
  const caught=recordFinaleRotationSoloLateCatchFromTour(tour,input);
  return recordSoloCatchSprint(tour,input,caught,
    FINALE_ROTATION_SOLO_LATE_CATCH_SPRINT_VERSION,200);
}

// The 400–300 m contact has its own source and three paid sprint slices.
export function recordFinaleRotationSoloSecondCatchSprintFromTour(tour,input){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const first=recordFinaleRotationSoloSliceFromTour(tour,input);
  const second=recordFinaleRotationSoloSecondCatchFromTour(tour,input);
  const caught={version:second.version,endDistanceM:second.endDistanceM,
    roadGroups:second.roadGroups,
    pelotonRiderIds:second.pelotonRiderIds,
    riderEnergy:second.riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter})),
    bunchElapsedSecondsAtMerge:road.at500M.bunchElapsedSeconds+
      first.bunchTravelSeconds+second.bunchTravelSeconds};
  return recordSoloCatchSprint(tour,input,caught,
    FINALE_ROTATION_SOLO_SECOND_CATCH_SPRINT_VERSION,300);
}

// A 500–400 m contact leaves four paid merged-bunch slices to the line.
export function recordFinaleRotationSoloFirstCatchSprintFromTour(tour,input){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const first=recordFinaleRotationSoloCatchSliceFromTour(tour,input);
  const caught={version:first.version,endDistanceM:first.endDistanceM,
    roadGroups:first.roadGroups,
    pelotonRiderIds:first.pelotonRiderIds,
    riderEnergy:first.riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter})),
    bunchElapsedSecondsAtMerge:road.at500M.bunchElapsedSeconds+
      first.bunchTravelSeconds};
  return recordSoloCatchSprint(tour,input,caught,
    FINALE_ROTATION_SOLO_FIRST_CATCH_SPRINT_VERSION,400);
}

function recordSoloCatchSprint(tour,input,caught,version,remainingM){
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  if(plan.decisions.some(row=>row.leadOutRiderId))
    throw new Error(remainingM===200?
      'A solo lead-out needs paid work before late contact.':
      'A solo lead-out needs paid work before contact.');
  const route=tour.route,teams=tour.committedInputs.teams;
  const finishM=route.distanceKm*1000;
  const slices=finaleDistanceGrid(route,{remainingKm:1}).filter(slice=>
    slice.startDistanceM>=caught.endDistanceM);
  if(caught.endDistanceM!==finishM-remainingM||
    slices.length!==remainingM/100||
    slices.some(slice=>slice.lengthM!==100)||
    slices[0].startDistanceM!==caught.endDistanceM||
    slices.at(-1).endDistanceM!==finishM||
    caught.roadGroups.length!==0)
    throw new Error('The solo catch sprint needs one merged bunch.');
  const ids=caught.pelotonRiderIds;
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const finishers=new Set(plan.decisions.map(row=>row.finisherId));
  const busyTeamIds=plan.decisions.filter(row=>
    teams.find(team=>team.id===row.teamId).orders.helperIds
      .includes(row.finisherId)).map(row=>row.teamId);
  const segment=route.kilometres.at(-1);
  let previous=new Map(caught.riderEnergy.map(row=>
    [row.riderId,{energyAfter:row.energy,gainSeconds:0}]));
  const frames=slices.map(slice=>{
    const energies=new Map(ids.map(id=>[id,previous.get(id).energyAfter]));
    const supersededRotationTeamIds=busyTeamIds.filter(teamId=>
      orderAt(teams.find(team=>team.id===teamId).orders,
        slice.sourceKm-1).frontWork==='rotate');
    const rotation=recordFinaleFrontRotationSlice({slice,route,teams,
      pelotonRiderIds:ids,energies,busyTeamIds});
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
        throw new Error(`A late-catch sprint rider cannot pay: ${riderId}.`);
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
    sourceCatchVersion:caught.version,sprintPlanVersion:plan.version,
    startDistanceM:caught.endDistanceM,endDistanceM:finishM,
    sourceBunchElapsedSeconds:caught.bunchElapsedSecondsAtMerge,
    busyTeamIds,frames,
    bunchElapsedSecondsAtLine:caught.bunchElapsedSecondsAtMerge+
      frames.reduce((sum,frame)=>sum+frame.bunchTravelSeconds,0),
    roadGroups:[],pelotonRiderIds:[...ids],
    lineRiderEnergy:frames.at(-1).riderEnergy.map(row=>({
      riderId:row.riderId,energyAfter:row.energyAfter,
      gainSeconds:row.gainSeconds})),resultStatus:'unclassified'};
}

export function validateFinaleRotationSoloSecondCatchSprintFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloSecondCatchSprintFromTour(tour,input)))
    throw new Error('The solo second-catch sprint does not replay.');
  return true;
}

export function validateFinaleRotationSoloFirstCatchSprintFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloFirstCatchSprintFromTour(tour,input)))
    throw new Error('The solo first-catch sprint does not replay.');
  return true;
}

export function validateFinaleRotationSoloLateCatchSprintFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloLateCatchSprintFromTour(tour,input)))
    throw new Error('The solo late-catch sprint does not replay.');
  return true;
}
