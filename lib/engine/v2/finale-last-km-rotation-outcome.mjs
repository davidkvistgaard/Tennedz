import {isDeepStrictEqual} from 'node:util';
import {prepareLastKmRotationFromTour,
  probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationContainedFromTour} from
  './finale-last-km-rotation-contained.mjs';
import {probeLastKmRotationSoloFromTour} from
  './finale-last-km-rotation-solo.mjs';
import {probeFinaleNamedAttackRotationFollowupOutcome} from
  './finale-named-attack-rotation-followup.mjs';

export const FINALE_LAST_KM_ROTATION_OUTCOME_VERSION=
  'v2-finale-last-km-rotation-outcome-1';

// Derive the 500 m handoff branch from the paid launch and follow-up.
// A high-fatigue rider caught before 500 m is not a solo source.
export function decideLastKmRotationOutcomeFromTour(tour,{teamId}){
  const prepared=prepareLastKmRotationFromTour(tour,{teamId});
  const {snapshot,grid,launchInput,launch}=prepared;
  let branch,bridge;
  if(launch.roadGroups.length===0){
    branch='contained';
    bridge=probeLastKmRotationContainedFromTour(tour,{teamId});
  }else if(launch.roadGroups.length===1){
    const next=probeFinaleNamedAttackRotationFollowupOutcome({
      launchInput,launch,slice:grid[1]});
    branch=next.catchDistanceM===undefined?'solo':'caught';
    bridge=branch==='solo'?
      probeLastKmRotationSoloFromTour(tour,{teamId}):
      probeLastKmRotationCatchFromTour(tour,{teamId});
    if(!isDeepStrictEqual(next,bridge.frames[1]))
      throw new Error('The selected 500 m branch does not replay.');
  }else{
    throw new Error('The last-kilometre outcome needs one launch group.');
  }
  return {version:FINALE_LAST_KM_ROTATION_OUTCOME_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    branch,sourceBridgeVersion:bridge.version,
    catchDistanceM:branch==='caught'?
      bridge.frames[1].catchDistanceM:null,
    handoffDistanceM:bridge.at500M.distanceM,
    roadGroupCount:bridge.at500M.roadGroups.length,
    pelotonRiderCount:bridge.at500M.pelotonRiderIds.length,
    riderEnergyCount:bridge.at500M.riderEnergy.length,
    bunchElapsedSecondsAt500M:bridge.at500M.bunchElapsedSeconds,
    resultStatus:'unclassified'};
}

export function validateLastKmRotationOutcomeFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    decideLastKmRotationOutcomeFromTour(tour,input)))
    throw new Error('The last-kilometre outcome does not replay.');
  return true;
}
