// Consecutive paid solo kilometres after an occupied-wheel detachment.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearDetachmentV1} from './rear-detachment-v1.mjs';
import {advanceRearSoloRoadV1} from './rear-solo-road-v1.mjs';

export const REAR_SOLO_SOURCE_RUN_VERSION='v2-rear-solo-source-run-1';

export function runRearSoloSourceV1({initialInput,initial,steps}){
  if(!isDeepStrictEqual(initial,advanceRearDetachmentV1(initialInput))||
    initial.status!=='solo_behind'||!Array.isArray(steps)||
    !steps.length)
    throw new Error('Rear solo run needs a paid occupied-wheel departure.');
  let prior=initial;
  const road=[];
  for(const step of steps){
    if(prior.status!=='solo_behind'||
      step?.segment?.km!==prior.sourceKm+1||
      !isDeepStrictEqual(step.rider,initialInput.rider)||
      step.prior!==undefined)
      throw new Error('Rear solo run needs consecutive source road.');
    const result=advanceRearSoloRoadV1({...step,prior});
    road.push(result);
    prior=result;
  }
  return {version:REAR_SOLO_SOURCE_RUN_VERSION,riderId:initial.riderId,
    road,finalSolo:prior};
}

export function validateRearSoloSourceRunV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearSoloSourceV1(input)))
    throw new Error('Rear solo run differs from paid source.');
  return true;
}
