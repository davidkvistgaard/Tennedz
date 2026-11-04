// Continue a paid field when fresh source attackers join an older
// source break label. Physical roads stay separate until paid contact.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {replayV94PhysicalMixedFreshAttackSolosV1} from
  './v94-physical-mixed-fresh-attack-solo-v1.mjs';

export const V94_PHYSICAL_MIXED_FRESH_KM_VERSION=
  'v94-physical-mixed-fresh-km-1';
export const V94_PHYSICAL_MIXED_FRESH_BOUNDARY_VERSION=
  'v94-physical-mixed-fresh-boundary-1';
export const V94_PHYSICAL_MIXED_FRESH_FRONT_VERSION=
  'v94-physical-mixed-fresh-front-1';
export const V94_PHYSICAL_MIXED_FRESH_FRONT_DECISION_VERSION=
  'v94-physical-mixed-fresh-front-decision-1';
export const V94_PHYSICAL_MIXED_FRESH_REAR_DECISION_VERSION=
  'v94-physical-mixed-fresh-rear-decision-1';

export function replayV94PhysicalMixedFreshKmV1(recording,prior){
  if(!Number.isInteger(prior?.sourceKm)||prior.sourceKm<7||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length)
    throw new Error('Mixed fresh km needs paid prior field.');
  const km=prior.sourceKm+1;
  const previousBreak=new Set(prior.sourceBreakRiderIds);
  const boundary=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km,prior,version:V94_PHYSICAL_MIXED_FRESH_BOUNDARY_VERSION});
  if(boundary.choices.some(choice=>
    choice.riderIds.some(id=>previousBreak.has(id))))
    throw new Error(
      'Mixed fresh forward contact needs a paid break-work choice.');
  const freshAttackSolos=
    replayV94PhysicalMixedFreshAttackSolosV1(
      recording,prior);
  const freshIds=freshAttackSolos.roads.map(row=>row.riderId);
  const namedFront=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_MIXED_FRESH_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_MIXED_FRESH_FRONT_DECISION_VERSION,
    priorField:null,
    excludedFreshAttackRiderIds:freshIds,
    unattachedSourceRoadRiderIds:prior.sourceBreakRiderIds});
  if(Math.abs(namedFront.frontClockSeconds-
    freshAttackSolos.frontClockSeconds)>1e-7)
    throw new Error('Mixed fresh front disagrees with attack clock.');
  const front={...namedFront,freshAttackSolos,
    sourceBreakRoadNotPhysical:true,
    remainingFieldRoadUnresolved:true,
    officialResults:false};
  const mixed=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_MIXED_FRESH_KM_VERSION,
    decisionVersion:
      V94_PHYSICAL_MIXED_FRESH_REAR_DECISION_VERSION});
  return {...mixed,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRiderIds:[...prior.sourceBreakRiderIds,
      ...freshIds],
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}

export function validateV94PhysicalMixedFreshKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalMixedFreshKmV1(recording,prior)))
    throw new Error('Mixed fresh km differs from paid source.');
  return true;
}
