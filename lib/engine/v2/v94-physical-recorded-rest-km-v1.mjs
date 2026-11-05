// Replay a recorded peloton ease decision when the ordered-effort
// physical front disagrees with source energy. Reduced effort can
// cause real front drops; every remaining road must still pay and meet.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {replayV94PhysicalUnattachedSourceNextKmV1} from
  './v94-physical-unattached-source-next-km-v1.mjs';

export const V94_PHYSICAL_RECORDED_REST_KM_VERSION=
  'v94-physical-recorded-rest-km-1';
export const V94_PHYSICAL_RECORDED_REST_FRONT_VERSION=
  'v94-physical-recorded-rest-front-1';
export const V94_PHYSICAL_RECORDED_REST_FRONT_DECISION_VERSION=
  'v94-physical-recorded-rest-front-decision-1';
export const V94_PHYSICAL_RECORDED_REST_REAR_DECISION_VERSION=
  'v94-physical-recorded-rest-rear-decision-1';
export const V94_PHYSICAL_RECORDED_REST_BOUNDARY_VERSION=
  'v94-physical-recorded-rest-boundary-1';

export function replayV94PhysicalRecordedRestKmV1(
  recording,prior,{provisionalFrontDropContacts=false}={}){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  if(!Number.isInteger(km)||km<8||
    recording.route.kilometres[km-1]?.km!==km||
    !prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length||
    !Array.isArray(frame?.pelotonRestTeamIds)||
    !frame.pelotonRestTeamIds.length)
    throw new Error('Recorded rest needs paid prior field and source ease.');
  let orderedEffortRefusal=null;
  try{
    replayV94PhysicalUnattachedSourceNextKmV1(
      recording,prior);
  }catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
  }
  if(!orderedEffortRefusal)
    throw new Error('Recorded rest needs a measured energy mismatch.');
  const sourceBreakIds=new Set(prior.sourceBreakRiderIds);
  const ordinaryBoundary=decideV94PhysicalBoundaryFromPriorV1(
    recording,{km,prior,
      version:V94_PHYSICAL_RECORDED_REST_BOUNDARY_VERSION});
  const forwardContact=ordinaryBoundary.choices.some(choice=>
    choice.riderIds.some(id=>sourceBreakIds.has(id)));
  const boundary=forwardContact?
    decideV94PhysicalForwardBoundaryChoicesV1(recording,prior):
    ordinaryBoundary;
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km,prior,frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_RECORDED_REST_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_RECORDED_REST_FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:prior.sourceBreakRiderIds,
    recordedRestMode:true,allowNamedChaseTurns:true});
  const settled=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_RECORDED_REST_KM_VERSION,
    decisionVersion:
      V94_PHYSICAL_RECORDED_REST_REAR_DECISION_VERSION,
    provisionalFrontDropContacts});
  return {...settled,priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRiderIds:[...prior.sourceBreakRiderIds],
    recordedSourceRestTeamIds:[...frame.pelotonRestTeamIds],
    orderedEffortRefusal,
    sourceRestDecisionUsed:true,
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}

export function validateV94PhysicalRecordedRestKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalRecordedRestKmV1(recording,prior)))
    throw new Error('Recorded rest km differs from paid source.');
  return true;
}
