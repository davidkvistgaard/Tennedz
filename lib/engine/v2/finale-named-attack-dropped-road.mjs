import {isDeepStrictEqual} from 'node:util';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {recordFinaleLastKmNamedIntentsFromTour} from
  './finale-last-km-named-intents.mjs';
import {advanceFinaleNamedAttackTransition} from
  './finale-named-attack-transition.mjs';
import {continueFinaleNamedAttackGroup,
  continueFinaleNamedAttackChain,
  continueFinaleNamedAttackSoloSprintChain} from
  './finale-named-attack-followup.mjs';
import {continueFinaleNamedAttackBunch,
  continueFinaleNamedAttackBunchChain,
  continueFinaleNamedAttackLateCatchBunch} from
  './finale-named-attack-bunch-step.mjs';
import {advanceFinaleDroppedStep} from './finale-dropped-step.mjs';
import {assignFinishBandPlaces} from './finale-finish-order-bounds.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,TUNING} from './tuning.mjs';

export const FINALE_NAMED_ATTACK_DROPPED_ROAD_VERSION=
  'v2-finale-named-attack-dropped-road-1';
export const FINALE_NAMED_ATTACK_MULTIPLE_DROPPED_ROAD_VERSION=
  'v2-finale-named-attack-multiple-dropped-road-2';
export const FINALE_NAMED_ATTACK_MULTIPLE_DROPPED_SPRINT_ROAD_VERSION=
  'v2-finale-named-attack-multiple-dropped-sprint-road-3';
const EPSILON=1e-7;

// Run one eligible named peloton attack on the same clock as already dropped
// riders. The active field uses the existing attack/chase steps; each dropped
// rider travels independently and pays the existing strict reserve demand.
// Any contact or unpaid travel refuses this whole road, never a fabricated
// finish. No sprint wheel, individual placing or award is inferred.
export function recordFinaleNamedAttackDroppedRoadFromTour(tour,{teamId}){
  return recordNamedDroppedRoad(tour,{teamId},{minDropped:1,
    maxDropped:1,version:FINALE_NAMED_ATTACK_DROPPED_ROAD_VERSION});
}

export function recordFinaleNamedAttackMultipleDroppedRoadFromTour(tour,
  {teamId}){
  return recordNamedDroppedRoad(tour,{teamId},{minDropped:2,
    maxDropped:Infinity,
    version:FINALE_NAMED_ATTACK_MULTIPLE_DROPPED_ROAD_VERSION});
}

export function recordFinaleNamedAttackMultipleDroppedSprintRoadFromTour(
  tour,{teamId,finisherId}){
  return recordNamedDroppedRoad(tour,{teamId},{minDropped:2,
    maxDropped:Infinity,sprintRiderId:finisherId,
    version:FINALE_NAMED_ATTACK_MULTIPLE_DROPPED_SPRINT_ROAD_VERSION});
}

