// Continue only the recorded bunch after a complete ordered rear km.
// Separate rear roads must be paid before the next field km is valid.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalOrderedRearKmV1} from
  './physical-ordered-rear-km-v1.mjs';
import {advancePhysicalBunchAfterOrderedRearKmV1} from
  './physical-start-bunch-v1.mjs';

export const PHYSICAL_ORDERED_REAR_NEXT_BUNCH_VERSION=
  'v2-physical-ordered-rear-next-bunch-1';

export function replayPhysicalOrderedRearNextBunchKmV1(
  input){
  const prior=replayPhysicalOrderedRearKmV1(input);
  const {startInput,throughKm:sourceKm}=input;
  const segment=startInput.routeKilometres[sourceKm];
  if(!segment||
    prior.endBunchState.riderIds.length+
      prior.endRearEntities.reduce((count,
        entity)=>count+
          entity.riderIds.length,0)!==
      prior.riderCount)
    throw new Error(
      'Ordered rear next bunch needs full prior field.');
  const knownDetachedRiderIds=prior.endRearEntities
    .flatMap(entity=>entity.riderIds);
  const step=advancePhysicalBunchAfterOrderedRearKmV1({
    startInput,prior:prior.endBunchState,
    segment,sourceKm,knownDetachedRiderIds});
  if(step.sourceKm!==sourceKm+1||
    step.riders.length!==
      prior.endBunchState.riderIds.length||
    step.physicalGroup.riderIds.some(id=>
      knownDetachedRiderIds.includes(id)))
    throw new Error(
      'Ordered rear next bunch lost paid membership.');
  return {version:
    PHYSICAL_ORDERED_REAR_NEXT_BUNCH_VERSION,
  sourceKm:sourceKm+1,
  sources:{prior},step,
  bunchStartClock:prior.riderStates.find(row=>
    row.physicalGroupId==='peloton')
    .elapsedSeconds,
  rearRoadsUnsettled:true,
  fieldKilometreIncomplete:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearNextBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedRearNextBunchKmV1(input)))
    throw new Error(
      'Ordered rear next bunch differs from paid source.');
  return true;
}
