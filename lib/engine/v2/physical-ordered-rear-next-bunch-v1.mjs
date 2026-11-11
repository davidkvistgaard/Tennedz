// Continue only the recorded bunch after a complete ordered rear km.
// Separate rear roads must be paid before the next field km is valid.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalOrderedRearKmV1} from
  './physical-ordered-rear-km-v1.mjs';
import {advancePhysicalBunchAfterOrderedRearKmV1} from
  './physical-start-bunch-v1.mjs';

export const PHYSICAL_ORDERED_REAR_NEXT_BUNCH_VERSION=
  'v2-physical-ordered-rear-next-bunch-1';

export function advancePhysicalOrderedRearBunchFromStateV1({
  startInput,prior}){
  const sourceKm=prior?.sourceKm;
  const segment=startInput.routeKilometres[sourceKm];
  if(!Number.isInteger(sourceKm)||
    !segment||
    !Array.isArray(prior.riderStates)||
    prior.riderStates.length!==prior.riderCount||
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
  const bunchStates=prior.riderStates.filter(row=>
    row.physicalGroupId==='peloton');
  if(bunchStates.length!==
    prior.endBunchState.riderIds.length||
    bunchStates.some(row=>
      !prior.endBunchState.riderIds.includes(
        row.riderId)||
      row.energyAfter!==prior.endBunchState
        .energyByRider[row.riderId]||
      row.elapsedSeconds!==
        bunchStates[0].elapsedSeconds))
    throw new Error(
      'Ordered rear next bunch lacks paid clock.');
  return {version:
    PHYSICAL_ORDERED_REAR_NEXT_BUNCH_VERSION,
  sourceKm:sourceKm+1,
  sources:{prior},step,
  bunchStartClock:bunchStates[0]
    .elapsedSeconds,
  rearRoadsUnsettled:true,
  fieldKilometreIncomplete:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function replayPhysicalOrderedRearNextBunchKmV1(
  input){
  return advancePhysicalOrderedRearBunchFromStateV1({
    startInput:input.startInput,
    prior:replayPhysicalOrderedRearKmV1(input)});
}

export function validatePhysicalOrderedRearNextBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedRearNextBunchKmV1(input)))
    throw new Error(
      'Ordered rear next bunch differs from paid source.');
  return true;
}
