import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedChaseRotationFromTour} from
  './finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_RELATIVE_ARRIVALS_VERSION=
  'v2-finale-concurrent-relative-arrivals-1';

// Compare paid arrival times at the same 250 m boundary without inventing
// the following road-group contact, drafting or finishing order.
export function recordFinaleConcurrentRelativeArrivalsFromTour(tour){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const launch=recordFinaleConcurrentNamedChaseRotationFromTour(tour);
  const split=launch.attacks.filter(row=>row.status==='split');
  if(split.length!==2||launch.attacks.length!==2)
    throw new Error('Relative arrivals need exactly two surviving named attacks.');
  const arrivals=split.map(row=>({
    riderId:row.riderId,teamId:row.teamId,
    elapsedSeconds:row.frontSeconds,
    gapToBunchSeconds:row.earnedGapSeconds}))
    .sort((a,b)=>a.elapsedSeconds-b.elapsedSeconds||
      a.riderId.localeCompare(b.riderId));
  const separationSeconds=arrivals[1].elapsedSeconds-
    arrivals[0].elapsedSeconds;
  // A distance interpretation assumes each rider held their slice-average
  // speed; it is diagnostic and does not decide whether they share a group.
  const estimatedSeparationM=(launch.endDistanceM-
    launch.startDistanceM)*separationSeconds/
    arrivals[1].elapsedSeconds;
  const attackById=new Map(launch.attacks.map(row=>[row.riderId,row]));
  const riderAttackLoad=field.riders.map(row=>{
    const loadAtDecision=+Math.max(0,row.attackLoad-
      TUNING.attack.loadRecoveryPerKm).toFixed(3);
    return {riderId:row.riderId,loadAtDecision,
      loadAfter:attackById.get(row.riderId)?.repeatLoadAfter??
        loadAtDecision};
  });
  if(!Number.isFinite(separationSeconds)||separationSeconds<0||
    !Number.isFinite(estimatedSeparationM)||
    estimatedSeparationM<0||
    launch.riderEnergy.length!==field.riders.length||
    new Set(launch.riderEnergy.map(row=>row.riderId)).size!==
      field.riders.length)
    throw new Error('Concurrent relative arrivals lost paid source riders.');
  return {version:FINALE_CONCURRENT_RELATIVE_ARRIVALS_VERSION,
    sourceLaunchVersion:launch.version,
    sourceFieldVersion:field.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:launch.startDistanceM,
    endDistanceM:launch.endDistanceM,
    bunchElapsedSeconds:launch.bunchElapsedSeconds,
    arrivals,separationSeconds,estimatedSeparationM,
    earlierRiderId:separationSeconds>0?
      arrivals[0].riderId:null,
    roadRelationshipStatus:'unresolved',
    riderEnergy:launch.riderEnergy,riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentRelativeArrivalsFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentRelativeArrivalsFromTour(tour)))
    throw new Error('Concurrent relative arrivals do not replay.');
  return true;
}
