import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedChaseRotationFromTour,
  recordFinaleConcurrentNamedSelectiveRotationFromTour,
  recordFinaleConcurrentNamedMultiSelectiveRotationFromTour} from
  './finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_RELATIVE_ARRIVALS_VERSION=
  'v2-finale-concurrent-relative-arrivals-1';
export const FINALE_CONCURRENT_SELECTIVE_RELATIVE_ARRIVALS_VERSION=
  'v2-finale-concurrent-selective-relative-arrivals-2';
export const FINALE_CONCURRENT_MULTI_SELECTIVE_RELATIVE_ARRIVALS_VERSION=
  'v2-finale-concurrent-multi-selective-relative-arrivals-3';

// Compare paid arrival times at the same 250 m boundary without inventing
// the following road-group contact, drafting or finishing order.
function recordConcurrentRelativeArrivals(tour,{launch,version}){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
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
  // At the earlier rider's arrival, estimate how far the later rider is
  // behind using both riders' slice-average speeds. The estimate is
  // diagnostic and does not decide whether they share a group.
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
  return {version,
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
    ...(launch.selectiveDecision?{
      selectiveDecision:launch.selectiveDecision}:{}),
    ...(launch.selectiveDecisions?{
      selectiveDecisions:launch.selectiveDecisions}:{}),
    roadRelationshipStatus:'unresolved',
    riderEnergy:launch.riderEnergy,riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function recordFinaleConcurrentRelativeArrivalsFromTour(tour){
  return recordConcurrentRelativeArrivals(tour,{
    launch:recordFinaleConcurrentNamedChaseRotationFromTour(tour),
    version:FINALE_CONCURRENT_RELATIVE_ARRIVALS_VERSION});
}

export function recordFinaleConcurrentSelectiveRelativeArrivalsFromTour(tour){
  return recordConcurrentRelativeArrivals(tour,{
    launch:recordFinaleConcurrentNamedSelectiveRotationFromTour(tour),
    version:FINALE_CONCURRENT_SELECTIVE_RELATIVE_ARRIVALS_VERSION});
}

export function recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
  tour){
  return recordConcurrentRelativeArrivals(tour,{
    launch:recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(tour),
    version:FINALE_CONCURRENT_MULTI_SELECTIVE_RELATIVE_ARRIVALS_VERSION});
}

export function validateFinaleConcurrentRelativeArrivalsFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentRelativeArrivalsFromTour(tour)))
    throw new Error('Concurrent relative arrivals do not replay.');
  return true;
}

export function validateFinaleConcurrentSelectiveRelativeArrivalsFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentSelectiveRelativeArrivalsFromTour(tour)))
    throw new Error('Concurrent selective relative arrivals do not replay.');
  return true;
}

export function validateFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentMultiSelectiveRelativeArrivalsFromTour(tour)))
    throw new Error('Concurrent multi-selective relative arrivals do not replay.');
  return true;
}
