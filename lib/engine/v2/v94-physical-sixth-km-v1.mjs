// Keep every km-6 road on its paid clock. Recorded source break groups
// remain claims until a physical contact and a payable leader exist.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalSixthBoundaryChoicesV1} from
  './v94-physical-sixth-boundary-choice-v1.mjs';
import {replayV94PhysicalSixthFrontKmV1} from
  './v94-physical-sixth-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_SIXTH_KM_VERSION=
  'v94-physical-sixth-km-1';
export const V94_PHYSICAL_SIXTH_REAR_DECISION_VERSION=
  'v94-physical-sixth-rear-decision-1';

export function replayV94PhysicalSixthKmV1(recording,prior){
  if(prior?.sourceKm!==5||!prior.fullFieldKilometre||
    prior.sourceCheckpointCalibrationFailed!==true)
    throw new Error('Sixth physical km needs paid fifth field.');
  const boundary=decideV94PhysicalSixthBoundaryChoicesV1(
    recording,prior);
  const front=replayV94PhysicalSixthFrontKmV1(recording,prior);
  const sixth=replayV94PhysicalRearKmFromPriorV1(recording,{
    km:6,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_SIXTH_KM_VERSION,
    decisionVersion:V94_PHYSICAL_SIXTH_REAR_DECISION_VERSION});
  return {...sixth,priorSourceKm:5,priorVersion:prior.version,
    sourceBreakRiderIds:[...prior.freshAttackSoloRiderIds],
    sourceBreakRoadNotPhysical:true,
    sourceCheckpointCalibrationFailed:true,
    officialResults:false};
}

export function validateV94PhysicalSixthKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalSixthKmV1(recording,prior)))
    throw new Error('Sixth physical km differs from paid source.');
  return true;
}
