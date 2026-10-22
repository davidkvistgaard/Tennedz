import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedLaunchFromTour} from
  './finale-concurrent-named-launch.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_ROAD_CONTACT_VERSION=
  'v2-finale-concurrent-named-road-contact-1';

// Resolve only the unambiguous zero/one-split branch of a paid concurrent
// launch. Two riders ahead still need an explicit relative-contact rule.
export function recordFinaleConcurrentNamedRoadContactFromTour(tour){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const launch=recordFinaleConcurrentNamedLaunchFromTour(tour);
  const split=launch.attacks.filter(row=>row.status==='split');
  if(split.length>1)
    throw new Error('Two surviving concurrent attacks need a relative road-contact rule.');
  const ahead=split[0]??null;
  const containedRiderIds=launch.attacks.filter(row=>
    row.status==='contained').map(row=>row.riderId);
  const pelotonRiderIds=field.pelotonRiderIds.filter(id=>
    id!==ahead?.riderId);
  const roadGroups=ahead?[{
    id:`launch:${ahead.riderId}:${launch.startDistanceM}`,
    riderIds:[ahead.riderId],teamIds:[ahead.teamId],
    gapSeconds:ahead.earnedGapSeconds}]:[];
  const attackById=new Map(launch.attacks.map(row=>[row.riderId,row]));
  const riderAttackLoad=field.riders.map(row=>({
    riderId:row.riderId,
    loadAtDecision:+Math.max(0,row.attackLoad-
      TUNING.attack.loadRecoveryPerKm).toFixed(3),
    loadAfter:attackById.get(row.riderId)?.repeatLoadAfter??
      +Math.max(0,row.attackLoad-
        TUNING.attack.loadRecoveryPerKm).toFixed(3)}));
  const riderIds=field.riders.map(row=>row.riderId);
  if(!isDeepStrictEqual([...pelotonRiderIds,
    ...roadGroups.flatMap(group=>group.riderIds)].sort(),
  [...riderIds].sort())||
    launch.riderEnergy.length!==riderIds.length||
    riderAttackLoad.some(row=>
      !Number.isFinite(row.loadAfter)||row.loadAfter<0))
    throw new Error('Concurrent road contact lost a rider or attack load.');
  return {version:FINALE_CONCURRENT_NAMED_ROAD_CONTACT_VERSION,
    sourceLaunchVersion:launch.version,
    sourceFieldVersion:field.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:launch.startDistanceM,
    endDistanceM:launch.endDistanceM,
    bunchElapsedSeconds:launch.bunchElapsedSeconds,
    containedRiderIds,roadGroups,pelotonRiderIds,
    riderEnergy:launch.riderEnergy,
    riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNamedRoadContactFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedRoadContactFromTour(tour)))
    throw new Error('Concurrent named road contact does not replay.');
  return true;
}
