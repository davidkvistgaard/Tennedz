// Conditional km-6 named peloton front when source turns are front work
// only. The source break plans remain unattachable and are not replayed.
import {isDeepStrictEqual} from 'node:util';
import {inspectV94PhysicalSixthSourceBoundaryV1} from
  './v94-physical-sixth-source-boundary-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';

export const V94_PHYSICAL_SIXTH_FRONT_KM_VERSION=
  'v94-physical-sixth-front-km-2';
export const V94_PHYSICAL_SIXTH_FRONT_DECISION_VERSION=
  'v94-physical-sixth-front-decision-1';

export function replayV94PhysicalSixthFrontKmV1(
  recording,prior){
  if(prior?.sourceKm!==5||!prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.freshAttackSoloRiderIds)||
    !prior.freshAttackSoloRiderIds.length)
    throw new Error('Sixth front needs paid fifth field.');
  const source=inspectV94PhysicalSixthSourceBoundaryV1(
    recording,prior);
  if(source.sourceRoads.some(row=>
    !row.sourcePlanCannotAttach))
    throw new Error(
      'Sixth front needs separate uncontacted source roads.');
  const frontInput={
    km:6,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_SIXTH_FRONT_KM_VERSION,
    decisionVersion:V94_PHYSICAL_SIXTH_FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:
      prior.freshAttackSoloRiderIds};
  let front=null,orderedEffortRefusal=null;
  try{
    front=replayV94PhysicalFrontKmFromPriorV1(recording,
      frontInput);
  }catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==6)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    front=replayV94PhysicalFrontKmFromPriorV1(recording,{
      ...frontInput,recordedRestMode:true});
  }
  return {...front,priorSourceKm:5,priorVersion:prior.version,
    sourceBoundaryVersion:source.version,
    sourceBreakRoadNotPhysical:true,
    conditionalOnNoForwardContact:true,
    remainingFieldRoadUnresolved:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:[...recording.frames[5]
        .pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalSixthFrontKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalSixthFrontKmV1(recording,prior)))
    throw new Error('Sixth front differs from paid source.');
  return true;
}
