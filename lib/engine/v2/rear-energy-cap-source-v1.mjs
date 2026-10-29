// Replay the existing race-cap schedule from a committed rider and route.
// Rear work may then be clamped against a source-derived cap, not a guess.
import {isDeepStrictEqual} from 'node:util';
import {MOTOR_RECOVERY_CEILING,TUNING} from './tuning.mjs';

export const REAR_ENERGY_CAP_SOURCE_V1_VERSION=
  'v2-rear-energy-cap-source-1';

export function replayRearEnergyCapV1({rider,kilometres,throughKm}){
  if(typeof rider?.id!=='string'||!rider.id||
    !Number.isFinite(rider.endurance)||rider.endurance<0||
    rider.endurance>100||
    !Number.isFinite(rider.fatigue??0)||rider.fatigue<0||
    rider.fatigue>100||
    !Array.isArray(kilometres)||
    !Number.isInteger(throughKm)||throughKm<0||
    throughKm>kilometres.length)
    throw new Error('Rear cap needs committed rider and complete route.');
  let cap=100-(rider.fatigue??0)*
    TUNING.stageRace.initialEnergyFatigueFactor;
  const initialCap=cap;
  const decay=[];
  for(let index=0;index<throughKm;index++){
    const segment=kilometres[index];
    if(segment?.km!==index+1||
      !Number.isFinite(segment.gradientPct)||
      !['road','cobbles','gravel','dirt'].includes(segment.surface))
      throw new Error('Rear cap route has a missing kilometre.');
    if(segment.km<=MOTOR_RECOVERY_CEILING.afterKm)continue;
    const terrainLoad=1+Math.max(0,segment.gradientPct)*.035+
      (segment.surface==='road'?0:.15);
    const capDecay=(MOTOR_RECOVERY_CEILING.capDecayBasePerKm+
      (100-rider.endurance)*
      MOTOR_RECOVERY_CEILING.enduranceDeficitPerPoint)*terrainLoad;
    const before=cap;
    cap=+Math.min(cap,Math.max(MOTOR_RECOVERY_CEILING.minEnergyCap,
      cap-capDecay)).toFixed(3);
    decay.push({km:segment.km,terrainLoad,capBefore:before,
      capAfter:cap});
  }
  return {version:REAR_ENERGY_CAP_SOURCE_V1_VERSION,
    riderId:rider.id,throughKm,initialCap,cap,decay};
}

export function validateRearEnergyCapV1(input,recording){
  if(!isDeepStrictEqual(recording,replayRearEnergyCapV1(input)))
    throw new Error('Rear cap differs from committed route.');
  return true;
}
