import {isDeepStrictEqual} from 'node:util';
import {prepareLastKmRotationFromTour,
  recordLastKmRotationAt500M} from
  './finale-last-km-rotation-catch.mjs';
import {continueFinaleNamedAttackRotationBunch} from
  './finale-named-attack-rotation-bunch.mjs';

export const FINALE_LAST_KM_ROTATION_CONTAINED_VERSION=
  'v2-finale-last-km-rotation-contained-1';

// A validated v91 source whose paid named launch never leaves the bunch.
// Independent rotation remains paid through the next 250 m slice.
export function probeLastKmRotationContainedFromTour(tour,options){
  const {snapshot,riderIds,km,teamId,riderId,sourceRepeatLoad,
    repeatLoad,grid,launchInput,launch}=
      prepareLastKmRotationFromTour(tour,options);
  const bunch=continueFinaleNamedAttackRotationBunch({
    launchInput,launch,slice:grid[1]});
  const at500M=recordLastKmRotationAt500M({frame:bunch,launch,
    km,riderIds});
  return {version:FINALE_LAST_KM_ROTATION_CONTAINED_VERSION,
    sourceSnapshotVersion:snapshot.version,
    sourceTuningVersion:snapshot.sourceTuningVersion,
    sourceKm:snapshot.sourceKm,teamId,riderId,
    sourceRepeatLoad,repeatLoad,frames:[launch,bunch],at500M};
}

export function validateLastKmRotationContainedFromTour(tour,
  options,recorded){
  if(!isDeepStrictEqual(recorded,
    probeLastKmRotationContainedFromTour(tour,options)))
    throw new Error('The source-linked contained attack does not replay.');
  return true;
}
