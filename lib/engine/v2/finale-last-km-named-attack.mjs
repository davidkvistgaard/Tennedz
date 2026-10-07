import {isDeepStrictEqual} from 'node:util';
import {finaleDistanceGrid} from './finale-grid.mjs';
import {advanceFinaleNamedAttackTransition} from
  './finale-named-attack-transition.mjs';
import {finaleSnapshotFromTour} from './finale-snapshot.mjs';
import {orderAt} from './orders.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,TUNING} from './tuning.mjs';

export const FINALE_LAST_KM_NAMED_ATTACK_VERSION=
  'v2-finale-last-km-named-attack-1';

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
