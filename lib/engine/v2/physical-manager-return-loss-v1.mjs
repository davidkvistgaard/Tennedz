// Replay the first full 24-rider kilometre after a paid return
// where another rider physically leaves the bunch.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalManagerReturnRaceV1} from
  './physical-manager-return-race-v1.mjs';

export const PHYSICAL_MANAGER_RETURN_LOSS_VERSION=
  'v2-physical-manager-return-loss-1';

export function replayPhysicalManagerReturnLossV1(input){
  let source;
  try{
    replayPhysicalManagerReturnRaceV1(input);
  }catch(error){
    if(!error.physicalReturnLoss)throw error;
    source=error.physicalReturnLoss;
  }
  if(!source)
    throw new Error('Return loss needs physical split.');
  const kilometres=[...source.priorKilometres,
    source.lossKilometre];
  if(kilometres.length!==source.sourceKm||
    kilometres.some((row,index)=>
      row.sourceKm!==index+1||
      row.riderStates.length!==input.start.riderIds.length||
      row.riderStates.some(rider=>
        !rider.decisions.length||
        rider.energyAfter<0)))
    throw new Error('Return loss lacks full paid rider road.');
  return {version:PHYSICAL_MANAGER_RETURN_LOSS_VERSION,
    sourceKm:source.sourceKm,
    riderIds:[...input.start.riderIds],
    kilometres,source:{loss:source.loss,
      completions:source.completions,
      priorBunch:source.priorBunch,
      priorBunchClock:source.priorBunchClock,
      returnContact:source.returnContact},
    laterRoadUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerReturnLossV1(input,
recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalManagerReturnLossV1(input)))
    throw new Error('Return loss differs from paid source.');
  return true;
}
