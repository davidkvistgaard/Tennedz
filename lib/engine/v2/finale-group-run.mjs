import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleGroupStep,advanceFinaleMergedStep} from './finale-group-step.mjs';
import {finaleWorkerStep,validateFinaleWorker,
  FINALE_WORKER_PASSIVE_SLOPE_VERSION} from './finale-worker.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {orderAt} from './orders.mjs';
import {TUNING,TUNING_VERSION} from './tuning.mjs';

export const FINALE_GROUP_RUN_VERSION='v2-finale-group-run-2';
export const FINALE_GROUP_ROTATION_RUN_VERSION='v2-finale-group-run-3';
export const FINALE_GROUP_PASSIVE_SLOPE_RUN_VERSION='v2-finale-group-run-4';

// One road group against the bunch. The v2 variant keeps fixed named pullers;
// v3 can rotate explicitly named chase helpers. Each slice uses the energy
// left by the prior slice. This run stops at a catch and ranks no finisher.
export function simulateFinaleGroupRun({route,snapshot,teams,frontPullRiderId,
  chasePullRiderId,chaseRotationRiderIds=null,paceVersion=null}){
  const grid=finaleDistanceGrid(route);
  const rotating=chaseRotationRiderIds!==null;
  const passiveSlope=paceVersion===FINALE_WORKER_PASSIVE_SLOPE_VERSION;
  if(paceVersion!==null&&!passiveSlope)
    throw new Error('Unknown finale worker pace version.');
  if(rotating&&(!Array.isArray(chaseRotationRiderIds)||
    chaseRotationRiderIds.length!==grid.length||
    new Set(chaseRotationRiderIds).size<2))
    throw new Error('A group run rotation needs a puller for every slice and two helpers.');
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
    !snapshot.peloton.riderIds.includes(chasePullRiderId)||
    rotating&&chaseRotationRiderIds.some(id=>
      !snapshot.peloton.riderIds.includes(id))||
    sourceIds.some(id=>!teamByRider.has(id)||!states.has(id)))
    throw new Error('The group run has an invalid source rider or puller.');
  const frontTeam=teamByRider.get(frontPullRiderId);
  const chaseTeam=teamByRider.get(chasePullRiderId);
  validateFinaleWorker({team:frontTeam,riderId:frontPullRiderId,
    energy:states.get(frontPullRiderId).energy,role:'front'});
  validateFinaleWorker({team:chaseTeam,riderId:chasePullRiderId,
    energy:states.get(chasePullRiderId).energy,role:'chase'});
  if(rotating){
    if(chaseRotationRiderIds[0]!==chasePullRiderId)
      throw new Error('The first rotating chase puller must match the source puller.');
    for(const id of new Set(chaseRotationRiderIds))validateFinaleWorker({
      team:teamByRider.get(id),riderId:id,energy:states.get(id).energy,
      role:'chase'});
  }
  const energies=new Map(sourceIds.map(id=>[id,states.get(id).energy]));
  let frontGroup={...snapshot.roadGroups[0],
    riderIds:[...snapshot.roadGroups[0].riderIds]};
  const frames=[];
  for(const [index,slice] of grid.entries()){
    const activeChasePullId=rotating?chaseRotationRiderIds[index]:chasePullRiderId;
    const segment=route.kilometres[slice.sourceKm-1];
    const frontOrder=orderAt(frontTeam.orders,slice.sourceKm-1);
    if(frontOrder.breakWork==='sit_on')
      throw new Error('A rider ordered to sit on cannot pull the front group.');
    const stepFor=(id,role)=>finaleWorkerStep({rider:riderById.get(id),segment,
      order:orderAt(teamByRider.get(id).orders,slice.sourceKm-1),
      energy:energies.get(id),role,paceVersion});
    const frontStep=stepFor(frontPullRiderId,'front');
    const chaseStep=stepFor(activeChasePullId,'chase');
    const riderPlans=sourceIds.map(riderId=>{
      const pulling=riderId===frontPullRiderId||riderId===activeChasePullId;
      return {riderId,energy:energies.get(riderId),
        workCostPerKm:pulling?
          (riderId===frontPullRiderId?frontStep:chaseStep).workCostPerKm:
          TUNING.effortCost.conserve*riderKilometreEffect(
            riderById.get(riderId),segment,{phase:'chase',
              energy:energies.get(riderId),exposed:segment.exposed,
            }).energyCostMultiplier};
    });
    const step=advanceFinaleGroupStep({slice,frontGroup,
      pelotonRiderIds:snapshot.peloton.riderIds,
      frontPull:{riderId:frontPullRiderId,speedKph:frontStep.speedKph},
      chasePull:{riderId:activeChasePullId,speedKph:chaseStep.speedKph},
      riderPlans});
    frames.push({...step,sourceKm:slice.sourceKm,phase:slice.phase});
    for(const rider of step.riders)energies.set(rider.riderId,rider.energy);
    if(step.event)break;
    frontGroup=step.roadGroups[0];
  }
  return {version:passiveSlope?FINALE_GROUP_PASSIVE_SLOPE_RUN_VERSION:
    rotating?FINALE_GROUP_ROTATION_RUN_VERSION:FINALE_GROUP_RUN_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    workerTuningVersion:TUNING_VERSION,
    ...(passiveSlope?{workerPaceVersion:paceVersion}:{}),
    sourceKm:snapshot.sourceKm,frontPullRiderId,chasePullRiderId,
    ...(rotating?{chaseRotationRiderIds:[...chaseRotationRiderIds]}:{}),
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

// Continue a caught bunch from the exact catch metre through the line. A
// nominated or explicitly scheduled chase puller works; every former break
// rider joins the sheltered members. This records travel, not finish order.
export function simulateFinaleGroupToLine(input){
  const approach=simulateFinaleGroupRun(input);
  const rotating=Array.isArray(input.chaseRotationRiderIds);
  const passiveSlope=input.paceVersion===FINALE_WORKER_PASSIVE_SLOPE_VERSION;
  const grid=finaleDistanceGrid(input.route);
  const approachFrames=approach.frames;
  const catchFrame=approachFrames.at(-1);
  const finishM=input.route.distanceKm*1000;
  if(approach.outcome==='survived')return {
    version:passiveSlope?FINALE_GROUP_PASSIVE_SLOPE_TO_LINE_VERSION:
      rotating?FINALE_GROUP_ROTATION_TO_LINE_VERSION:
      FINALE_GROUP_TO_LINE_VERSION,
    sourceSnapshotVersion:approach.sourceSnapshotVersion,
    sourceTuningVersion:approach.sourceTuningVersion,
    workerTuningVersion:approach.workerTuningVersion,
    ...(passiveSlope?{workerPaceVersion:input.paceVersion}:{}),
    sourceKm:approach.sourceKm,frontPullRiderId:input.frontPullRiderId,
    chasePullRiderId:input.chasePullRiderId,
    ...(rotating?{chaseRotationRiderIds:[...input.chaseRotationRiderIds]}:{}),
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
    const pullRiderId=rotating?input.chaseRotationRiderIds[index]:
      input.chasePullRiderId;
    const startDistanceM=index===approachFrames.length-1?
      catchFrame.endDistanceM:slice.startDistanceM;
    if(startDistanceM>=slice.endDistanceM)continue;
    const segment=input.route.kilometres[slice.sourceKm-1];
    const pullStep=finaleWorkerStep({rider:ridersById.get(pullRiderId),
      segment,order:orderAt(teamsByRider.get(pullRiderId).orders,
        slice.sourceKm-1),energy:energies.get(pullRiderId),role:'chase',
      paceVersion:input.paceVersion});
    const riderPlans=riderIds.map(riderId=>({riderId,energy:energies.get(riderId),
      workCostPerKm:riderId===pullRiderId?pullStep.workCostPerKm:
        TUNING.effortCost.conserve*riderKilometreEffect(ridersById.get(riderId),
          segment,{phase:'chase',energy:energies.get(riderId),
            exposed:segment.exposed}).energyCostMultiplier}));
    const step=advanceFinaleMergedStep({slice,startDistanceM,riderIds,
      pullRiderId,speedKph:pullStep.speedKph,
      riderPlans});
    mergedFrames.push({...step,sourceKm:slice.sourceKm,phase:slice.phase});
    for(const rider of step.riders)energies.set(rider.riderId,rider.energy);
  }
  return {version:passiveSlope?FINALE_GROUP_PASSIVE_SLOPE_TO_LINE_VERSION:
    rotating?FINALE_GROUP_ROTATION_TO_LINE_VERSION:
    FINALE_GROUP_TO_LINE_VERSION,
    sourceSnapshotVersion:approach.sourceSnapshotVersion,
    sourceTuningVersion:approach.sourceTuningVersion,
    workerTuningVersion:approach.workerTuningVersion,
    ...(passiveSlope?{workerPaceVersion:input.paceVersion}:{}),
    sourceKm:approach.sourceKm,frontPullRiderId:input.frontPullRiderId,
    chasePullRiderId:input.chasePullRiderId,
    ...(rotating?{chaseRotationRiderIds:[...input.chaseRotationRiderIds]}:{}),
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
