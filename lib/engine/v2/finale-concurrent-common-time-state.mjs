import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedMultiSelectiveRotationFromTour} from
  './finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour} from
  './finale-concurrent-relative-arrivals.mjs';

export const FINALE_CONCURRENT_COMMON_TIME_STATE_VERSION=
  'v2-finale-concurrent-common-time-state-1';

// Put the paid 250 m trajectories on one clock: the instant the first
// attacker reaches the slice boundary. Full-slice work remains in the source
// launch; this projection pays only the distance each rider has reached.
// Constant slice-average speed is an explicit interpolation assumption, not
// a road-contact or drafting decision.
export function recordFinaleConcurrentCommonTimeStateFromTour(tour){
  const launch=recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(tour);
  const relative=recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
    tour);
  const eventElapsedSeconds=relative.arrivals[0].elapsedSeconds;
  const lengthM=launch.endDistanceM-launch.startDistanceM;
  const attackById=new Map(launch.attacks.map(row=>[row.riderId,row]));
  const riders=launch.riderEnergy.map(row=>{
    const attack=attackById.get(row.riderId);
    const fullSliceSeconds=attack?.frontSeconds??launch.bunchElapsedSeconds;
    const distanceRiddenM=lengthM*eventElapsedSeconds/fullSliceSeconds;
    const energySpentToEvent=row.energySpent*distanceRiddenM/lengthM;
    return {riderId:row.riderId,role:row.role,
      fullSliceSeconds,
      positionM:launch.startDistanceM+distanceRiddenM,
      distanceRiddenM,
      energyAtDecision:row.energyAtDecision,
      energySpentToEvent,
      energyAtEvent:row.energyAtDecision-energySpentToEvent,
      energyCostRemainingToBoundary:row.energySpent-energySpentToEvent,
      fullSliceEnergyAfter:row.energyAfter};
  });
  const positions=new Map(riders.map(row=>[row.riderId,row.positionM]));
  const bunchPositionM=riders.find(row=>row.role!=='attack')?.positionM;
  if(riders.length!==new Set(riders.map(row=>row.riderId)).size||
    !Number.isFinite(eventElapsedSeconds)||eventElapsedSeconds<=0||
    !Number.isFinite(bunchPositionM)||
    riders.some(row=>!Number.isFinite(row.positionM)||
      row.positionM<launch.startDistanceM-1e-9||
      row.positionM>launch.endDistanceM+1e-9||
      !Number.isFinite(row.energyAtEvent)||row.energyAtEvent< -1e-9||
      row.energyCostRemainingToBoundary< -1e-9||
      Math.abs(row.energyAtEvent-
        row.energyCostRemainingToBoundary-
        row.fullSliceEnergyAfter)>1e-8||
      row.role!=='attack'&&
        Math.abs(row.positionM-bunchPositionM)>1e-8)||
    relative.arrivals.some(row=>!positions.has(row.riderId)))
    throw new Error('Concurrent common-time state has invalid paid positions.');
  const attackerPositions=relative.arrivals.map(row=>({
    riderId:row.riderId,positionM:positions.get(row.riderId)}));
  if(Math.abs((attackerPositions[0].positionM-
    attackerPositions[1].positionM)-
    relative.estimatedSeparationM)>1e-8)
    throw new Error('Concurrent common-time separation disagrees with arrivals.');
  return {version:FINALE_CONCURRENT_COMMON_TIME_STATE_VERSION,
    sourceLaunchVersion:launch.version,
    sourceRelativeVersion:relative.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:launch.startDistanceM,
    plannedEndDistanceM:launch.endDistanceM,
    eventElapsedSeconds,
    event:'first_attacker_at_slice_boundary',
    attackerPositions,
    separationM:relative.estimatedSeparationM,
    bunchPositionM,
    selectiveDecisions:launch.selectiveDecisions,
    riders,
    riderAttackLoad:relative.riderAttackLoad,
    roadRelationshipStatus:'unresolved',
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentCommonTimeStateFromTour(tour,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentCommonTimeStateFromTour(tour)))
    throw new Error('Concurrent common-time state does not replay.');
  return true;
}
