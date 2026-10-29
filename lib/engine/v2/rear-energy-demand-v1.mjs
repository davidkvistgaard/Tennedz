// Opt-in terrain-priced work for one rider on a known physical rear road.
// This prices work only; a whole-race cap/recovery ledger must settle it.
import {isDeepStrictEqual} from 'node:util';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const REAR_ENERGY_DEMAND_V1_VERSION='v2-rear-energy-demand-1';
export const REAR_ENERGY_QUOTE_V1_VERSION='v2-rear-energy-quote-1';
const DRAFT_COST_FRACTION=.8;

export function quoteRearEnergyDemandV1({rider,segment,energyBefore,
  effort,role,distanceM}){
  if(typeof rider?.id!=='string'||!rider.id||
    !Number.isInteger(segment?.km)||segment.km<1||
    !Number.isFinite(segment.gradientPct)||
    !['road','cobbles','gravel','dirt'].includes(segment.surface)||
    !Number.isFinite(energyBefore)||energyBefore<0||energyBefore>100||
    !Object.hasOwn(TUNING.effortCost,effort)||
    !['leader','sheltered','solo'].includes(role)||
    !Number.isFinite(distanceM)||distanceM<=0||distanceM>1000)
    throw new Error('Rear work needs a rider, route, role and payable distance.');
  const terrainLoad=1+Math.max(0,segment.gradientPct)*.035+
    (segment.surface==='road'?0:.15);
  const phase=role==='sheltered'?'cruise':'solo';
  const effect=riderKilometreEffect(rider,segment,{phase,
    energy:energyBefore,exposed:segment.exposed});
  const draftFraction=role==='sheltered'?DRAFT_COST_FRACTION:1;
  const exposedExtra=role==='leader'?TUNING.breakaway.extraCostPerKm:0;
  const energyDemand=(TUNING.effortCost[effort]*terrainLoad*
    draftFraction+exposedExtra)*effect.energyCostMultiplier*
    distanceM/1000;
  return {version:REAR_ENERGY_QUOTE_V1_VERSION,
    riderId:rider.id,sourceKm:segment.km,effort,role,distanceM,
    terrainLoad,draftFraction,energyBefore,energyDemand,
    officialResults:false};
}

export function priceRearEnergyDemandV1(input){
  const quote=quoteRearEnergyDemandV1(input);
  if(quote.energyDemand>quote.energyBefore+1e-9)
    throw new Error('Rear rider cannot pay terrain-priced work.');
  return {...quote,version:REAR_ENERGY_DEMAND_V1_VERSION,
    energyAfter:Math.max(0,quote.energyBefore-quote.energyDemand)};
}

export function validateRearEnergyDemandV1(input,recording){
  if(!isDeepStrictEqual(recording,priceRearEnergyDemandV1(input)))
    throw new Error('Rear terrain work differs from source.');
  return true;
}
