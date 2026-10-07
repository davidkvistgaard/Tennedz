import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep,advanceFinaleMergedStep} from './finale-group-step.mjs';
import {finaleWorkerStep,finalePassiveBunchSpeed,validateFinaleWorker,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION,
  FINALE_PASSIVE_BUNCH_VERSION} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';

export const FINALE_GROUP_RUN_VERSION='v2-finale-group-run-2';
export const FINALE_GROUP_ROTATION_RUN_VERSION='v2-finale-group-run-3';
export const FINALE_GROUP_PASSIVE_SLOPE_RUN_VERSION='v2-finale-group-run-4';
export const FINALE_GROUP_FRONT_ROTATION_RUN_VERSION='v2-finale-group-run-5';
export const FINALE_GROUP_PASSIVE_BUNCH_RUN_VERSION='v2-finale-group-run-6';
export const FINALE_GROUP_BUNCH_FLOOR_RUN_VERSION='v2-finale-group-run-7';
export const FINALE_GROUP_MIXED_CHASE_RUN_VERSION='v2-finale-group-run-8';

// One road group against the bunch. V3 can rotate named chase helpers; v5
// also rotates paid front pulls under the opt-in pace conversion. Each slice
// uses the energy left by the prior slice. The run ranks no finisher.
export function simulateFinaleGroupRun({route,snapshot,teams,frontPullRiderId,
  chasePullRiderId,chaseRotationRiderIds=null,frontRotationRiderIds=null,
  chaseScheduleRiderIds=null,paceVersion=null,passiveChase=false,
  bunchPaceFloor=false}){
  const grid=finaleDistanceGrid(route);
  const rotating=chaseRotationRiderIds!==null;
  const frontRotating=frontRotationRiderIds!==null;
  const mixedChase=chaseScheduleRiderIds!==null;
  const passiveSlope=paceVersion===FINALE_WORKER_PASSIVE_SLOPE_VERSION;
  if(paceVersion!==null&&!passiveSlope)
    throw new Error('Unknown finale worker pace version.');
  if(typeof passiveChase!=='boolean'||typeof bunchPaceFloor!=='boolean')
    throw new Error('Finale bunch pace options must be explicit booleans.');
  if(passiveChase&&(!passiveSlope||chasePullRiderId!==null||rotating))
    throw new Error('A passive bunch cannot have a nominated chase puller.');
  if(bunchPaceFloor&&(!passiveSlope||passiveChase))
    throw new Error('A paid bunch pace floor needs the passive-slope worker version.');
  if(mixedChase&&(!passiveSlope||passiveChase||bunchPaceFloor||rotating||
    !Array.isArray(chaseScheduleRiderIds)||
    chaseScheduleRiderIds.length!==grid.length||
    chaseScheduleRiderIds[0]!==chasePullRiderId||
    !chaseScheduleRiderIds.includes(null)||
    chaseScheduleRiderIds.every(id=>id===null)))
    throw new Error('A mixed chase needs a complete passive and paid schedule.');
  if(rotating&&(!Array.isArray(chaseRotationRiderIds)||
    chaseRotationRiderIds.length!==grid.length||
    new Set(chaseRotationRiderIds).size<2))
    throw new Error('A group run rotation needs a puller for every slice and two helpers.');
  if(frontRotating&&(!passiveSlope||
    !Array.isArray(frontRotationRiderIds)||
    frontRotationRiderIds.length!==grid.length||
    new Set(frontRotationRiderIds).size<2||
    frontRotationRiderIds[0]!==frontPullRiderId))
    throw new Error('A front rotation needs the versioned pace and two group pullers.');
  if(snapshot?.roadGroups?.length!==1||
    !Array.isArray(snapshot.peloton?.riderIds)||
    !snapshot.peloton.riderIds.length||
    !Array.isArray(snapshot.riders)||!Array.isArray(teams))
    throw new Error('A group run needs one source road group and the bunch.');
  const teamByRider=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,team])));
  const riderById=new Map(teams.flatMap(team=>team.riders.map(rider=>[rider.id,rider])));
  const sourceIds=[...snapshot.roadGroups[0].riderIds,...snapshot.peloton.riderIds];
  const states=new Map(snapshot.riders.map(rider=>[rider.riderId,rider]));
  if(new Set(sourceIds).size!==sourceIds.length||
    !snapshot.roadGroups[0].riderIds.includes(frontPullRiderId)||
    frontRotating&&frontRotationRiderIds.some(id=>
      !snapshot.roadGroups[0].riderIds.includes(id))||
    !passiveChase&&!mixedChase&&
      !snapshot.peloton.riderIds.includes(chasePullRiderId)||
    rotating&&chaseRotationRiderIds.some(id=>
      !snapshot.peloton.riderIds.includes(id))||
    mixedChase&&chaseScheduleRiderIds.some(id=>id!==null&&
      !snapshot.peloton.riderIds.includes(id))||
    sourceIds.some(id=>!teamByRider.has(id)||!states.has(id)))
    throw new Error('The group run has an invalid source rider or puller.');
  const frontTeam=teamByRider.get(frontPullRiderId);
  const chaseTeam=teamByRider.get(chasePullRiderId);
  validateFinaleWorker({team:frontTeam,riderId:frontPullRiderId,
    energy:states.get(frontPullRiderId).energy,role:'front'});
  if(!passiveChase&&!mixedChase)validateFinaleWorker({team:chaseTeam,
    riderId:chasePullRiderId,
    energy:states.get(chasePullRiderId).energy,role:'chase'});
  if(mixedChase)for(const id of new Set(chaseScheduleRiderIds)){
    if(id===null)continue;
    validateFinaleWorker({team:teamByRider.get(id),riderId:id,
      energy:states.get(id).energy,role:'chase'});
  }
  if(rotating){
    if(chaseRotationRiderIds[0]!==chasePullRiderId)
      throw new Error('The first rotating chase puller must match the source puller.');
    for(const id of new Set(chaseRotationRiderIds))validateFinaleWorker({
      team:teamByRider.get(id),riderId:id,energy:states.get(id).energy,
      role:'chase'});
  }
  if(frontRotating)for(const id of new Set(frontRotationRiderIds))
    validateFinaleWorker({team:teamByRider.get(id),riderId:id,
      energy:states.get(id).energy,role:'front'});
  const energies=new Map(sourceIds.map(id=>[id,states.get(id).energy]));
  let frontGroup={...snapshot.roadGroups[0],
    riderIds:[...snapshot.roadGroups[0].riderIds]};
  const frames=[];
  for(const [index,slice] of grid.entries()){
    const activeChasePullId=mixedChase?chaseScheduleRiderIds[index]:
      rotating?chaseRotationRiderIds[index]:chasePullRiderId;
    const passiveSlice=passiveChase||mixedChase&&activeChasePullId===null;
    const activeFrontPullId=frontRotating?frontRotationRiderIds[index]:
      frontPullRiderId;
    const segment=route.kilometres[slice.sourceKm-1];
    const activeFrontTeam=teamByRider.get(activeFrontPullId);
    const frontOrder=orderAt(activeFrontTeam.orders,slice.sourceKm-1);
    if(frontOrder.breakWork==='sit_on')
      throw new Error('A rider ordered to sit on cannot pull the front group.');
    const stepFor=(id,role)=>finaleWorkerStep({rider:riderById.get(id),segment,
      order:orderAt(teamByRider.get(id).orders,slice.sourceKm-1),
      energy:energies.get(id),role,paceVersion});
    const frontStep=stepFor(activeFrontPullId,'front');
    const chaseStep=passiveSlice?null:stepFor(activeChasePullId,'chase');
    const riderPlans=sourceIds.map(riderId=>{
      const pulling=riderId===activeFrontPullId||riderId===activeChasePullId;
      return {riderId,energy:energies.get(riderId),
        workCostPerKm:pulling?
          (riderId===activeFrontPullId?frontStep:chaseStep).workCostPerKm:
          TUNING.effortCost.conserve*riderKilometreEffect(
            riderById.get(riderId),segment,{phase:'chase',
              energy:energies.get(riderId),exposed:segment.exposed,
            }).energyCostMultiplier};
    });
    const step=advanceFinaleGroupStep({slice,frontGroup,
      pelotonRiderIds:snapshot.peloton.riderIds,
      frontPull:{riderId:activeFrontPullId,speedKph:frontStep.speedKph},
      chasePull:{riderId:activeChasePullId,speedKph:passiveSlice||
        bunchPaceFloor||mixedChase?Math.max(chaseStep?.speedKph??0,
          finalePassiveBunchSpeed({riderIds:snapshot.peloton.riderIds,
            ridersById:riderById,energies,segment})):chaseStep.speedKph},
      riderPlans,passiveChase:passiveSlice});
    frames.push({...step,sourceKm:slice.sourceKm,phase:slice.phase});
    for(const rider of step.riders)energies.set(rider.riderId,rider.energy);
    if(step.event)break;
    frontGroup=step.roadGroups[0];
  }
  return {version:mixedChase?FINALE_GROUP_MIXED_CHASE_RUN_VERSION:
    passiveChase?FINALE_GROUP_PASSIVE_BUNCH_RUN_VERSION:
    bunchPaceFloor?FINALE_GROUP_BUNCH_FLOOR_RUN_VERSION:
    frontRotating?FINALE_GROUP_FRONT_ROTATION_RUN_VERSION:
    passiveSlope?FINALE_GROUP_PASSIVE_SLOPE_RUN_VERSION:
    rotating?FINALE_GROUP_ROTATION_RUN_VERSION:FINALE_GROUP_RUN_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    workerTuningVersion:TUNING_VERSION,
    ...(passiveSlope?{workerPaceVersion:paceVersion}:{}),
    ...(passiveChase||bunchPaceFloor||mixedChase?
      {passiveBunchVersion:FINALE_PASSIVE_BUNCH_VERSION}:{}),
    sourceKm:snapshot.sourceKm,frontPullRiderId,chasePullRiderId,
    ...(frontRotating?{frontRotationRiderIds:[...frontRotationRiderIds]}:{}),
    ...(rotating?{chaseRotationRiderIds:[...chaseRotationRiderIds]}:{}),
    ...(mixedChase?{chaseScheduleRiderIds:[...chaseScheduleRiderIds]}:{}),
    frames,outcome:frames.at(-1).event?'caught':'survived',
    endDistanceM:frames.at(-1).endDistanceM,
    finishGapSeconds:frames.at(-1).roadGroups[0]?.gapSeconds??0};
}

