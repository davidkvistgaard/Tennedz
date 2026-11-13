import {isDeepStrictEqual} from 'node:util';
import {recordFinaleConcurrentNamedChaseRotationFromTour,
  recordFinaleConcurrentNamedSelectiveRotationFromTour,
  recordFinaleConcurrentNamedMixedSelectiveRotationFromTour,
  recordFinaleConcurrentNamedInactiveSelectiveRotationFromTour} from
  './finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleLastKmFieldHandoffFromTour} from
  './finale-last-km-field-handoff.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_CONCURRENT_NAMED_CHASE_ROTATION_CONTACT_VERSION=
  'v2-finale-concurrent-named-chase-rotation-contact-1';
export const FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_CONTACT_VERSION=
  'v2-finale-concurrent-named-selective-rotation-contact-2';
export const FINALE_CONCURRENT_NAMED_MIXED_SELECTIVE_ROTATION_CONTACT_VERSION=
  'v2-finale-concurrent-named-mixed-selective-rotation-contact-3';
export const FINALE_CONCURRENT_NAMED_INACTIVE_SELECTIVE_ROTATION_CONTACT_VERSION=
  'v2-finale-concurrent-named-inactive-selective-rotation-contact-4';

// Resolve only zero or one surviving attack after the recorded independent
// rival duties. Two positive gaps still lack a relative-contact rule.
function recordConcurrentNamedChaseRotationContact(tour,{launch,version}){
  const field=recordFinaleLastKmFieldHandoffFromTour(tour);
  const split=launch.attacks.filter(row=>row.status==='split');
  if(split.length>1)
    throw new Error('Two surviving attacks need a relative road-contact rule.');
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
    launch.riderEnergy.filter(row=>row.role==='chase').length!==
      Number(Boolean(launch.chase))||
    launch.riderEnergy.filter(row=>
      row.role==='front_rotation').length!==
        (launch.rotation.selected?.work.length??0)||
    riderAttackLoad.some(row=>
      !Number.isFinite(row.loadAfter)||row.loadAfter<0))
    throw new Error('Concurrent chase-rotation contact lost a rider or paid role.');
  return {version,
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
    chase:launch.chase,rotation:launch.rotation,
    ...(launch.selectiveDecision?{
      selectiveDecision:launch.selectiveDecision}:{}),
    ...(launch.selectiveDecisions?{
      selectiveDecisions:launch.selectiveDecisions}:{}),
    ...(launch.nonlaunchingNamedDecisions?{
      nonlaunchingNamedDecisions:launch.nonlaunchingNamedDecisions}:{}),
    containedRiderIds,roadGroups,pelotonRiderIds,
    riderEnergy:launch.riderEnergy,riderAttackLoad,
    resultStatus:'unclassified',pointsStatus:'withheld'};
}

export function recordFinaleConcurrentNamedChaseRotationContactFromTour(
  tour){
  return recordConcurrentNamedChaseRotationContact(tour,{
    launch:recordFinaleConcurrentNamedChaseRotationFromTour(tour),
    version:FINALE_CONCURRENT_NAMED_CHASE_ROTATION_CONTACT_VERSION});
}

export function recordFinaleConcurrentNamedSelectiveRotationContactFromTour(
  tour){
  return recordConcurrentNamedChaseRotationContact(tour,{
    launch:recordFinaleConcurrentNamedSelectiveRotationFromTour(tour),
    version:FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_CONTACT_VERSION});
}

export function recordFinaleConcurrentNamedMixedSelectiveRotationContactFromTour(
  tour){
  return recordConcurrentNamedChaseRotationContact(tour,{
    launch:recordFinaleConcurrentNamedMixedSelectiveRotationFromTour(tour),
    version:FINALE_CONCURRENT_NAMED_MIXED_SELECTIVE_ROTATION_CONTACT_VERSION});
}

export function recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(
  tour){
  return recordConcurrentNamedChaseRotationContact(tour,{
    launch:recordFinaleConcurrentNamedInactiveSelectiveRotationFromTour(tour),
    version:FINALE_CONCURRENT_NAMED_INACTIVE_SELECTIVE_ROTATION_CONTACT_VERSION});
}

export function validateFinaleConcurrentNamedChaseRotationContactFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedChaseRotationContactFromTour(tour)))
    throw new Error('Concurrent chase-rotation contact does not replay.');
  return true;
}

export function validateFinaleConcurrentNamedSelectiveRotationContactFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedSelectiveRotationContactFromTour(tour)))
    throw new Error('Concurrent selective-rotation contact does not replay.');
  return true;
}

export function validateFinaleConcurrentNamedMixedSelectiveRotationContactFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedMixedSelectiveRotationContactFromTour(tour)))
    throw new Error('Concurrent mixed-selective contact does not replay.');
  return true;
}

export function validateFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(
  tour,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(tour)))
    throw new Error('Concurrent inactive-selective contact does not replay.');
  return true;
}
