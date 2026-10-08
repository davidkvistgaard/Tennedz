import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedAllChaseFromTour} from
  './finale-concurrent-named-all-chase.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_ALL_CHASE_CONTACT_VERSION=
  'v2-finale-concurrent-named-all-chase-contact-1';

// Carry the paid rival helper into the unambiguous zero/one-split road state.
// Two surviving attackers still need a relative-contact rule.
export function recordFinaleConcurrentNamedAllChaseContactFromTour(tour){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const launch=recordFinaleConcurrentNamedAllChaseFromTour(tour);
  const split=launch.attacks.filter(row=>row.status==='split');
  if(split.length>1)
    throw new Error('Two surviving chased attacks need a relative road-contact rule.');
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
  const riderAttackLoad=field.riders.map(row=>{
    const loadAtDecision=+Math.max(0,row.attackLoad-
      TUNING.attack.loadRecoveryPerKm).toFixed(3);
    return {riderId:row.riderId,loadAtDecision,
      loadAfter:attackById.get(row.riderId)?.repeatLoadAfter??
        loadAtDecision};
  });
  const riderIds=field.riders.map(row=>row.riderId);
  if(!isDeepStrictEqual([...pelotonRiderIds,
    ...roadGroups.flatMap(group=>group.riderIds)].sort(),
  [...riderIds].sort())||
    launch.riderEnergy.length!==riderIds.length||
    launch.riderEnergy.filter(row=>row.role==='chase').length!==1||
    riderAttackLoad.some(row=>
      !Number.isFinite(row.loadAfter)||row.loadAfter<0))
    throw new Error('Concurrent chased road contact lost a rider or paid helper.');
  return {version:FINALE_CONCURRENT_NAMED_ALL_CHASE_CONTACT_VERSION,
    sourceLaunchVersion:launch.version,
    sourceFieldVersion:field.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    startDistanceM:launch.startDistanceM,
    endDistanceM:launch.endDistanceM,
    passiveBunchSpeedKph:launch.passiveBunchSpeedKph,
    bunchSpeedKph:launch.bunchSpeedKph,
    bunchElapsedSeconds:launch.bunchElapsedSeconds,
    chase:launch.chase,containedRiderIds,
    roadGroups,pelotonRiderIds,
    riderEnergy:launch.riderEnergy,riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function validateFinaleConcurrentNamedAllChaseContactFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedAllChaseContactFromTour(tour)))
    throw new Error('Concurrent chased road contact does not replay.');
  return true;
}
