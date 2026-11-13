import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep,advanceFinaleMergedStep} from
  './finale-group-step.mjs';
import {recordFinaleFrontRotationSlice} from
  './finale-front-rotation-slice.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {finalePassiveBunchSpeed,finalePassiveFrontSpeed,
  finaleWorkerStep,FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  './finale-worker.mjs';
import {energyCostForFinaleSlice} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_ROTATION_SOLO_SLICE_VERSION=
  'v2-finale-rotation-solo-slice-1';
export const FINALE_ROTATION_SOLO_SECOND_SLICE_VERSION=
  'v2-finale-rotation-solo-slice-2';
export const FINALE_ROTATION_SOLO_SECOND_CATCH_VERSION=
  'v2-finale-rotation-solo-second-catch-1';
export const FINALE_ROTATION_SOLO_CATCH_SLICE_VERSION=
  'v2-finale-rotation-solo-catch-slice-1';
export const FINALE_ROTATION_SOLO_RUN_VERSION=
  'v2-finale-rotation-solo-run-1';
const FINALE_ROTATION_SOLO_LATE_STEP_VERSION=
  'v2-finale-rotation-solo-late-step-1';
export const FINALE_ROTATION_SOLO_LATE_CATCH_VERSION=
  'v2-finale-rotation-solo-late-catch-1';
const FINALE_ROTATION_SOLO_LATE_CATCH_STEP_VERSION=
  'v2-finale-rotation-solo-late-catch-step-1';
export const FINALE_ROTATION_SOLO_OUTCOME_DECISION_VERSION=
  'v2-finale-rotation-solo-outcome-decision-1';
export const FINALE_ROTATION_SOLO_PENULTIMATE_DECISION_VERSION=
  'v2-finale-rotation-solo-penultimate-decision-1';
export const FINALE_ROTATION_SOLO_FINAL_CONTACT_VERSION=
  'v2-finale-rotation-solo-final-contact-1';
export const FINALE_ROTATION_SOLO_FINAL_CONTACT_DECISION_VERSION=
  'v2-finale-rotation-solo-final-contact-decision-1';

