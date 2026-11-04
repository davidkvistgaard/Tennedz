// Continue only a physically paid mixed rear group. Source break
// membership remains a claim, while work follows each rider's order.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalForwardBoundaryChoicesV1} from
  './v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_MIXED_PAID_NEXT_KM_VERSION=
  'v94-physical-mixed-paid-next-km-1';
export const V94_PHYSICAL_MIXED_PAID_FRONT_VERSION=
  'v94-physical-mixed-paid-front-1';
export const V94_PHYSICAL_MIXED_PAID_FRONT_DECISION_VERSION=
  'v94-physical-mixed-paid-front-decision-1';
export const V94_PHYSICAL_MIXED_PAID_REAR_DECISION_VERSION=
  'v94-physical-mixed-paid-rear-decision-1';

export function replayV94PhysicalMixedPaidNextKmV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  if(!Number.isInteger(km)||km<9||
    recording.route.kilometres[km-1]?.km!==km||
    !prior.fullFieldKilometre||
    !prior.contactFragmentVersion||
    prior.sourceCheckpointCalibrationFailed!==true||
    !Array.isArray(prior.sourceBreakRiderIds)||
    !prior.sourceBreakRiderIds.length)
    throw new Error('Mixed paid km needs contact-settled field.');
  const boundary=decideV94PhysicalForwardBoundaryChoicesV1(
    recording,prior,{allowPaidMixedContact:true});
  if(!boundary.choices.some(row=>row.mixedPaidContact))
    throw new Error('Mixed paid km needs physical mixed contact.');
  const frontInput={km,prior,
    frontClockSeconds:prior.front.frontClockSeconds,
    version:V94_PHYSICAL_MIXED_PAID_FRONT_VERSION,
    decisionVersion:
      V94_PHYSICAL_MIXED_PAID_FRONT_DECISION_VERSION,
    priorField:null,
    unattachedSourceRoadRiderIds:prior.sourceBreakRiderIds};
  let front=null,orderedEffortRefusal=null;
  try{
    front=replayV94PhysicalFrontKmFromPriorV1(
      recording,frontInput);
  }catch(error){
    if(error.message!==
      'Attached front energy differs from V94 source.'||
      error.sourceEvidence?.sourceKm!==km)
      throw error;
    orderedEffortRefusal=error.sourceEvidence;
    front=replayV94PhysicalFrontKmFromPriorV1(recording,{
      ...frontInput,recordedRestMode:true});
  }
  const settled=replayV94PhysicalRearKmFromPriorV1(recording,{
    km,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_MIXED_PAID_NEXT_KM_VERSION,
    decisionVersion:
      V94_PHYSICAL_MIXED_PAID_REAR_DECISION_VERSION});
  return {...settled,
    priorSourceKm:prior.sourceKm,
    priorVersion:prior.version,
    sourceBreakRiderIds:[...prior.sourceBreakRiderIds],
    mixedPaidContactFromPrior:true,
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    ...(orderedEffortRefusal?{
      orderedEffortRefusal,
      recordedSourceRestTeamIds:[...recording.frames[km-1]
        .pelotonRestTeamIds],
      sourceRestDecisionUsed:true}:{}),
    officialResults:false};
}

export function validateV94PhysicalMixedPaidNextKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalMixedPaidNextKmV1(
      recording,prior)))
    throw new Error('Mixed paid km differs from paid source.');
  return true;
}
