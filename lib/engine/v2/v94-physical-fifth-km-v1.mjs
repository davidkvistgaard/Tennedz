// Complete km 5 only if fresh solo, peloton and paid rear roads have
// no unresolved physical contact. The source checkpoint remains untrusted.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFifthFrontKmV1} from
  './v94-physical-fifth-front-km-v1.mjs';
import {replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';

export const V94_PHYSICAL_FIFTH_KM_VERSION=
  'v94-physical-fifth-km-1';
export const V94_PHYSICAL_FIFTH_BOUNDARY_VERSION=
  'v94-physical-fifth-boundary-choice-1';
export const V94_PHYSICAL_FIFTH_REAR_DECISION_VERSION=
  'v94-physical-fifth-rear-decision-1';

export function replayV94PhysicalFifthKmV1(recording,prior){
  if(prior?.sourceKm!==4||!prior.fullFieldKilometre)
    throw new Error('Fifth physical km needs complete paid km 4.');
  const boundary=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km:5,prior,version:V94_PHYSICAL_FIFTH_BOUNDARY_VERSION});
  const front=replayV94PhysicalFifthFrontKmV1(
    recording,prior);
  const fifth=replayV94PhysicalRearKmFromPriorV1(recording,{
    km:5,priorTrace:prior,boundary,front,
    version:V94_PHYSICAL_FIFTH_KM_VERSION,
    decisionVersion:V94_PHYSICAL_FIFTH_REAR_DECISION_VERSION});
  return {...fifth,priorSourceKm:4,priorVersion:prior.version};
}

export function validateV94PhysicalFifthKmV1(
  recording,prior,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFifthKmV1(recording,prior)))
    throw new Error('Fifth physical km differs from paid source.');
  return true;
}
