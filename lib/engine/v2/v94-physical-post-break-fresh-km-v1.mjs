// Pay fresh source attackers after an older source break claim ends.
// Former break riders remain on their earlier physical rear roads.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFreshAttackSolosV1} from
  './v94-physical-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_POST_BREAK_FRESH_KM_VERSION=
  'v94-physical-post-break-fresh-km-1';
export const V94_PHYSICAL_POST_BREAK_FRESH_BOUNDARY_VERSION=
  'v94-physical-post-break-fresh-boundary-1';
export const V94_PHYSICAL_POST_BREAK_FRESH_FRONT_VERSION=
  'v94-physical-post-break-fresh-front-1';
export const V94_PHYSICAL_POST_BREAK_FRESH_FRONT_DECISION_VERSION=
  'v94-physical-post-break-fresh-front-decision-1';
export const V94_PHYSICAL_POST_BREAK_FRESH_REAR_DECISION_VERSION=
  'v94-physical-post-break-fresh-rear-decision-1';

export function replayV94PhysicalPostBreakFreshKmV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  if(!Number.isInteger(km)||km<8||
    !prior.fullFieldKilometre||
    prior.sourceBreakMembershipEnded!==true||
    prior.sourceCheckpointCalibrationFailed!==true||
    prior.sourceBreakRiderIds?.length!==0||
    !prior.formerSourceBreakRiderIds?.length)
    throw new Error('Post-break fresh km needs paid rear history.');
  const solos=replayV94PhysicalFreshAttackSolosV1(
    recording,prior);
  if(solos.sourceKm!==km||!solos.roads.length)
    throw new Error('Post-break fresh km needs paid launch.');
  const freshIds=solos.roads.map(row=>row.riderId);
  const boundary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,
      version:V94_PHYSICAL_POST_BREAK_FRESH_BOUNDARY_VERSION});
  const frontInput={km,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_POST_BREAK_FRESH_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_POST_BREAK_FRESH_FRONT_DECISION_VERSION,
    priorField:null,
    excludedFreshAttackRiderIds:freshIds,
    allowNamedChaseTurns:true};
  let namedFront,orderedEffortRefusal=null;
  try{
    namedFront=replayV94PhysicalFrontKmFromPriorV1(
      recording,frontInput);
  }catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km||
      !recording.frames[km-1].pelotonRestTeamIds?.length)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    namedFront=replayV94PhysicalFrontKmFromPriorV1(
      recording,{...frontInput,recordedRestMode:true});
  }
  if(Math.abs(namedFront.frontClockSeconds-
    solos.frontClockSeconds)>1e-7)
    throw new Error('Post-break attack and front clocks differ.');
  const front={...namedFront,freshAttackSolos:solos,
    sourceBreakRoadNotPhysical:true,
    officialResults:false};
  const settled=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_POST_BREAK_FRESH_KM_VERSION,
    decisionVersion:
      V94_PHYSICAL_POST_BREAK_FRESH_REAR_DECISION_VERSION});
  return {...settled,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    formerSourceBreakRiderIds:
      [...prior.formerSourceBreakRiderIds],
    sourceBreakRiderIds:freshIds,
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:[...recording.frames[km-1]
        .pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalPostBreakFreshKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalPostBreakFreshKmV1(recording,prior)))
    throw new Error('Post-break fresh km differs from paid source.');
  return true;
}
