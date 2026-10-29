// Isolated kilometre-to-kilometre solo road behind the bunch. Every metre
// travelled is paid. A bunch rejoin stops at the computed contact marker.
import {isDeepStrictEqual} from 'node:util';
import {segmentBaseSeconds} from './road-clock.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_SOLO_ROAD_VERSION='v2-rear-solo-road-1';
const effortAbility=effort=>(TUNING.effortPressure[effort]-1)*20;

export function advanceRearSoloRoadV1({prior,rider,segment,bunchTurnPlan,
  effort,reason}){
  if(!prior||!['v2-rear-detachment-1',REAR_SOLO_ROAD_VERSION]
    .includes(prior.version)||prior.status!=='solo_behind'||
    typeof rider?.id!=='string'||prior.riderId!==rider.id||
    !Number.isFinite(prior.behindBunchSeconds)||
    prior.behindBunchSeconds<=0||
    !Number.isFinite(prior.energyAfter)||prior.energyAfter<0||
    prior.energyAfter>100||
    !Number.isInteger(segment?.km)||segment.km<2||
    prior.endDistanceM!==(segment.km-1)*1000||
    !['conserve','steady','hard'].includes(effort)||
    !['finish_safely','rejoin_bunch'].includes(reason))
    throw new Error('Rear solo needs an exact prior position and decision.');
  const leaderAbility=bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const effect=riderKilometreEffect(rider,segment,{phase:'solo',
    energy:prior.energyAfter,exposed:segment.exposed});
  const riderAbility=effect.ability+effortAbility(effort);
  const bunchAbility=leaderAbility+TUNING.breakaway.bunchDraftAdvantage;
  const base=segmentBaseSeconds(segment);
  const riderSeconds=base+(50-riderAbility)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const bunchSeconds=base+(50-bunchAbility)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(riderSeconds<=0||bunchSeconds<=0)
    throw new Error('Rear solo produced an invalid road speed.');
  const fullCost=TUNING.effortCost[effort]*effect.energyCostMultiplier;
  const caught=prior.behindBunchSeconds+riderSeconds-bunchSeconds<=0;
  const distanceFraction=caught?
    prior.behindBunchSeconds/(bunchSeconds-riderSeconds):1;
  const energySpent=fullCost*distanceFraction;
  if(energySpent>prior.energyAfter+1e-9)
    throw new Error('Rear solo cannot pay the selected road effort.');
  const endDistanceM=(segment.km-1+distanceFraction)*1000;
  const behindBunchSeconds=caught?0:
    prior.behindBunchSeconds+riderSeconds-bunchSeconds;
  return {version:REAR_SOLO_ROAD_VERSION,riderId:rider.id,
    sourceKm:segment.km,effort,reason,
    startDistanceM:(segment.km-1)*1000,endDistanceM,
    bunchAbility:+bunchAbility.toFixed(3),
    riderAbility:+riderAbility.toFixed(3),
    energyBefore:prior.energyAfter,energySpent:+energySpent.toFixed(6),
    energyAfter:+(prior.energyAfter-energySpent).toFixed(6),
    behindBunchSeconds:+behindBunchSeconds.toFixed(6),
    status:caught?'bunch_contact':'solo_behind',
    event:caught?{kind:'rejoin_bunch',atDistanceM:endDistanceM,
      riderId:rider.id}:null};
}

export function validateRearSoloRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearSoloRoadV1(input)))
    throw new Error('Rear solo road differs from its paid source.');
  return true;
}
