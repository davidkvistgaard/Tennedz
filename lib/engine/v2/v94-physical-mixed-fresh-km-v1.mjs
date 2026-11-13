// Continue a paid field when fresh source attackers join an older
// source break label. Physical roads stay separate until paid contact.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {replayV94PhysicalMixedFreshAttackSolosV1} from
  './v94-physical-mixed-fresh-attack-solo-v1.mjs';

export const V94_PHYSICAL_MIXED_FRESH_KM_VERSION=
  'v94-physical-mixed-fresh-km-3';
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
  const caught=new Set(
    prior.physicallyCaughtSourceBreakRiderIds??[]);
  const ordinaryBoundary=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km,prior,version:V94_PHYSICAL_MIXED_FRESH_BOUNDARY_VERSION});
  const forwardContact=ordinaryBoundary.choices.some(choice=>
    choice.riderIds.some(id=>previousBreak.has(id)));
  const boundary=forwardContact?
    decideV94PhysicalForwardBoundaryChoicesV1(recording,prior,{
      allowPaidMixedContact:prior.mixedPaidContactFromPrior===true||
        !!prior.contactFragmentVersion}):ordinaryBoundary;
  const freshAttackSolos=
    replayV94PhysicalMixedFreshAttackSolosV1(
      recording,prior);
  const freshIds=freshAttackSolos.roads.map(row=>row.riderId);
  const frontInput={
    km,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_MIXED_FRESH_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_MIXED_FRESH_FRONT_DECISION_VERSION,
    priorField:null,
    excludedFreshAttackRiderIds:freshIds,
    unattachedSourceRoadRiderIds:prior.sourceBreakRiderIds.filter(
      id=>!caught.has(id)),
    sourceClaimedCaughtRiderIds:[...caught],
    allowNamedChaseTurns:true};
  let namedFront,orderedEffortRefusal=null;
  try{namedFront=replayV94PhysicalFrontKmFromPriorV1(recording,
    frontInput);}
  catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km||
      !recording.frames[km-1].pelotonRestTeamIds?.length)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    namedFront=replayV94PhysicalFrontKmFromPriorV1(recording,{
      ...frontInput,recordedRestMode:true});
  }
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
    ...(boundary.choices.some(row=>row.mixedPaidContact)?{
      mixedPaidContactFromPrior:true}:{}),
    ...(caught.size?{
      physicallyCaughtSourceBreakRiderIds:[...caught],
      physicalCaughtQuietKmByRider:
        mixed.physicalCaughtQuietKmByRider}:{}),
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:[...recording.frames[km-1]
        .pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalMixedFreshKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalMixedFreshKmV1(recording,prior)))
    throw new Error('Mixed fresh km differs from paid source.');
  return true;
}
