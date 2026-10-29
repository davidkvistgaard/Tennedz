// Exact reserve exhaustion while a rider tries to hold a named bunch turn.
// The prior bunch road is replayed; the rider leaves at the last paid metre.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {priceRearEnergyDemandV1,quoteRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {runRearBunchOriginRoadV1} from
  './rear-bunch-origin-road-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_BUNCH_ENERGY_LOSS_V1_VERSION=
  'v2-rear-bunch-energy-loss-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Bunch energy loss has invalid pace.');
  return 3600/seconds;
};

export function advanceRearBunchEnergyLossV1({priorInput,prior,
  routeKilometres,segment,bunchTurnPlan,choice}){
  if(!isDeepStrictEqual(prior,runRearBunchOriginRoadV1(priorInput))||
    prior.status!=='bunch'||
    segment?.km!==prior.sourceKm+1||
    !isDeepStrictEqual(routeKilometres?.slice(0,prior.sourceKm),
      priorInput.routeKilometres)||
    !isDeepStrictEqual(routeKilometres?.[segment.km-1],segment)||
    choice?.riderId!==prior.riderId||choice.km!==segment.km||
    choice.action!=='hold_wheel'||choice.reason!=='follow_order'||
    choice.effort!==orderAt(priorInput.orders,segment.km-1).effort||
    bunchTurnPlan?.status!=='worked')
    throw new Error('Bunch energy loss needs consecutive paid source.');
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const rider=priorInput.rider;
  const base=segmentBaseSeconds(segment);
  let energy=prior.energyAfter;
  let quietKm=prior.steps.at(-1).quietKm;
  let working=false;
  const startM=(segment.km-1)*1000;
  const slices=[];
  for(const turn of bunchTurnPlan.turns){
    const role=turn.leaderRiderId===rider.id?'leader':'sheltered';
    if(typeof turn.leaderRiderId!=='string'||!turn.leaderRiderId)
      throw new Error('Bunch energy loss needs named paid leader.');
    const distanceM=turn.endM-turn.startM;
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const effect=riderKilometreEffect(rider,segment,{
      phase:role==='leader'?'solo':'cruise',energy,
      exposed:segment.exposed});
    const holdSpeedKph=role==='leader'?bunchSpeedKph:speed(base,
      effect.ability+(TUNING.effortPressure[choice.effort]-1)*20+
      TUNING.breakaway.bunchDraftAdvantage);
    if(holdSpeedKph+1e-9<bunchSpeedKph)
      throw new Error('Bunch energy loss needs separate pace-loss road.');
    const quote=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort:choice.effort,role,distanceM});
    if(quote.energyDemand>energy+1e-9){
      if(role==='leader')
        throw new Error('Recorded bunch leader cannot pay named turn.');
      const paidDistanceM=energy<=0?0:
        distanceM*energy/quote.energyDemand;
      const price=paidDistanceM>0?priceRearEnergyDemandV1({
        rider,segment,energyBefore:energy,effort:choice.effort,
        role,distanceM:paidDistanceM}):null;
      const atDistanceM=startM+turn.startM+paidDistanceM;
      const split={kind:'physical_energy_loss',riderId:rider.id,
        atDistanceM,bunchLeaderRiderId:turn.leaderRiderId,
        energyBefore:energy,paidDistanceM,
        energySpent:price?.energyDemand??0,
        energyAfter:0,behindBunchSeconds:0};
      slices.push({startDistanceM:startM+turn.startM,
        endDistanceM:atDistanceM,role,bunchSpeedKph,
        energyBefore:energy,energySpent:split.energySpent,
        energyAfter:0});
      return {version:REAR_BUNCH_ENERGY_LOSS_V1_VERSION,
        riderId:rider.id,sourceKm:segment.km,
        choice:structuredClone(choice),slices,
        split,endDistanceM:atDistanceM,
        status:'wheel_lost',energyAfter:0,
        cap:null,recoveryAward:null,
        remainingKmUnsettled:true,officialResults:false};
    }
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort:choice.effort,role,distanceM});
    energy=price.energyAfter;
    working ||=role==='leader';
    slices.push({startDistanceM:startM+turn.startM,
      endDistanceM:startM+turn.endM,role,bunchSpeedKph,
      energyBefore:price.energyBefore,
      energySpent:price.energyDemand,energyAfter:energy});
  }
  const cap=replayRearEnergyCapV1({rider,
    kilometres:routeKilometres,throughKm:segment.km}).cap;
  const recovery=recoveryForKilometre({rider,segment,
    effort:choice.effort,group:'peloton',working,quietKm});
  quietKm=recovery.quietKm;
  energy=+Math.min(cap,energy+recovery.recovery).toFixed(3);
  return {version:REAR_BUNCH_ENERGY_LOSS_V1_VERSION,
    riderId:rider.id,sourceKm:segment.km,
    choice:structuredClone(choice),slices,split:null,
    endDistanceM:segment.km*1000,
    status:'bunch',energyAfter:energy,
    cap,recoveryAward:recovery.recovery,
    quietKm,remainingKmUnsettled:false,
    officialResults:false};
}

export function validateRearBunchEnergyLossV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearBunchEnergyLossV1(input)))
    throw new Error('Bunch energy loss differs from paid source.');
  return true;
}
