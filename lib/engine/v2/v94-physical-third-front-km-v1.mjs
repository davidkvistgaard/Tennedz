// A conditional paid front trace for km 3. Rear roads and detached riders
// still require contact decisions before a full-field kilometre exists.
import {isDeepStrictEqual} from 'node:util';
import {replayV94PhysicalSecondRearKmV1} from
  './v94-physical-second-rear-km-v1.mjs';
import {replayV94PhysicalFrontKmFromPriorV1} from
  './v94-physical-second-front-km-v1.mjs';

export const V94_PHYSICAL_THIRD_FRONT_KM_VERSION=
  'v94-physical-third-front-km-1';
export const V94_PHYSICAL_THIRD_FRONT_DECISION_VERSION=
  'v94-physical-third-front-decision-1';

export function replayV94PhysicalThirdFrontKmV1(recording){
  const second=replayV94PhysicalSecondRearKmV1(recording);
  return replayV94PhysicalFrontKmFromPriorV1(recording,{
    km:3,prior:second,frontClockSeconds:second.front.frontClockSeconds,
    version:V94_PHYSICAL_THIRD_FRONT_KM_VERSION,
    decisionVersion:V94_PHYSICAL_THIRD_FRONT_DECISION_VERSION,
    priorField:'second'});
}

export function validateV94PhysicalThirdFrontKmV1(recording,trace){
  if(!isDeepStrictEqual(trace,
    replayV94PhysicalThirdFrontKmV1(recording)))
    throw new Error('Third-km front differs from paid source.');
  return true;
}
