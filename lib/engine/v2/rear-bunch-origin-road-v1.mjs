// Opt-in physical origin for one rider: the starting bunch is known, and
// every later wheel is carried only through paid, named bunch turns.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_BUNCH_ORIGIN_ROAD_V1_VERSION=
  'v2-rear-bunch-origin-road-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Bunch origin has invalid pace.');
  return 3600/seconds;
};
const validPlan=(plan,riderId,stageNumber,stageCount)=>
  plan?.riderId===riderId&&
  plan.currentStageNumber===stageNumber&&
  Number.isInteger(plan.targetStageNumber)&&
  plan.targetStageNumber>stageNumber&&
  plan.targetStageNumber<=stageCount&&
  plan.currentGoal==='finish_safely'&&
  plan.futureGoal==='target_stage'&&
  Number.isFinite(plan.reserveEnergy)&&
  plan.reserveEnergy>=0&&plan.reserveEnergy<=100;

export function runRearBunchOriginRoadV1({rider,orders,
  routeKilometres,bunchTurnPlans,choices,stageNumber,stageCount,
  committedStagePlan=null}){
  if(typeof rider?.id!=='string'||!rider.id||!orders||
    !Array.isArray(routeKilometres)||!routeKilometres.length||
    !Array.isArray(bunchTurnPlans)||
    bunchTurnPlans.length!==routeKilometres.length||
    !Array.isArray(choices)||choices.length!==routeKilometres.length||
    !Number.isInteger(stageNumber)||stageNumber<1||
    !Number.isInteger(stageCount)||stageCount<stageNumber||
    committedStagePlan!==null&&!validPlan(committedStagePlan,
      rider.id,stageNumber,stageCount))
    throw new Error('Bunch origin needs committed rider, route and choices.');
  const initial=replayRearEnergyCapV1({rider,
    kilometres:routeKilometres,throughKm:0});
  let energy=initial.initialCap;
  let quietKm=0;
  let status='bunch';
  const steps=[];
  for(let index=0;index<routeKilometres.length;index++){
    const segment=routeKilometres[index];
    const plan=bunchTurnPlans[index];
    const choice=choices[index];
    if(segment?.km!==index+1||
      choice?.riderId!==rider.id||choice.km!==segment.km||
      !['hold_wheel','release_wheel'].includes(choice.action)||
      choice.effort!==orderAt(orders,segment.km-1).effort||
      !['conserve','steady','hard'].includes(choice.effort)||
      (choice.action==='hold_wheel'&&
        choice.reason!=='follow_order')||
      (choice.action==='release_wheel'&&
        (choice.reason!=='committed_future_stage_reserve'||
         committedStagePlan===null))||
      plan?.status!=='worked'||
      plan.turns?.some(turn=>
        typeof turn.leaderRiderId!=='string'||
        !turn.leaderRiderId))
      throw new Error('Bunch origin needs an explicit ordered decision.');
    bunchAbilityFromPaidTurnsV1(plan);
    if(status!=='bunch')
      throw new Error('Bunch origin needs separate paid solo continuation.');
    const startM=index*1000;
    const base=segmentBaseSeconds(segment);
    const slices=[];
    let split=null;
    let working=false;
    if(choice.action==='release_wheel'){
      split={kind:'deliberate_release',riderId:rider.id,
        atDistanceM:startM,
        targetStageNumber:committedStagePlan.targetStageNumber};
    }
    for(const turn of plan.turns){
      if(split)break;
      const leader=turn.leaderRiderId===rider.id;
      const bunchSpeedKph=speed(base,turn.ability+
        TUNING.breakaway.bunchDraftAdvantage);
      const effect=riderKilometreEffect(rider,segment,{
        phase:leader?'solo':'cruise',energy,
        exposed:segment.exposed});
      const holdSpeedKph=leader?bunchSpeedKph:speed(base,
        effect.ability+(TUNING.effortPressure[choice.effort]-1)*20+
        TUNING.breakaway.bunchDraftAdvantage);
      const distanceM=turn.endM-turn.startM;
      if(!leader&&holdSpeedKph+1e-9<bunchSpeedKph){
        split={kind:'physical_pace_loss',riderId:rider.id,
          atDistanceM:startM+turn.startM,
          bunchLeaderRiderId:turn.leaderRiderId,
          holdSpeedKph,bunchSpeedKph};
        break;
      }
      const price=priceRearEnergyDemandV1({rider,segment,
        energyBefore:energy,effort:choice.effort,
        role:leader?'leader':'sheltered',distanceM});
      energy=price.energyAfter;
      working ||=leader;
      slices.push({startDistanceM:startM+turn.startM,
        endDistanceM:startM+turn.endM,
        bunchLeaderRiderId:turn.leaderRiderId,
        role:price.role,bunchSpeedKph,holdSpeedKph,
        energyBefore:price.energyBefore,
        energySpent:price.energyDemand,energyAfter:energy});
    }
    if(split){
      status=split.kind==='deliberate_release'?
        'wheel_released':'wheel_lost';
      steps.push({sourceKm:segment.km,choice:structuredClone(choice),
        startDistanceM:startM,endDistanceM:split.atDistanceM,
        slices,split,energyAfter:energy,cap:null,
        recoveryAward:null,quietKm:null});
      break;
    }
    const capSource=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:segment.km});
    const recovery=recoveryForKilometre({rider,segment,
      effort:choice.effort,group:'peloton',working,quietKm});
    quietKm=recovery.quietKm;
    energy=+Math.min(capSource.cap,
      energy+recovery.recovery).toFixed(3);
    steps.push({sourceKm:segment.km,choice:structuredClone(choice),
      startDistanceM:startM,endDistanceM:startM+1000,
      slices,split:null,energyAfter:energy,cap:capSource.cap,
      recoveryAward:recovery.recovery,quietKm});
  }
  return {version:REAR_BUNCH_ORIGIN_ROAD_V1_VERSION,
    riderId:rider.id,sourceKm:steps.at(-1).sourceKm,
    initialEnergy:initial.initialCap,steps,status,
    physicalPosition:status==='bunch'?{
      group:'bunch',atDistanceM:steps.at(-1).endDistanceM}:
      {group:status,atDistanceM:steps.at(-1).endDistanceM},
    energyAfter:energy,officialResults:false};
}

export function validateRearBunchOriginRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearBunchOriginRoadV1(input)))
    throw new Error('Bunch origin differs from paid road source.');
  return true;
}
