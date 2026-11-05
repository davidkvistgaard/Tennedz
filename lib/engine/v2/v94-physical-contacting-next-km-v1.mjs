// Select the already guarded physical continuation for a measured
// rear contact. This never turns a source group into a paid road.
import {replayV94PhysicalRecordedRestKmV1} from
  './v94-physical-recorded-rest-km-v1.mjs';
import {replayV94PhysicalMixedPaidNextKmV1} from
  './v94-physical-mixed-paid-next-km-v1.mjs';
import {replayV94PhysicalUnattachedSourceNextKmV1} from
  './v94-physical-unattached-source-next-km-v1.mjs';

export function replayV94PhysicalContactingNextKmV1(
  recording,prior){
  if(prior?.physicallyCaughtSourceBreakRiderIds?.length)
    return replayV94PhysicalUnattachedSourceNextKmV1(
      recording,prior,{useAvailableFront:
        !!prior.front?.availableFrontPlanVersion});
  return prior?.contactFragmentVersion||
    prior?.mixedPaidContactFromPrior===true?
      replayV94PhysicalMixedPaidNextKmV1(recording,prior):
      replayV94PhysicalRecordedRestKmV1(recording,prior);
}