// One source-linked 100 m solo-versus-bunch step. A calculated catch is
// refused until its precise remaining-slice work and road merge are recorded.
function recordSoloStep(tour,{attackTeamId,previous,version,source,
  requireCatch=false,allowCatch=false,catchVersion=version}){
  const route=tour.route,teams=tour.committedInputs.teams;
  const slice=finaleDistanceGrid(route,{remainingKm:1}).find(row=>
    row.startDistanceM===previous.distanceM);
  if(!slice||slice.lengthM!==100)
    throw new Error('The solo continuation needs the next 100 m slice.');
  const segment=route.kilometres[slice.sourceKm-1];
  const ridersById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const energies=new Map(previous.riderEnergy.map(row=>
    [row.riderId,row.energyAfter??row.energy]));
  const frontGroup=previous.roadGroups[0];
  const frontId=frontGroup?.riderIds[0];
  if(previous.roadGroups.length!==1||frontGroup.riderIds.length!==1||
    !frontId||!teams.find(team=>team.id===attackTeamId)
      ?.riders.some(rider=>rider.id===frontId))
    throw new Error('The solo continuation needs one named front rider.');
  const frontOrder=orderAt(teams.find(team=>team.id===attackTeamId)
    .orders,slice.sourceKm-1);
  const frontEnergy=energies.get(frontId);
  const proposedFront=frontOrder.breakWork==='sit_on'||
    frontEnergy<TUNING.breakaway.minPullEnergy?null:
    finaleWorkerStep({rider:ridersById.get(frontId),segment,
      order:frontOrder,energy:frontEnergy,role:'front',
      paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  const front=proposedFront&&energyCostForFinaleSlice(slice,
    proposedFront.workCostPerKm)<=frontEnergy+1e-9?
    proposedFront:null;
  const frontSpeedKph=front?.speedKph??finalePassiveFrontSpeed({
    riderIds:[frontId],ridersById,energies,segment});
  const chasers=[];
  for(const team of teams){
    if(team.id===attackTeamId)continue;
    const order=orderAt(team.orders,slice.sourceKm-1);
    if(order.attack!=='none'||order.chase==='selective')
      throw new Error('Solo continuation needs other attacks and conditional chase recorded.');
    if(order.chase!=='all')continue;
    for(const riderId of team.orders.helperIds){
      if(!previous.pelotonRiderIds.includes(riderId))continue;
      const energy=energies.get(riderId);
      if(energy<TUNING.chase.minHelperEnergy)continue;
      const step=finaleWorkerStep({rider:ridersById.get(riderId),
        segment,order,energy,role:'chase',
        paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
      if(energyCostForFinaleSlice(slice,step.workCostPerKm)<=energy+1e-9)
        chasers.push({teamId:team.id,riderId,step});
    }
  }
  chasers.sort((a,b)=>b.step.speedKph-a.step.speedKph||
    a.teamId.localeCompare(b.teamId)||
    a.riderId.localeCompare(b.riderId));
  const chase=chasers[0]??null;
  const rotation=recordFinaleFrontRotationSlice({slice,route,teams,
    pelotonRiderIds:previous.pelotonRiderIds,energies,
    busyTeamIds:[attackTeamId,...(chase?[chase.teamId]:[])]});
  const workers=new Map(rotation.selected?.work.map(row=>
    [row.riderId,row])??[]);
  if(workers.has(frontId)||workers.has(chase?.riderId))
    throw new Error('A solo worker cannot pay for two roles.');
  const passiveSpeedKph=finalePassiveBunchSpeed({
    riderIds:previous.pelotonRiderIds,ridersById,energies,segment});
  const bunchSpeedKph=Math.max(passiveSpeedKph,
    chase?.step.speedKph??0,rotation.bunchSpeedKph);
  const paceRiderId=rotation.selected&&
    rotation.selected.speedKph>=bunchSpeedKph?
    rotation.selected.riderIds[0]:chase&&
      chase.step.speedKph>=bunchSpeedKph?chase.riderId:null;
  const paceSource=paceRiderId===null?'passive_bunch':
    rotation.selected?.riderIds.includes(paceRiderId)?
      'front_rotation':'chase';
  const allIds=[frontId,...previous.pelotonRiderIds];
  const shelteredRate=(riderId,energy=energies.get(riderId))=>
    TUNING.effortCost.conserve*
    riderKilometreEffect(ridersById.get(riderId),segment,{
      phase:'chase',energy,
      exposed:segment.exposed}).energyCostMultiplier;
  const riderPlans=allIds.map(riderId=>({riderId,
    energy:energies.get(riderId),
    workCostPerKm:riderId===frontId?
      front?.workCostPerKm??shelteredRate(riderId):
      riderId===chase?.riderId?chase.step.workCostPerKm:
      workers.has(riderId)?workers.get(riderId).energySpent*
        1000/slice.lengthM:shelteredRate(riderId)}));
  const movement=advanceFinaleGroupStep({slice,frontGroup,
    pelotonRiderIds:previous.pelotonRiderIds,
    frontPull:{riderId:front?frontId:null,speedKph:frontSpeedKph},
    chasePull:{riderId:paceRiderId,speedKph:bunchSpeedKph},
    riderPlans,passiveFront:!front,passiveChase:paceRiderId===null});
  if(movement.event&&!requireCatch&&!allowCatch)
    throw new Error('The solo slice needs an exact catch continuation.');
  if(!movement.event&&requireCatch)
    throw new Error('The solo catch slice needs actual road contact.');
  if(movement.event){
    if(movement.endDistanceM>=slice.endDistanceM)
      throw new Error('A slice-end catch needs a separate contact rule.');
    const atCatch=new Map(movement.riders.map(row=>
      [row.riderId,row.energy]));
    const mergedIds=movement.pelotonRiderIds;
    const afterCatchRotation=recordFinaleFrontRotationSlice({
      slice,route,teams,pelotonRiderIds:mergedIds,energies:atCatch,
      busyTeamIds:[]});
    const afterWork=new Map(afterCatchRotation.selected?.work.map(row=>
      [row.riderId,row])??[]);
    const mergedSpeedKph=Math.max(finalePassiveBunchSpeed({
      riderIds:mergedIds,ridersById,energies:atCatch,segment}),
    afterCatchRotation.bunchSpeedKph);
    const afterPullId=afterCatchRotation.selected&&
      afterCatchRotation.selected.speedKph>=mergedSpeedKph?
      afterCatchRotation.selected.riderIds[0]:null;
    const merged=advanceFinaleMergedStep({slice,
      startDistanceM:movement.endDistanceM,riderIds:mergedIds,
      pullRiderId:afterPullId,speedKph:mergedSpeedKph,
      passiveChase:afterPullId===null,
      riderPlans:mergedIds.map(riderId=>({riderId,
        energy:atCatch.get(riderId),
        workCostPerKm:afterWork.has(riderId)?
          afterWork.get(riderId).energySpent*1000/slice.lengthM:
          shelteredRate(riderId,atCatch.get(riderId))}))});
    const afterById=new Map(merged.riders.map(row=>
      [row.riderId,row]));
    const riderEnergy=movement.riders.map(row=>{
      const after=afterById.get(row.riderId);
      return {riderId:row.riderId,
        role:row.riderId===frontId?front?'front':'sheltered':
          row.riderId===chase?.riderId?'chase':
            workers.has(row.riderId)?'front_rotation':'sheltered',
        energyAtDecision:energies.get(row.riderId),
        energyAtCatch:row.energy,
        preCatchEnergySpent:row.energySpent,
        postCatchRole:afterWork.has(row.riderId)?
          'front_rotation':'sheltered',
        postCatchEnergySpent:after.energySpent,
        energySpent:row.energySpent+after.energySpent,
        energyAfter:after.energy};
    });
    return {version:catchVersion,...source,
      startDistanceM:slice.startDistanceM,
      catchDistanceM:movement.endDistanceM,
      endDistanceM:merged.endDistanceM,sourceKm:slice.sourceKm,
      frontRiderId:front?frontId:null,
      chaseRiderId:chase?.riderId??null,
      beforeCatchRotationPlan:rotation,paceSource,
      frontSpeedKph,bunchSpeedKph,
      frontTravelSeconds:movement.frontElapsedSeconds,
      bunchTravelSeconds:movement.pelotonElapsedSeconds+
        merged.travelSeconds,
      afterCatchRotationPlan:afterCatchRotation,mergedSpeedKph,
      preCatchBunchTravelSeconds:movement.pelotonElapsedSeconds,
      postCatchTravelSeconds:merged.travelSeconds,
      roadGroups:[],pelotonRiderIds:mergedIds,riderEnergy};
  }
  const riderEnergy=movement.riders.map(row=>({
    riderId:row.riderId,
    role:row.riderId===frontId?front?'front':'sheltered':
      row.riderId===chase?.riderId?'chase':
        workers.has(row.riderId)?'front_rotation':'sheltered',
    energyAtDecision:energies.get(row.riderId),
    energySpent:row.energySpent,energyAfter:row.energy}));
  return {version,...source,
    startDistanceM:slice.startDistanceM,
    endDistanceM:movement.endDistanceM,sourceKm:slice.sourceKm,
    frontRiderId:front?frontId:null,
    chaseRiderId:chase?.riderId??null,rotation,paceSource,
    frontSpeedKph,bunchSpeedKph,
    frontTravelSeconds:movement.frontElapsedSeconds,
    bunchTravelSeconds:movement.pelotonElapsedSeconds,
    roadGroups:movement.roadGroups,
    pelotonRiderIds:movement.pelotonRiderIds,riderEnergy};
}

export function recordFinaleRotationSoloSliceFromTour(tour,{attackTeamId}){
  const road=probeLastKmRotationSoloFromTour(tour,{teamId:attackTeamId});
  return recordSoloStep(tour,{attackTeamId,previous:road.at500M,
  version:FINALE_ROTATION_SOLO_SLICE_VERSION,
  source:{sourceRoadTraceVersion:road.version}});
}

export function recordFinaleRotationSoloSecondSliceFromTour(tour,input){
  const first=recordFinaleRotationSoloSliceFromTour(tour,input);
  return recordSoloStep(tour,{...input,previous:{...first,
    distanceM:first.endDistanceM},
  version:FINALE_ROTATION_SOLO_SECOND_SLICE_VERSION,
  source:{sourceSliceVersion:first.version}});
}

// Contact in 400–300 m is resolved from the paid 500–400 m state. The
// separate version keeps older separated-road recordings replayable.
export function recordFinaleRotationSoloSecondCatchFromTour(tour,input){
  const first=recordFinaleRotationSoloSliceFromTour(tour,input);
  return recordSoloStep(tour,{...input,previous:{...first,
    distanceM:first.endDistanceM},
  version:FINALE_ROTATION_SOLO_SECOND_CATCH_VERSION,
  source:{sourceSliceVersion:first.version},requireCatch:true});
}

export function recordFinaleRotationSoloCatchSliceFromTour(tour,{attackTeamId}){
  const road=probeLastKmRotationSoloFromTour(tour,{teamId:attackTeamId});
  return recordSoloStep(tour,{attackTeamId,previous:road.at500M,
    version:FINALE_ROTATION_SOLO_CATCH_SLICE_VERSION,
    source:{sourceRoadTraceVersion:road.version},requireCatch:true});
}

// Read-only separated-road line trace. Every late slice reselects work from
// the preceding recorded road and energy; any later catch still fails closed.
export function recordFinaleRotationSoloRunFromTour(tour,input){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const first=recordFinaleRotationSoloSliceFromTour(tour,input);
  const second=recordFinaleRotationSoloSecondSliceFromTour(tour,input);
  const frames=[first,second];
  const finishDistanceM=tour.route.kilometres.length*1000;
  while(frames.at(-1).endDistanceM<finishDistanceM){
    const previous=frames.at(-1);
    frames.push(recordSoloStep(tour,{...input,
      previous:{...previous,distanceM:previous.endDistanceM},
      version:FINALE_ROTATION_SOLO_LATE_STEP_VERSION,
      source:{sourceSliceVersion:previous.version}}));
  }
  const line=frames.at(-1);
  if(line.endDistanceM!==finishDistanceM||
    line.roadGroups.length!==1||
    line.roadGroups[0].gapSeconds<=0)
    throw new Error('The solo run needs a separated line state.');
  return {version:FINALE_ROTATION_SOLO_RUN_VERSION,
    sourceRoadTraceVersion:road.version,
    sourceFirstSliceVersion:first.version,
    sourceSecondSliceVersion:second.version,
    startDistanceM:road.at500M.distanceM,
    endDistanceM:line.endDistanceM,
    frames,bunchElapsedSecondsAtLine:
      road.at500M.bunchElapsedSeconds+
      frames.reduce((sum,frame)=>sum+frame.bunchTravelSeconds,0),
    roadGroups:line.roadGroups,
    pelotonRiderIds:line.pelotonRiderIds,
    lineRiderEnergy:line.riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter}))};
}

// A later-contact branch stops at the end of its paid merge slice. It does
// not infer position or continue the reunited bunch through remaining metres.
export function recordFinaleRotationSoloLateCatchFromTour(tour,input){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const first=recordFinaleRotationSoloSliceFromTour(tour,input);
  const second=recordFinaleRotationSoloSecondSliceFromTour(tour,input);
  const frames=[first,second];
  const finishDistanceM=tour.route.kilometres.length*1000;
  while(frames.at(-1).endDistanceM<finishDistanceM){
    const previous=frames.at(-1);
    const next=recordSoloStep(tour,{...input,
      previous:{...previous,distanceM:previous.endDistanceM},
      version:FINALE_ROTATION_SOLO_LATE_STEP_VERSION,
      catchVersion:FINALE_ROTATION_SOLO_LATE_CATCH_STEP_VERSION,
      source:{sourceSliceVersion:previous.version},allowCatch:true});
    frames.push(next);
    if(next.catchDistanceM!==undefined){
      return {version:FINALE_ROTATION_SOLO_LATE_CATCH_VERSION,
        sourceRoadTraceVersion:road.version,
        sourceFirstSliceVersion:first.version,
        sourceSecondSliceVersion:second.version,
        startDistanceM:road.at500M.distanceM,
        catchDistanceM:next.catchDistanceM,
        endDistanceM:next.endDistanceM,
        frames,roadGroups:next.roadGroups,
        pelotonRiderIds:next.pelotonRiderIds,
        riderEnergy:next.riderEnergy.map(row=>({
          riderId:row.riderId,energy:row.energyAfter})),
        bunchElapsedSecondsAtMerge:
          road.at500M.bunchElapsedSeconds+
          frames.reduce((sum,frame)=>sum+frame.bunchTravelSeconds,0),
        resultStatus:'unclassified'};
    }
  }
  throw new Error('The late-catch branch needs actual road contact.');
}

// Contact within the final 100 m already pays the merged remainder to line.
// There is no second sprint or provable within-bunch position to append.
export function recordFinaleRotationSoloFinalContactFromTour(tour,input){
  const caught=recordFinaleRotationSoloLateCatchFromTour(tour,input);
  const finishDistanceM=tour.route.kilometres.length*1000;
  if(caught.endDistanceM!==finishDistanceM||
    caught.catchDistanceM<=finishDistanceM-100||
    caught.catchDistanceM>=finishDistanceM||
    caught.roadGroups.length!==0)
    throw new Error('Final solo contact needs a paid last-slice merge.');
  return {version:FINALE_ROTATION_SOLO_FINAL_CONTACT_VERSION,
    sourceCatchVersion:caught.version,
    startDistanceM:caught.startDistanceM,
    catchDistanceM:caught.catchDistanceM,
    endDistanceM:finishDistanceM,
    sourceBunchElapsedSeconds:caught.bunchElapsedSecondsAtMerge,
    bunchElapsedSecondsAtLine:caught.bunchElapsedSecondsAtMerge,
    roadGroups:[],pelotonRiderIds:caught.pelotonRiderIds,
    lineRiderEnergy:caught.riderEnergy.map(row=>({
      riderId:row.riderId,energyAfter:row.energy})),
    sprintStatus:'not_modeled_before_contact',
    resultStatus:'unclassified'};
}

// Select a supported branch from measured road contact, never from a
// manager-provided desired result. Later contact shapes still fail closed.
export function decideFinaleRotationSoloOutcomeFromTour(tour,input){
  const road=probeLastKmRotationSoloFromTour(tour,{
    teamId:input.attackTeamId});
  const finishDistanceM=tour.route.kilometres.length*1000;
  let previous=road.at500M;
  for(let index=0;index<5;index++){
    const next=recordSoloStep(tour,{...input,previous,
      version:index===0?FINALE_ROTATION_SOLO_SLICE_VERSION:
        index===1?FINALE_ROTATION_SOLO_SECOND_SLICE_VERSION:
        FINALE_ROTATION_SOLO_LATE_STEP_VERSION,
      catchVersion:index===0?FINALE_ROTATION_SOLO_CATCH_SLICE_VERSION:
        index===1?FINALE_ROTATION_SOLO_SECOND_CATCH_VERSION:
        FINALE_ROTATION_SOLO_LATE_CATCH_STEP_VERSION,
      source:{sourceSliceVersion:index===0?road.version:
        previous.version},allowCatch:true});
    if(next.catchDistanceM!==undefined){
      const branch=index===0?'first_catch':
        index===1?'second_catch':
        index===2?'late_catch':
        index===3?'penultimate_catch':'final_contact';
      const canonical=index===0?
        recordFinaleRotationSoloCatchSliceFromTour(tour,input):
        index===1?
          recordFinaleRotationSoloSecondCatchFromTour(tour,input):
          recordFinaleRotationSoloLateCatchFromTour(tour,input);
      if(canonical.catchDistanceM!==next.catchDistanceM||
        canonical.endDistanceM!==next.endDistanceM)
        throw new Error('The selected solo contact does not replay.');
      return {version:branch==='final_contact'?
        FINALE_ROTATION_SOLO_FINAL_CONTACT_DECISION_VERSION:
        branch==='penultimate_catch'?
          FINALE_ROTATION_SOLO_PENULTIMATE_DECISION_VERSION:
          FINALE_ROTATION_SOLO_OUTCOME_DECISION_VERSION,
        sourceRoadTraceVersion:road.version,branch,
        sourceOutcomeVersion:canonical.version,
        startDistanceM:road.at500M.distanceM,
        catchDistanceM:canonical.catchDistanceM,
        nextDecisionDistanceM:canonical.endDistanceM,
        finishDistanceM,resultStatus:'unclassified'};
    }
    previous={...next,distanceM:next.endDistanceM};
  }
  const canonical=recordFinaleRotationSoloRunFromTour(tour,input);
  if(canonical.endDistanceM!==previous.endDistanceM||
    canonical.roadGroups[0]?.gapSeconds!==
      previous.roadGroups[0]?.gapSeconds)
    throw new Error('The selected surviving solo does not replay.');
  return {version:FINALE_ROTATION_SOLO_OUTCOME_DECISION_VERSION,
    sourceRoadTraceVersion:road.version,branch:'surviving_solo',
    sourceOutcomeVersion:canonical.version,
    startDistanceM:road.at500M.distanceM,
    catchDistanceM:null,nextDecisionDistanceM:finishDistanceM,
    finishDistanceM,resultStatus:'unclassified'};
}

export function validateFinaleRotationSoloFinalContactFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloFinalContactFromTour(tour,input)))
    throw new Error('The solo final contact does not replay.');
  return true;
}

export function validateFinaleRotationSoloOutcomeFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    decideFinaleRotationSoloOutcomeFromTour(tour,input)))
    throw new Error('The solo outcome decision does not replay.');
  return true;
}

export function validateFinaleRotationSoloSliceFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloSliceFromTour(tour,input)))
    throw new Error('The solo rotation slice does not replay.');
  return true;
}

export function validateFinaleRotationSoloSecondSliceFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloSecondSliceFromTour(tour,input)))
    throw new Error('The second solo rotation slice does not replay.');
  return true;
}

export function validateFinaleRotationSoloSecondCatchFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloSecondCatchFromTour(tour,input)))
    throw new Error('The second solo rotation catch does not replay.');
  return true;
}

export function validateFinaleRotationSoloCatchSliceFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloCatchSliceFromTour(tour,input)))
    throw new Error('The solo rotation catch slice does not replay.');
  return true;
}

export function validateFinaleRotationSoloRunFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloRunFromTour(tour,input)))
    throw new Error('The solo rotation run does not replay.');
  return true;
}

export function validateFinaleRotationSoloLateCatchFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloLateCatchFromTour(tour,input)))
    throw new Error('The solo rotation late catch does not replay.');
  return true;
}
