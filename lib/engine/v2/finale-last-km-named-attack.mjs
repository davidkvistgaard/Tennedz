import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleNamedAttackTransition} from
  './finale-named-attack-transition.mjs';
import {continueFinaleNamedAttackGroup,continueFinaleNamedAttackChain} from
  './finale-named-attack-followup.mjs';
import {continueFinaleNamedAttackBunch,
  continueFinaleNamedAttackBunchChain,
  continueFinaleNamedAttackLateCatchBunch} from
  './finale-named-attack-bunch-step.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,TUNING} from './tuning.mjs';

export const FINALE_LAST_KM_NAMED_ATTACK_VERSION=
  'v2-finale-last-km-named-attack-1';
export const FINALE_LAST_KM_NAMED_ATTACK_ROAD_VERSION=
  'v2-finale-last-km-named-attack-road-2';

// Read-only bridge from a validated v91 kilometre recording to one short
// launch slice. It accepts only a complete bunch and one resolvable named
// attack. The source's recorded final kilometre is never used as its result.
export function probeLastKmNamedAttackFromTour(tour,{teamId}){
  const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  if(snapshot.sourceTuningVersion!==MOTOR_ATTACK_TRACE_VERSION)
    throw new Error('The last-kilometre named attack needs a v91 source.');
  const teams=tour.committedInputs.teams;
  const team=teams.find(row=>row.id===teamId);
  const riderCount=teams.reduce((sum,row)=>sum+row.riders.length,0);
  if(!team||snapshot.roadGroups.length||snapshot.droppedRiderIds.length||
    snapshot.peloton.riderIds.length!==riderCount)
    throw new Error('The last-kilometre named attack needs one complete bunch.');
  const km=tour.route.distanceKm;
  if(teams.some(row=>row.orders.gcObjective!=='stage_result'||
    orderAt(row.orders,km-1).frontWork==='rotate'))
    throw new Error('The last-kilometre bridge needs recorded GC or front work.');
  const riderId=orderAt(team.orders,km-1).attackRiderId;
  if(!riderId)throw new Error('The last-kilometre attack needs a named rider.');
  const energies=new Map(snapshot.riders.map(row=>
    [row.riderId,row.energy]));
  const sourceLoad=snapshot.riderAttackLoads.find(row=>
    row.riderId===riderId)?.load;
  if(!Number.isFinite(sourceLoad))
    throw new Error('The named rider has no recorded attack load.');
  const repeatLoad=+Math.max(0,sourceLoad-
    TUNING.attack.loadRecoveryPerKm).toFixed(3);
  const slice=finaleDistanceGrid(tour.route,{remainingKm:1})[0];
  const transition=advanceFinaleNamedAttackTransition({slice,
    route:tour.route,teams,
    pelotonRiderIds:snapshot.peloton.riderIds,
    energies,attackerTeamId:teamId,attackerRiderId:riderId,
    repeatLoad});
  return {version:FINALE_LAST_KM_NAMED_ATTACK_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    sourceKm:snapshot.sourceKm,teamId,riderId,
    energyAtDecision:energies.get(riderId),
    sourceRepeatLoad:sourceLoad,repeatLoad,
    transition};
}

export function validateLastKmNamedAttackFromTour(tour,options,recorded){
  if(!isDeepStrictEqual(recorded,
    probeLastKmNamedAttackFromTour(tour,options)))
    throw new Error('The last-kilometre named attack does not replay.');
  return true;
}

// A read-only, narrow source-to-line road trace. Each short-step branch
// replays its predecessor; reaching the line does not classify riders.
export function probeLastKmNamedAttackRoadFromTour(tour,options){
  const bridge=probeLastKmNamedAttackFromTour(tour,options);
  const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1});
  const launchInput={slice:grid[0],route:tour.route,
    teams:tour.committedInputs.teams,
    pelotonRiderIds:snapshot.peloton.riderIds,
    energies:new Map(snapshot.riders.map(row=>[row.riderId,row.energy])),
    attackerTeamId:bridge.teamId,attackerRiderId:bridge.riderId,
    repeatLoad:bridge.repeatLoad};
  const launch=bridge.transition;
  const followups=[];
  const bunchFrames=[];
  for(const slice of grid.slice(1)){
    const source=bunchFrames.at(-1)??followups.at(-1)??launch;
    if(source.roadGroups.length===1){
      followups.push(followups.length?continueFinaleNamedAttackChain({
        launchInput,launch,followups,slice}):
        continueFinaleNamedAttackGroup({launchInput,launch,slice}));
    }else if(followups.length>=2){
      bunchFrames.push(continueFinaleNamedAttackLateCatchBunch({
        launchInput,launch,followups,frames:bunchFrames,slice}));
    }else if(bunchFrames.length){
      bunchFrames.push(continueFinaleNamedAttackBunchChain({
        launchInput,launch,followup:followups[0]??null,
        frames:bunchFrames,slice}));
    }else{
      bunchFrames.push(continueFinaleNamedAttackBunch({
        launchInput,launch,followup:followups[0]??null,slice}));
    }
  }
  const frames=[launch,...followups,...bunchFrames];
  const final=frames.at(-1);
  if(frames.length!==grid.length||final.endDistanceM!==
    tour.route.distanceKm*1000)
    throw new Error('The last-kilometre road trace did not reach the line.');
  return {version:FINALE_LAST_KM_NAMED_ATTACK_ROAD_VERSION,
    sourceBridgeVersion:bridge.version,sourceKm:bridge.sourceKm,
    teamId:bridge.teamId,riderId:bridge.riderId,frames,
    lineRoadGroups:final.roadGroups,
    linePelotonRiderIds:final.pelotonRiderIds,
    lineRiderEnergy:final.riderEnergy};
}

export function validateLastKmNamedAttackRoadFromTour(tour,options,recorded){
  if(!isDeepStrictEqual(recorded,
    probeLastKmNamedAttackRoadFromTour(tour,options)))
    throw new Error('The last-kilometre road trace does not replay.');
  return true;
}