export function validateFinaleGroupRun(input,recording){
  if(!isDeepStrictEqual(recording,simulateFinaleGroupRun(input)))
    throw new Error('Finale group run differs from its locked source and pullers.');
  return true;
}

export const FINALE_GROUP_TO_LINE_VERSION='v2-finale-group-to-line-2';
export const FINALE_GROUP_ROTATION_TO_LINE_VERSION='v2-finale-group-to-line-3';
export const FINALE_GROUP_PASSIVE_SLOPE_TO_LINE_VERSION='v2-finale-group-to-line-4';
export const FINALE_GROUP_FRONT_ROTATION_TO_LINE_VERSION='v2-finale-group-to-line-5';
export const FINALE_GROUP_PASSIVE_BUNCH_TO_LINE_VERSION='v2-finale-group-to-line-6';
export const FINALE_GROUP_BUNCH_FLOOR_TO_LINE_VERSION='v2-finale-group-to-line-7';
export const FINALE_GROUP_MIXED_CHASE_TO_LINE_VERSION='v2-finale-group-to-line-8';

// Continue a caught bunch from the exact catch metre through the line. A
// nominated or explicitly scheduled chase puller works; every former break
// rider joins the sheltered members. This records travel, not finish order.
export function simulateFinaleGroupToLine(input){
  const approach=simulateFinaleGroupRun(input);
  const rotating=Array.isArray(input.chaseRotationRiderIds);
  const frontRotating=Array.isArray(input.frontRotationRiderIds);
  const passiveSlope=input.paceVersion===FINALE_WORKER_PASSIVE_SLOPE_VERSION;
  const passiveChase=input.passiveChase===true;
  const bunchPaceFloor=input.bunchPaceFloor===true;
  const mixedChase=Array.isArray(input.chaseScheduleRiderIds);
  const grid=finaleDistanceGrid(input.route);
  const approachFrames=approach.frames;
  const catchFrame=approachFrames.at(-1);
  const finishM=input.route.distanceKm*1000;
  if(approach.outcome==='survived')return {
    version:mixedChase?FINALE_GROUP_MIXED_CHASE_TO_LINE_VERSION:
      passiveChase?FINALE_GROUP_PASSIVE_BUNCH_TO_LINE_VERSION:
      bunchPaceFloor?FINALE_GROUP_BUNCH_FLOOR_TO_LINE_VERSION:
      frontRotating?FINALE_GROUP_FRONT_ROTATION_TO_LINE_VERSION:
      passiveSlope?FINALE_GROUP_PASSIVE_SLOPE_TO_LINE_VERSION:
      rotating?FINALE_GROUP_ROTATION_TO_LINE_VERSION:
      FINALE_GROUP_TO_LINE_VERSION,
    sourceSnapshotVersion:approach.sourceSnapshotVersion,
    sourceTuningVersion:approach.sourceTuningVersion,
    workerTuningVersion:approach.workerTuningVersion,
    ...(passiveSlope?{workerPaceVersion:input.paceVersion}:{}),
    ...(passiveChase||bunchPaceFloor||mixedChase?
      {passiveBunchVersion:FINALE_PASSIVE_BUNCH_VERSION}:{}),
    sourceKm:approach.sourceKm,frontPullRiderId:input.frontPullRiderId,
    chasePullRiderId:input.chasePullRiderId,
    ...(frontRotating?{frontRotationRiderIds:[...input.frontRotationRiderIds]}:{}),
    ...(rotating?{chaseRotationRiderIds:[...input.chaseRotationRiderIds]}:{}),
    ...(mixedChase?{chaseScheduleRiderIds:[...input.chaseScheduleRiderIds]}:{}),
    approachFrames,mergedFrames:[],outcome:'survived',
    catchDistanceM:null,endDistanceM:finishM,
    finishGapSeconds:approach.finishGapSeconds,
    bunchTravelSecondsFromFiveKm:approachFrames.reduce((sum,frame)=>
      sum+frame.pelotonElapsedSeconds,0),
    finalRiderEnergy:catchFrame.riders.map(rider=>({riderId:rider.riderId,
      energy:rider.energy})),
  };
  const riderIds=catchFrame.pelotonRiderIds;
  const energies=new Map(catchFrame.riders.map(rider=>[rider.riderId,rider.energy]));
  const teamsByRider=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,team])));
  const ridersById=new Map(input.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const mergedFrames=[];
  for(let index=approachFrames.length-1;index<grid.length;index++){
    const slice=grid[index];
    const pullRiderId=mixedChase?input.chaseScheduleRiderIds[index]:
      rotating?input.chaseRotationRiderIds[index]:input.chasePullRiderId;
    const passiveSlice=passiveChase||mixedChase&&pullRiderId===null;
    const startDistanceM=index===approachFrames.length-1?
      catchFrame.endDistanceM:slice.startDistanceM;
    if(startDistanceM>=slice.endDistanceM)continue;
    const segment=input.route.kilometres[slice.sourceKm-1];
    const pullStep=passiveSlice?null:finaleWorkerStep({
      rider:ridersById.get(pullRiderId),segment,
      order:orderAt(teamsByRider.get(pullRiderId).orders,slice.sourceKm-1),
      energy:energies.get(pullRiderId),role:'chase',
      paceVersion:input.paceVersion});
    const riderPlans=riderIds.map(riderId=>({riderId,energy:energies.get(riderId),
      workCostPerKm:riderId===pullRiderId?pullStep.workCostPerKm:
        TUNING.effortCost.conserve*riderKilometreEffect(ridersById.get(riderId),
          segment,{phase:'chase',energy:energies.get(riderId),
            exposed:segment.exposed}).energyCostMultiplier}));
    const step=advanceFinaleMergedStep({slice,startDistanceM,riderIds,
      pullRiderId,speedKph:passiveSlice||bunchPaceFloor||mixedChase?
        Math.max(pullStep?.speedKph??0,
          finalePassiveBunchSpeed({riderIds,ridersById,energies,segment})):
        pullStep.speedKph,
      riderPlans,passiveChase:passiveSlice});
    mergedFrames.push({...step,sourceKm:slice.sourceKm,phase:slice.phase});
    for(const rider of step.riders)energies.set(rider.riderId,rider.energy);
  }
  return {version:mixedChase?FINALE_GROUP_MIXED_CHASE_TO_LINE_VERSION:
    passiveChase?FINALE_GROUP_PASSIVE_BUNCH_TO_LINE_VERSION:
    bunchPaceFloor?FINALE_GROUP_BUNCH_FLOOR_TO_LINE_VERSION:
    frontRotating?FINALE_GROUP_FRONT_ROTATION_TO_LINE_VERSION:
    passiveSlope?FINALE_GROUP_PASSIVE_SLOPE_TO_LINE_VERSION:
    rotating?FINALE_GROUP_ROTATION_TO_LINE_VERSION:
    FINALE_GROUP_TO_LINE_VERSION,
    sourceSnapshotVersion:approach.sourceSnapshotVersion,
    sourceTuningVersion:approach.sourceTuningVersion,
    workerTuningVersion:approach.workerTuningVersion,
    ...(passiveSlope?{workerPaceVersion:input.paceVersion}:{}),
    ...(passiveChase||bunchPaceFloor||mixedChase?
      {passiveBunchVersion:FINALE_PASSIVE_BUNCH_VERSION}:{}),
    sourceKm:approach.sourceKm,frontPullRiderId:input.frontPullRiderId,
    chasePullRiderId:input.chasePullRiderId,
    ...(frontRotating?{frontRotationRiderIds:[...input.frontRotationRiderIds]}:{}),
    ...(rotating?{chaseRotationRiderIds:[...input.chaseRotationRiderIds]}:{}),
    ...(mixedChase?{chaseScheduleRiderIds:[...input.chaseScheduleRiderIds]}:{}),
    approachFrames,mergedFrames,outcome:'caught_merged',
    catchDistanceM:catchFrame.endDistanceM,endDistanceM:finishM,
    finishGapSeconds:0,
    bunchTravelSecondsFromFiveKm:approachFrames.reduce((sum,frame)=>
      sum+frame.pelotonElapsedSeconds,0)+mergedFrames.reduce((sum,frame)=>
      sum+frame.travelSeconds,0),
    finalRiderEnergy:riderIds.map(riderId=>({riderId,energy:energies.get(riderId)}))};
}

export function validateFinaleGroupToLine(input,recording){
  if(!isDeepStrictEqual(recording,simulateFinaleGroupToLine(input)))
    throw new Error('Finale group-to-line run differs from its locked source and pullers.');
  return true;
}
