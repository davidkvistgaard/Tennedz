// Opt-in terrain-priced solo behind the bunch, resolved against each paid
// bunch turn. Callers must replay the prior split or solo source first.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_SOLO_ROAD_V2_VERSION='v2-rear-solo-road-2';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear solo has invalid paid pace.');
  return 3600/seconds;
};

export function advanceRearSoloRoadV2({prior,rider,segment,
  bunchTurnPlan,routeKilometres,effort,reason}){
  if(!prior||!['v2-rear-group-follower-split-2',
    REAR_SOLO_ROAD_V2_VERSION].includes(prior.version)||
    prior.riderId!==rider?.id||
    !Number.isInteger(segment?.km)||segment.km<2||
    prior.endDistanceM!==(segment.km-1)*1000||
    !Number.isFinite(prior.behindBunchSeconds)||
    prior.behindBunchSeconds<=0||
    !Number.isFinite(prior.energyAfter)||prior.energyAfter<0||
    prior.energyAfter>100||
    !['conserve','steady','hard'].includes(effort)||
    !['finish_safely','rejoin_bunch'].includes(reason)||
    !isDeepStrictEqual(routeKilometres?.[segment.km-1],segment))
    throw new Error('Rear solo needs exact paid prior road and route.');
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const base=segmentBaseSeconds(segment);
  let gapSeconds=prior.behindBunchSeconds;
  let energy=prior.energyAfter;
  let event=null;
  const slices=[];
  const startM=(segment.km-1)*1000;
  for(const turn of bunchTurnPlan.turns){
    const effect=riderKilometreEffect(rider,segment,{phase:'solo',
      energy,exposed:segment.exposed});
    const soloSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure[effort]-1)*20);
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const movement=advanceFinaleGap({slice:{
      startDistanceM:startM+turn.startM,
      endDistanceM:startM+turn.endM,
      lengthM:turn.endM-turn.startM},
    gapSeconds,frontSpeedKph:bunchSpeedKph,
    chaseSpeedKph:soloSpeedKph});
    const endDistanceM=movement.catchDistanceM??startM+turn.endM;
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort,role:'solo',
      distanceM:endDistanceM-startM-turn.startM});
    energy=price.energyAfter;
    gapSeconds=movement.gapSeconds;
    slices.push({startDistanceM:startM+turn.startM,
      endDistanceM,bunchLeaderAbility:turn.ability,
      bunchSpeedKph,soloSpeedKph,
      energyBefore:price.energyBefore,energySpent:price.energyDemand,
      energyAfter:energy,behindBunchSeconds:gapSeconds});
    if(movement.caught){
      event={kind:'rejoin_bunch',atDistanceM:endDistanceM,
        riderId:rider.id};
      break;
    }
  }
  const endDistanceM=slices.at(-1).endDistanceM;
  const fullKm=endDistanceM===segment.km*1000;
  let cap=null,capAdjustment=null;
  if(fullKm){
    const source=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:segment.km});
    const recovery=recoveryForKilometre({rider,segment,effort,
      group:'dropped',working:false,quietKm:0});
    if(recovery.recovery!==0||recovery.quietKm!==0)
      throw new Error('Rear solo cannot claim bunch recovery.');
    cap=source.cap;
    capAdjustment=Math.max(0,energy-cap);
    energy=+Math.min(energy,cap).toFixed(3);
  }
  return {version:REAR_SOLO_ROAD_V2_VERSION,riderId:rider.id,
    sourceKm:segment.km,effort,reason,
    startDistanceM:startM,endDistanceM,slices,
    energyBefore:prior.energyAfter,
    paidWork:prior.energyAfter-slices.at(-1).energyAfter,
    recoveryAward:fullKm?0:null,cap,capAdjustment,
    energyAfter:energy,behindBunchSeconds:gapSeconds,
    status:event?'bunch_contact':'solo_behind',event,
    officialResults:false};
}

export function validateRearSoloRoadV2(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearSoloRoadV2(input)))
    throw new Error('Rear solo turns differ from paid source.');
  return true;
}
