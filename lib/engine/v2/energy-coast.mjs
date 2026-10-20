import {MOTOR_EXHAUSTION_COAST} from './tuning.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';

// The reserve funds the ordered pace. If it runs out, a rider outside a
// break still travels at a slower sustainable pace, losing this much time.
export function exhaustionCoastDelaySeconds(segment,requestedWork,availableEnergy){
  if(!Number.isFinite(requestedWork)||requestedWork<0||
    !Number.isFinite(availableEnergy)||availableEnergy<0)
    throw new Error('Invalid exhausted-rider work.');
  if(requestedWork<=availableEnergy||requestedWork===0)return 0;
  const unpaidFraction=(requestedWork-availableEnergy)/requestedWork;
  const speedFraction=1-MOTOR_EXHAUSTION_COAST.maxSpeedLoss*unpaidFraction;
  return +(segmentBaseSeconds(segment)*(1/speedFraction-1)).toFixed(3);
}