function recordNamedDroppedRoad(tour,{teamId},{minDropped,maxDropped,
  version,sprintRiderId=null}){
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  if(source.sourceTuningVersion!==MOTOR_ATTACK_TRACE_VERSION||
    source.roadGroups.length||
    source.droppedRiderIds.length<minDropped||
    source.droppedRiderIds.length>maxDropped||
    !source.peloton.riderIds.length)
    throw new Error('The named dropped-road attack needs a bunch and one dropped rider.');
  const intents=recordFinaleLastKmNamedIntentsFromTour(tour);
  const named=intents.named.filter(row=>row.teamId===teamId&&
    row.canEnterRoadContest);
  if(named.length!==1||intents.named.length!==1||
    intents.otherPendingActions.length||
    intents.unresolvedSelectiveChaseTeamIds.length||
    tour.committedInputs.teams.some(team=>team.id!==teamId&&
      orderAt(team.orders,tour.route.distanceKm-1).attack!=='none'||
      team.orders.gcObjective!=='stage_result'||
      orderAt(team.orders,tour.route.distanceKm-1).frontWork==='rotate'))
    throw new Error('The named dropped-road attack needs one payable intent.');
  const riderId=named[0].riderId;
  if(sprintRiderId!==null&&sprintRiderId!==riderId)
    throw new Error('The named solo sprint needs its locked attacker.');
  const locked=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const present=new Set(source.peloton.riderIds);
  const dropped=new Set(source.droppedRiderIds);
  if(present.size+dropped.size!==locked.length||
    locked.some(id=>!present.has(id)&&!dropped.has(id))||
    [...present].some(id=>dropped.has(id)))
    throw new Error('The named dropped-road source lost a locked rider.');
  const teams=tour.committedInputs.teams.map(team=>({...team,
    riders:team.riders.filter(rider=>present.has(rider.id))}));
  const ridersById=new Map(tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const sourceRows=new Map(tour.frames[source.sourceKm-1]
    .riderGroups.map(row=>[row.id,row]));
  let droppedState=source.droppedRiderIds.map(id=>({riderId:id,
    deficitSeconds:sourceRows.get(id)?.deficitSeconds,
    energy:source.riders.find(row=>row.riderId===id)?.energy}));
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1});
  const repeatLoad=+Math.max(0,named[0].sourceAttackLoad-
    TUNING.attack.loadRecoveryPerKm).toFixed(3);
  const launchInput={slice:grid[0],route:tour.route,teams,
    pelotonRiderIds:source.peloton.riderIds,
    energies:new Map(source.riders.map(row=>[row.riderId,row.energy])),
    attackerTeamId:teamId,attackerRiderId:riderId,repeatLoad};
  const launch=advanceFinaleNamedAttackTransition(launchInput);
  const sprintFromDistanceM=sprintRiderId===null?null:
    tour.route.distanceKm*1000-300;
  const followups=[],bunchFrames=[];
  const activeFrames=[launch];
  for(const slice of grid.slice(1)){
    const prior=activeFrames.at(-1);
    let next;
    if(prior.roadGroups.length===1){
      next=sprintFromDistanceM!==null&&
        slice.startDistanceM>=sprintFromDistanceM?
        continueFinaleNamedAttackSoloSprintChain({launchInput,launch,
          followups,slice,sprintFromDistanceM}):
        followups.length?continueFinaleNamedAttackChain({
        launchInput,launch,followups,slice}):
        continueFinaleNamedAttackGroup({launchInput,launch,slice});
      followups.push(next);
    }else if(followups.length>=2){
      next=continueFinaleNamedAttackLateCatchBunch({
        launchInput,launch,followups,frames:bunchFrames,slice,
        sprintFromDistanceM});
      bunchFrames.push(next);
    }else if(bunchFrames.length){
      next=continueFinaleNamedAttackBunchChain({
        launchInput,launch,followup:followups[0]??null,
        frames:bunchFrames,slice});
      bunchFrames.push(next);
    }else{
      next=continueFinaleNamedAttackBunch({launchInput,launch,
        followup:followups[0]??null,slice});
      bunchFrames.push(next);
    }
    activeFrames.push(next);
  }
  let bunchTime=0;
  const frames=activeFrames.map((active,index)=>{
    const slice=grid[index];
    bunchTime+=active.bunchElapsedSeconds;
    const droppedTravel=advanceFinaleDroppedStep({slice,
      segment:tour.route.kilometres[slice.sourceKm-1],
      bunchElapsedSeconds:active.bunchElapsedSeconds,
      droppedRiders:droppedState,ridersById});
    droppedState=droppedTravel.riders.map(row=>({
      riderId:row.riderId,deficitSeconds:row.deficitSecondsAfter,
      energy:row.energyAfter}));
    if(active.startDistanceM!==slice.startDistanceM||
      active.endDistanceM!==slice.endDistanceM||
      droppedTravel.endDistanceM!==slice.endDistanceM||
      active.riderEnergy.length!==present.size||
      new Set(active.riderEnergy.map(row=>row.riderId)).size!==present.size||
      active.riderEnergy.some(row=>!present.has(row.riderId)||
        row.energyAfter<0)||
      droppedTravel.riders.length!==dropped.size)
      throw new Error('The named dropped-road step lost its common field.');
    return {distanceM:slice.endDistanceM,
      bunchElapsedSecondsFromMarker:bunchTime,
      active,droppedTravel};
  });
  const last=activeFrames.at(-1);
  const lineDistanceM=tour.route.distanceKm*1000;
  const bands=assignFinishBandPlaces([
    ...last.roadGroups.map(group=>({id:group.id,kind:'road_group',
      riderIds:[...group.riderIds],
      passageSecondsFromBunchMarker:bunchTime-group.gapSeconds})),
    {id:'peloton',kind:'peloton',riderIds:[...last.pelotonRiderIds],
      passageSecondsFromBunchMarker:bunchTime},
    {id:'dropped',kind:'unresolved_dropped',
      riderIds:droppedState.map(row=>row.riderId),
      firstPassageSecondsFromBunchMarker:bunchTime+
        Math.min(...droppedState.map(row=>row.deficitSeconds)),
      lastPassageSecondsFromBunchMarker:bunchTime+
        Math.max(...droppedState.map(row=>row.deficitSeconds))}]);
  if(last.endDistanceM!==lineDistanceM||
    bands.at(-1).lastPossiblePlace!==locked.length||
    last.roadGroups.some(group=>group.gapSeconds<=EPSILON)||
    droppedState.some(row=>row.deficitSeconds<=EPSILON)||
    last.riderEnergy.length+droppedState.length!==locked.length)
    throw new Error('The named dropped-road line has unresolved contact.');
  return {version,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    sourceSnapshotVersion:source.version,
    sourceKm:source.sourceKm,lineDistanceM,
    attackIntent:{teamId,riderId},sourceAttackLoad:named[0].sourceAttackLoad,
    ...(sprintRiderId!==null?{sprintRiderId,sprintFromDistanceM}:{}),
    repeatLoad,frames,line:{bands,
      finalRiderEnergy:[...last.riderEnergy.map(row=>({
        riderId:row.riderId,energy:row.energyAfter})),
      ...droppedState.map(row=>({riderId:row.riderId,
        energy:row.energy}))]},
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleNamedAttackDroppedRoadFromTour(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedAttackDroppedRoadFromTour(tour,input)))
    throw new Error('The named dropped-road attack does not replay.');
  return true;
}

export function validateFinaleNamedAttackMultipleDroppedRoadFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedAttackMultipleDroppedRoadFromTour(tour,input)))
    throw new Error('The named multiple-dropped attack does not replay.');
  return true;
}

export function validateFinaleNamedAttackMultipleDroppedSprintRoadFromTour(
  tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleNamedAttackMultipleDroppedSprintRoadFromTour(tour,input)))
    throw new Error('The named multiple-dropped sprint road does not replay.');
  return true;
}
