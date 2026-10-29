// Replay a paid, within-kilometre wheel loss before any later rear solo road.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearUnpayableClimbV1} from
  './rear-unpayable-climb-v1.mjs';
import {advanceRearSoloRoadV1} from './rear-solo-road-v1.mjs';

export const REAR_UNPAYABLE_SOLO_RUN_VERSION=
  'v2-rear-unpayable-solo-run-1';

export function runRearUnpayableSoloV1({initialInput,initial,steps}){
  if(!isDeepStrictEqual(initial,
    advanceRearUnpayableClimbV1(initialInput))||
    initial.status!=='solo_behind'||
    !Array.isArray(steps)||!steps.length)
    throw new Error('Rear solo needs a replayed paid climb split.');
  let prior=initial;
  const road=[];
  for(const step of steps){
    if(prior.status!=='solo_behind'||
      step?.segment?.km!==prior.sourceKm+1||
      !isDeepStrictEqual(step.rider,initialInput.rider)||
      step.prior!==undefined)
      throw new Error('Rear solo needs consecutive rider road.');
    const result=advanceRearSoloRoadV1({...step,prior});
    road.push(result);
    prior=result;
  }
  return {version:REAR_UNPAYABLE_SOLO_RUN_VERSION,
    riderId:initial.riderId,road,finalSolo:prior};
}

export function validateRearUnpayableSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearUnpayableSoloV1(input)))
    throw new Error('Rear solo differs from its paid climb source.');
  return true;
}
