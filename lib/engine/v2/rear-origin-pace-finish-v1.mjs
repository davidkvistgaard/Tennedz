// Actual elapsed finish for one paid bunch-origin pace loss. No official
// placing or time limit is inferred from this isolated rider projection.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {continueRearOriginPaceSoloV1} from
  './rear-origin-pace-solo-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_ORIGIN_PACE_FINISH_V1_VERSION=
  'v2-rear-origin-pace-finish-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Origin finish has invalid pace.');
  return 3600/seconds;
};

export function runRearOriginPaceFinishV1({soloInput,solo,
  routeKilometres,bunchTurnPlans,soloChoices}){
  if(!isDeepStrictEqual(solo,
    continueRearOriginPaceSoloV1(soloInput))||
    !Array.isArray(routeKilometres)||
    routeKilometres.length<solo.sourceKm||
    !Array.isArray(bunchTurnPlans)||
    bunchTurnPlans.length!==routeKilometres.length||
    !Array.isArray(soloChoices)||
    soloChoices.length!==routeKilometres.length-solo.sourceKm||
    !isDeepStrictEqual(routeKilometres.slice(0,solo.sourceKm),
      soloInput.originInput.routeKilometres)||
    !isDeepStrictEqual(bunchTurnPlans.slice(0,solo.sourceKm),
      soloInput.originInput.bunchTurnPlans))
    throw new Error('Origin finish needs replayed paid solo source.');
  const {rider}=soloInput.originInput;
  let riderElapsedSeconds=0,bunchElapsedSeconds=0;
  for(const step of soloInput.origin.steps)
    for(const slice of step.slices){
      const seconds=(slice.endDistanceM-slice.startDistanceM)*
        3.6/slice.bunchSpeedKph;
      riderElapsedSeconds+=seconds;
      bunchElapsedSeconds+=seconds;
    }
  riderElapsedSeconds+=solo.soloElapsedSeconds;
  bunchElapsedSeconds+=solo.bunchElapsedSeconds;
  let energy=solo.energyAfter;
  let behindBunchSeconds=solo.behindBunchSeconds;
  const steps=[];
  for(let index=solo.sourceKm;index<routeKilometres.length;index++){
    const segment=routeKilometres[index];
    const plan=bunchTurnPlans[index];
    const choice=soloChoices[index-solo.sourceKm];
    if(segment?.km!==index+1||plan?.status!=='worked'||
      plan.turns?.some(turn=>turn.leaderRiderId===rider.id)||
      choice?.riderId!==rider.id||choice.km!==segment.km||
      !['conserve','steady','hard'].includes(choice.effort)||
      !['finish_safely','rejoin_bunch'].includes(choice.reason))
      throw new Error('Origin finish needs explicit solo choices.');
    bunchAbilityFromPaidTurnsV1(plan);
    const base=segmentBaseSeconds(segment);
    const slices=[];
    for(const turn of plan.turns){
      const effect=riderKilometreEffect(rider,segment,{
        phase:'solo',energy,exposed:segment.exposed});
      const soloSpeedKph=speed(base,effect.ability+
        (TUNING.effortPressure[choice.effort]-1)*20);
      const bunchSpeedKph=speed(base,turn.ability+
        TUNING.breakaway.bunchDraftAdvantage);
      const distanceM=turn.endM-turn.startM;
      const price=priceRearEnergyDemandV1({rider,segment,
        energyBefore:energy,effort:choice.effort,role:'solo',
        distanceM});
      const soloSeconds=distanceM*3.6/soloSpeedKph;
      const bunchSeconds=distanceM*3.6/bunchSpeedKph;
      behindBunchSeconds+=soloSeconds-bunchSeconds;
      if(behindBunchSeconds<=0)
        throw new Error('Origin finish needs a separate bunch-contact road.');
      energy=price.energyAfter;
      riderElapsedSeconds+=soloSeconds;
      bunchElapsedSeconds+=bunchSeconds;
      slices.push({startDistanceM:index*1000+turn.startM,
        endDistanceM:index*1000+turn.endM,
        bunchLeaderRiderId:turn.leaderRiderId,
        soloSpeedKph,bunchSpeedKph,
        energyBefore:price.energyBefore,
        energySpent:price.energyDemand,energyAfter:energy,
        soloSeconds,bunchSeconds,behindBunchSeconds});
    }
    const cap=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:segment.km}).cap;
    const recovery=recoveryForKilometre({rider,segment,
      effort:choice.effort,group:'dropped',working:false,
      quietKm:0});
    if(recovery.recovery!==0||recovery.quietKm!==0)
      throw new Error('Origin finish cannot claim bunch recovery.');
    const capAdjustment=Math.max(0,energy-cap);
    energy=+Math.min(energy,cap).toFixed(3);
    steps.push({sourceKm:segment.km,choice:structuredClone(choice),
      slices,cap,capAdjustment,recoveryAward:0,
      energyAfter:energy,behindBunchSeconds});
  }
  if(Math.abs(riderElapsedSeconds-bunchElapsedSeconds-
    behindBunchSeconds)>1e-6)
    throw new Error('Origin finish clocks do not reconcile.');
  return {version:REAR_ORIGIN_PACE_FINISH_V1_VERSION,
    riderId:rider.id,finishDistanceM:routeKilometres.length*1000,
    finishElapsedSeconds:riderElapsedSeconds,bunchElapsedSeconds,
    behindBunchSeconds,steps,energyAfter:energy,
    timeLimitSeconds:null,officialResults:false};
}

export function validateRearOriginPaceFinishV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runRearOriginPaceFinishV1(input)))
    throw new Error('Origin finish differs from paid source.');
  return true;
}
