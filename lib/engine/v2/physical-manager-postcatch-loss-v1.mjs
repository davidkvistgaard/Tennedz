// Replay a manager-order chase through a later physical bunch loss.
// The recording stops at the complete paid split kilometre; later
// solo contact and finishes are deliberately left unsettled.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerChaseRaceV1} from
  './physical-manager-chase-race-replay-v1.mjs';
import {advancePhysicalBunchAfterPostcatchLossKmV1} from
  './physical-start-bunch-v1.mjs';

export const PHYSICAL_MANAGER_POSTCATCH_LOSS_VERSION=
  'v2-physical-manager-postcatch-loss-1';
export const PHYSICAL_MANAGER_POSTCATCH_BUNCH_VERSION=
  'v2-physical-manager-postcatch-bunch-1';

export function replayPhysicalManagerPostcatchLossV1(input){
  try{
    replayPhysicalManagerChaseRaceV1(input);
  }catch(error){
    if(!error.physicalLoss)throw error;
    const source=error.physicalLoss;
    const kilometres=[...source.priorKilometres,
      source.lossKilometre];
    if(kilometres.length!==source.sourceKm||
      kilometres.some((row,index)=>
        row.sourceKm!==index+1||
        row.riderStates.length!==input.start.riderIds.length))
      throw new Error('Post-catch loss lacks paid rider road.');
    return {version:PHYSICAL_MANAGER_POSTCATCH_LOSS_VERSION,
      sourceKm:source.sourceKm,
      caughtRiderId:source.roadInput.caughtRiderId,
      riderIds:[...input.start.riderIds],
      kilometres,
      source:{loss:source.loss,
        completions:source.completions,
        caughtSoloEndClock:source.caughtSoloEndClock,
        caughtSoloEnergyAfter:source.caughtSoloEnergyAfter},
      laterContactUnsettled:true,
      movesGuidedRace:false,officialResults:false};
  }
  throw new Error('Post-catch loss probe needs a paid split.');
}

export function validatePhysicalManagerPostcatchLossV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerPostcatchLossV1(input)))
    throw new Error('Post-catch loss differs from paid source.');
  return true;
}

export function advancePhysicalManagerPostcatchBunchKmV1({
  input,partial,segment}){
  if(!isDeepStrictEqual(partial,
    replayPhysicalManagerPostcatchLossV1(input))||
    segment?.km!==partial.sourceKm+1||
    !isDeepStrictEqual(segment,
      input.startInput.routeKilometres[segment.km-1]))
    throw new Error('Post-catch bunch needs replayed split road.');
  const loss=partial.source.loss;
  const prior={riderIds:loss.physicalGroup.riderIds,
    energyByRider:loss.energyByRider,
    quietKmByRider:loss.quietKmByRider};
  const step=advancePhysicalBunchAfterPostcatchLossKmV1({
    startInput:input.startInput,prior,segment,
    caughtRiderId:partial.caughtRiderId,
    detachedRiderIds:loss.splits.map(row=>row.riderId)});
  const previousClock=partial.kilometres.at(-1)
    .riderStates.find(row=>row.physicalGroupId===
      'peloton').elapsedSeconds;
  return {version:PHYSICAL_MANAGER_POSTCATCH_BUNCH_VERSION,
    sourceKm:segment.km,
    previousClock,elapsedSeconds:previousClock+
      step.elapsedSeconds,
    detachedRiderIds:loss.splits.map(row=>row.riderId),
    step,officialResults:false};
}

export function validatePhysicalManagerPostcatchBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalManagerPostcatchBunchKmV1(input)))
    throw new Error('Post-catch bunch differs from replayed loss.');
  return true;
}
