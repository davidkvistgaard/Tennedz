// A separate km-4 physical replay, dependent on complete paid km 3.
// It does not alter the V94 recording or establish an official finish.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalThirdRearKmV1,
  replayV94PhysicalRearKmFromPriorV1} from
  './v94-physical-third-rear-km-v1.mjs';
import {decideV94PhysicalBoundaryFromPriorV1} from
  './v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';

export const V94_PHYSICAL_FOURTH_KM_VERSION=
  'v94-physical-fourth-km-1';
export const V94_PHYSICAL_FOURTH_BOUNDARY_VERSION=
  'v94-physical-fourth-boundary-choice-1';
export const V94_PHYSICAL_FOURTH_FRONT_VERSION=
  'v94-physical-fourth-front-km-1';
export const V94_PHYSICAL_FOURTH_FRONT_DECISION_VERSION=
  'v94-physical-fourth-front-decision-1';
export const V94_PHYSICAL_FOURTH_REAR_DECISION_VERSION=
  'v94-physical-fourth-rear-decision-1';

export function replayV94PhysicalFourthKmV1(recording){
  const third=replayV94PhysicalThirdRearKmV1(recording);
  const boundary=decideV94PhysicalBoundaryFromPriorV1(recording,{
    km:4,prior:third,
    version:V94_PHYSICAL_FOURTH_BOUNDARY_VERSION});
  const front=replayV94PhysicalFrontKmFromPriorV1(recording,{
    km:4,prior:third,
    frontClockSeconds:third.front.frontClockSeconds,
    version:V94_PHYSICAL_FOURTH_FRONT_VERSION,
    decisionVersion:V94_PHYSICAL_FOURTH_FRONT_DECISION_VERSION,
    priorField:null});
  const fourth=replayV94PhysicalRearKmFromPriorV1(recording,{
    km:4,priorTrace:third,boundary,front,
    version:V94_PHYSICAL_FOURTH_KM_VERSION,
    decisionVersion:V94_PHYSICAL_FOURTH_REAR_DECISION_VERSION});
  return {...fourth,priorSourceKm:third.sourceKm,
    priorVersion:third.version};
}

export function validateV94PhysicalFourthKmV1(recording,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalFourthKmV1(recording)))
    throw new Error('Fourth-km physical road differs from paid source.');
  return true;
}
