// Compose an ordered, paid bunch leader with the physical road step.
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {advancePhysicalFirstRoadWithStartDropsV1} from
  './physical-first-road-step-v1.mjs';

export const PHYSICAL_FIRST_PELOTON_KM_VERSION=
  'physical-first-peloton-km-1';

export function advancePhysicalFirstPelotonKmV1(input){
  const leaderPlan=planPhysicalFirstPelotonLeaderV1(input);
  const step=advancePhysicalFirstRoadWithStartDropsV1({
    ...input,roadId:'peloton',
    leaderRiderId:leaderPlan.leaderRiderId,
    planVersion:leaderPlan.version});
  if(step.road.leaderRiderId!==leaderPlan.leaderRiderId)
    throw new Error('Paid bunch leader differs from the committed plan.');
  return {...step,version:PHYSICAL_FIRST_PELOTON_KM_VERSION,
    leaderPlan};
}
