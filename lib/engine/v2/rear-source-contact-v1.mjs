// Isolated physical meeting of two already paid rear solos. The same source
// rider, terrain, energy and bunch turns determine both speeds and costs.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearSoloRoadV1,validateRearSoloRoadV1} from
  './rear-solo-road-v1.mjs';
import {validateRearDetachmentV1} from './rear-detachment-v1.mjs';
import {validateRearUnpayableClimbV1} from
  './rear-unpayable-climb-v1.mjs';
import {advanceRearSoloContactV1} from './rear-solo-contact-v1.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_SOURCE_CONTACT_VERSION='v2-rear-source-contact-1';
const speed=(base,ability)=>3600/(base+(50-ability)*
  MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint);

export function advanceRearSourceContactV1({front,rear,segment,
  bunchTurnPlan}){
  if(!front||!rear||front.prior?.riderId===rear.prior?.riderId||
    !front.priorSource||!rear.priorSource||
    front.prior?.endDistanceM!==rear.prior?.endDistanceM||
    !Number.isFinite(front.prior?.behindBunchSeconds)||
    !Number.isFinite(rear.prior?.behindBunchSeconds)||
    front.prior.behindBunchSeconds>=rear.prior.behindBunchSeconds)
    throw new Error('Rear contact needs two ordered paid solo sources.');
  for(const source of [front,rear]){
    if(source.prior.version==='v2-rear-detachment-1')
      validateRearDetachmentV1(source.priorSource,source.prior);
    else if(source.prior.version==='v2-rear-unpayable-climb-1')
      validateRearUnpayableClimbV1(source.priorSource,source.prior);
    else validateRearSoloRoadV1(source.priorSource,source.prior);
  }
  const stepInput=source=>({prior:source.prior,rider:source.rider,
    segment,bunchTurnPlan,effort:source.effort,reason:source.reason});
  // A full-kilometre solo proposal must be affordable. This narrow version
  // refuses a rider who could only afford the shorter contact interval.
  const frontStep=advanceRearSoloRoadV1(stepInput(front));
  const rearStep=advanceRearSoloRoadV1(stepInput(rear));
  const base=segmentBaseSeconds(segment);
  const slice={startDistanceM:(segment.km-1)*1000,
    endDistanceM:segment.km*1000,lengthM:1000};
  const costPerKm=step=>step.energySpent*1000/
    (step.endDistanceM-step.startDistanceM);
  const soloInput={slice,
    bunchSpeedKph:speed(base,frontStep.bunchAbility),
    front:{riderId:frontStep.riderId,
      behindBunchSeconds:front.prior.behindBunchSeconds,
      speedKph:speed(base,frontStep.riderAbility),
      energy:front.prior.energyAfter,
      workCostPerKm:costPerKm(frontStep)},
    rear:{riderId:rearStep.riderId,
      behindBunchSeconds:rear.prior.behindBunchSeconds,
      speedKph:speed(base,rearStep.riderAbility),
      energy:rear.prior.energyAfter,
      workCostPerKm:costPerKm(rearStep)}};
  const contact=advanceRearSoloContactV1(soloInput);
  return {version:REAR_SOURCE_CONTACT_VERSION,sourceKm:segment.km,
    decisions:[{riderId:frontStep.riderId,effort:front.effort,
      reason:front.reason},{riderId:rearStep.riderId,effort:rear.effort,
      reason:rear.reason}],soloInput,contact};
}

export function validateRearSourceContactV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearSourceContactV1(input)))
    throw new Error('Rear contact differs from the two paid solo sources.');
  return true;
}
