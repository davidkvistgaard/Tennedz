import {isDeepStrictEqual} from 'node:util';
import {prepareLastKmRotationFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {continueFinaleNamedAttackRotationGroup} from
  './finale-named-attack-rotation-followup.mjs';

export const FINALE_LAST_KM_ROTATION_SOLO_VERSION=
  'v2-finale-last-km-rotation-solo-1';

// The third actual outcome of the validated named-attack transition: the
// attacker remains in a separate road group after two paid 250 m slices.
// This is a source handoff, not a claim that the solo rider survives to line.
export function probeLastKmRotationSoloFromTour(tour,options){
  const {snapshot,riderIds,km,teamId,riderId,sourceRepeatLoad,
    repeatLoad,grid,launchInput,launch}=
      prepareLastKmRotationFromTour(tour,options);
  const followup=continueFinaleNamedAttackRotationGroup({
    launchInput,launch,slice:grid[1]});
  const at500M={distanceM:followup.endDistanceM,
    pelotonRiderIds:[...followup.pelotonRiderIds],
    roadGroups:followup.roadGroups.map(group=>({
      ...group,riderIds:[...group.riderIds],
      teamIds:[teamId]})),
    riderEnergy:followup.riderEnergy.map(row=>({
      riderId:row.riderId,energy:row.energyAfter})),
    bunchElapsedSeconds:launch.bunchElapsedSeconds+
      followup.bunchElapsedSeconds};
  if(at500M.distanceM!==km*1000-500||
    at500M.roadGroups.length!==1||
    !isDeepStrictEqual(at500M.roadGroups[0].riderIds,[riderId])||
    !(at500M.roadGroups[0].gapSeconds>0)||
    at500M.pelotonRiderIds.includes(riderId)||
    !isDeepStrictEqual([...at500M.pelotonRiderIds,
      ...at500M.roadGroups[0].riderIds].sort(),[...riderIds].sort())||
    !isDeepStrictEqual(at500M.riderEnergy.map(row=>
      row.riderId).sort(),[...riderIds].sort())||
    !Number.isFinite(at500M.bunchElapsedSeconds)||
    at500M.riderEnergy.some(row=>!Number.isFinite(row.energy)||
      row.energy<0))
    throw new Error('The solo attack has an incomplete 500 m state.');
  return {version:FINALE_LAST_KM_ROTATION_SOLO_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    sourceKm:snapshot.sourceKm,teamId,riderId,
    sourceRepeatLoad,repeatLoad,frames:[launch,followup],at500M};
}

export function validateLastKmRotationSoloFromTour(tour,options,recorded){
  if(!isDeepStrictEqual(recorded,
    probeLastKmRotationSoloFromTour(tour,options)))
    throw new Error('The source-linked solo attack does not replay.');
  return true;
}
