import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {advanceFinaleNamedAttackRotationTransition} from
  './finale-named-attack-rotation-transition.mjs';
import {continueFinaleNamedAttackRotationCatch} from
  './finale-named-attack-rotation-followup.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,TUNING} from './tuning.mjs';

export const FINALE_LAST_KM_ROTATION_CATCH_VERSION=
  'v2-finale-last-km-rotation-catch-1';

// Shared validated v91 boundary for separate caught and contained branches.
export function prepareLastKmRotationFromTour(tour,{teamId}){
  const snapshot=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  if(snapshot.sourceTuningVersion!==MOTOR_ATTACK_TRACE_VERSION)
    throw new Error('The rotating catch needs a v91 source.');
  const teams=tour.committedInputs.teams;
  const attacker=teams.find(team=>team.id===teamId);
  const riderIds=teams.flatMap(team=>team.riders.map(rider=>rider.id));
  if(!attacker||snapshot.roadGroups.length||
    snapshot.droppedRiderIds.length||
    snapshot.peloton.riderIds.length!==riderIds.length||
    new Set(snapshot.peloton.riderIds).size!==riderIds.length)
    throw new Error('The rotating catch needs one complete bunch.');
  const km=tour.route.distanceKm;
  if(teams.some(team=>team.orders.gcObjective!=='stage_result'||
    team.id!==teamId&&
      orderAt(team.orders,km-1).attack!=='none'))
    throw new Error('The rotating catch needs one named attack and stage orders.');
  const riderId=orderAt(attacker.orders,km-1).attackRiderId;
  if(!riderId)
    throw new Error('The rotating catch needs a named rider.');
  const sourceRepeatLoad=snapshot.riderAttackLoads.find(row=>
    row.riderId===riderId)?.load;
  if(!Number.isFinite(sourceRepeatLoad))
    throw new Error('The named rider has no recorded attack load.');
  const repeatLoad=+Math.max(0,sourceRepeatLoad-
    TUNING.attack.loadRecoveryPerKm).toFixed(3);
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1});
  const launchInput={slice:grid[0],route:tour.route,teams,
    pelotonRiderIds:snapshot.peloton.riderIds,
    energies:new Map(snapshot.riders.map(row=>[row.riderId,row.energy])),
    attackerTeamId:teamId,attackerRiderId:riderId,repeatLoad};
  const launch=advanceFinaleNamedAttackRotationTransition(launchInput);
  return {snapshot,riderIds,km,teamId,riderId,sourceRepeatLoad,
    repeatLoad,grid,launchInput,launch};
}

export function recordLastKmRotationAt500M({frame,launch,km,riderIds}){
  const at500M={distanceM:frame.endDistanceM,
    pelotonRiderIds:frame.pelotonRiderIds,
    roadGroups:frame.roadGroups,
    riderEnergy:frame.riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter})),
    bunchElapsedSeconds:launch.bunchElapsedSeconds+
      frame.bunchElapsedSeconds};
  if(at500M.distanceM!==km*1000-500||
    at500M.roadGroups.length||
    !isDeepStrictEqual([...at500M.pelotonRiderIds].sort(),
      [...riderIds].sort())||
    !isDeepStrictEqual(at500M.riderEnergy.map(row=>row.riderId).sort(),
      [...riderIds].sort())||
    !Number.isFinite(at500M.bunchElapsedSeconds)||
    at500M.riderEnergy.some(row=>!Number.isFinite(row.energy)||
      row.energy<0))
    throw new Error('The rotating attack has an incomplete 500 m state.');
  return at500M;
}

// Read-only source handoff through an actual mid-slice catch at 500 m to go.
// This stops before any sprint, individual finish, classification or points.
export function probeLastKmRotationCatchFromTour(tour,options){
  const {snapshot,riderIds,km,teamId,riderId,sourceRepeatLoad,
    repeatLoad,grid,launchInput,launch}=
      prepareLastKmRotationFromTour(tour,options);
  const catchFrame=continueFinaleNamedAttackRotationCatch({
    launchInput,launch,slice:grid[1]});
  const at500M=recordLastKmRotationAt500M({frame:catchFrame,launch,
    km,riderIds});
  return {version:FINALE_LAST_KM_ROTATION_CATCH_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    sourceKm:snapshot.sourceKm,teamId,riderId,
    sourceRepeatLoad,repeatLoad,frames:[launch,catchFrame],at500M};
}

export function validateLastKmRotationCatchFromTour(tour,options,recorded){
  if(!isDeepStrictEqual(recorded,
    probeLastKmRotationCatchFromTour(tour,options)))
    throw new Error('The source-linked rotating catch does not replay.');
  return true;
}
