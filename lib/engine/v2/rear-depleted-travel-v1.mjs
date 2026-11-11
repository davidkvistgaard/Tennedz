// Price an exhausted rider's own rear-road travel. The resulting clock
// cannot be copied to a group without a separate paid contact decision.
import {isDeepStrictEqual} from 'node:util';
import {quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {MOTOR_EXHAUSTION_COAST} from './tuning.mjs';

export const REAR_DEPLETED_TRAVEL_V1_VERSION=
  'v2-rear-depleted-travel-1';

export function priceRearDepletedTravelV1({rider,segment,
  energyBefore,effort,role,distanceM,baseSpeedMps}){
  if(!Number.isFinite(baseSpeedMps)||baseSpeedMps<=0)
    throw new Error('Depleted rear travel needs a paid base speed.');
  const quote=quoteRearEnergyDemandV1({rider,segment,
    energyBefore,effort,role,distanceM});
  const paidFromReserve=Math.min(energyBefore,
    quote.energyDemand);
  const unmetEnergyDemand=quote.energyDemand-paidFromReserve;
  const sustainableFraction=1-
    MOTOR_EXHAUSTION_COAST.maxSpeedLoss*
      unmetEnergyDemand/quote.energyDemand;
  const speedMps=baseSpeedMps*sustainableFraction;
  return {version:REAR_DEPLETED_TRAVEL_V1_VERSION,
    riderId:rider.id,sourceKm:segment.km,
    effort,role,distanceM,energyBefore,
    energyDemand:quote.energyDemand,paidFromReserve,
    unmetEnergyDemand,sustainableFraction,
    baseSpeedMps,speedMps,
    elapsedSeconds:distanceM/speedMps,
    energyAfter:energyBefore-paidFromReserve,
    officialResults:false};
}

export function validateRearDepletedTravelV1(input,recording){
  if(!isDeepStrictEqual(recording,
    priceRearDepletedTravelV1(input)))
    throw new Error('Depleted rear travel differs from paid source.');
  return true;
}
