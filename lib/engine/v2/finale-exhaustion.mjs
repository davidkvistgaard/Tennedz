import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const FINALE_EXHAUSTION_DROP_VERSION='v2-finale-exhaustion-drop-1';

// A sheltered rider who cannot pay even the next recorded distance slice
// leaves the bunch at that slice's start. This conservative boundary rule
// never grants unpaid travel or rewrites the five-kilometre source frame.
export function dropExhaustedSheltered({riderIds,pullRiderId,segment,
  ridersById,energies,startDistanceM,endDistanceM}){
  if(!Array.isArray(riderIds)||!riderIds.length||
    new Set(riderIds).size!==riderIds.length||
    !Number.isFinite(startDistanceM)||!Number.isFinite(endDistanceM)||
    endDistanceM<=startDistanceM)
    throw new Error('Exhaustion requires a complete positive-distance bunch.');
  const remaining=[],drops=[];
  for(const riderId of riderIds){
    const rider=ridersById.get(riderId),energy=energies.get(riderId);
    if(!rider||!Number.isFinite(energy)||energy<0||energy>100)
      throw new Error('Exhaustion requires each present rider and energy.');
    if(riderId===pullRiderId){remaining.push(riderId);continue;}
    const effect=riderKilometreEffect(rider,segment,{phase:'chase',energy,
      exposed:segment.exposed});
    const requiredEnergy=TUNING.effortCost.conserve*
      effect.energyCostMultiplier*(endDistanceM-startDistanceM)/1000;
    if(energy+1e-9<requiredEnergy)
      drops.push({riderId,atDistanceM:startDistanceM,remainingEnergy:energy,
        requiredShelteredEnergy:requiredEnergy,
        reason:'insufficient_sheltered_energy'});
    else remaining.push(riderId);
  }
  return {riderIds:remaining,drops};
}
