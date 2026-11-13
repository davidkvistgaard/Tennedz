// Isolated actual elapsed time for one exhausted rear solo. Every remaining
// kilometre is named, source-priced and explicitly chosen; no time limit or
// official placing is inferred from the clock.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {exhaustionCoastDelaySeconds} from './energy-coast.mjs';
import {continueRearExhaustedSoloV1} from
  './rear-exhausted-solo-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_EXHAUSTED_FINISH_V1_VERSION=
  'v2-rear-exhausted-finish-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Exhausted finish has invalid pace.');
  return 3600/seconds;
};

export function runRearExhaustedFinishV1({soloInput,solo,
  routeKilometres,bunchTurnPlans,soloChoices}){
  if(!isDeepStrictEqual(solo,
    continueRearExhaustedSoloV1(soloInput))||
    !Array.isArray(routeKilometres)||
    routeKilometres.length<solo.sourceKm||
    !Array.isArray(bunchTurnPlans)||
    bunchTurnPlans.length!==routeKilometres.length||
    !Array.isArray(soloChoices)||
    soloChoices.length!==routeKilometres.length-solo.sourceKm)
    throw new Error('Exhausted finish needs replayed paid solo source.');
  const {lossInput}=soloInput;
  const {priorInput}=lossInput;
  const {loss}=soloInput;
  if(!isDeepStrictEqual(routeKilometres.slice(0,solo.sourceKm),
    lossInput.routeKilometres)||
    !isDeepStrictEqual(bunchTurnPlans.slice(0,priorInput.routeKilometres.length),
      priorInput.bunchTurnPlans)||
    !isDeepStrictEqual(bunchTurnPlans[solo.sourceKm-1],
      lossInput.bunchTurnPlan))
    throw new Error('Exhausted finish route differs from prior source.');
  const rider=priorInput.rider;
  let riderElapsedSeconds=0,bunchElapsedSeconds=0;
  for(const step of lossInput.prior.steps)
    for(const slice of step.slices){
      const seconds=(slice.endDistanceM-slice.startDistanceM)*
        3.6/slice.bunchSpeedKph;
      riderElapsedSeconds+=seconds;
      bunchElapsedSeconds+=seconds;
    }
  for(const slice of loss.slices){
    const seconds=(slice.endDistanceM-slice.startDistanceM)*
      3.6/slice.bunchSpeedKph;
    riderElapsedSeconds+=seconds;
    bunchElapsedSeconds+=seconds;
  }
  riderElapsedSeconds+=solo.soloElapsedSeconds;
  bunchElapsedSeconds+=solo.bunchElapsedSeconds;
  let behindBunchSeconds=solo.behindBunchSeconds;
  const steps=[];
  for(let index=solo.sourceKm;index<routeKilometres.length;index++){
    const segment=routeKilometres[index];
    const plan=bunchTurnPlans[index];
    const choice=soloChoices[index-solo.sourceKm];
    if(segment?.km!==index+1||plan?.status!=='worked'||
      choice?.riderId!==rider.id||choice.km!==segment.km||
      choice.effort!=='conserve'||
      choice.reason!=='finish_safely'||
      plan.turns?.some(turn=>turn.leaderRiderId===rider.id))
      throw new Error('Exhausted finish needs explicit solo road.');
    bunchAbilityFromPaidTurnsV1(plan);
    const base=segmentBaseSeconds(segment);
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:0,exposed:segment.exposed});
    const soloBaseSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure.conserve-1)*20);
    const demand=quoteRearEnergyDemandV1({rider,segment,
      energyBefore:0,effort:'conserve',role:'solo',
      distanceM:1000}).energyDemand;
    const coastDelaySecondsPerKm=exhaustionCoastDelaySeconds(
      segment,demand,0);
    const coastSecondsPerKm=3600/soloBaseSpeedKph+
      coastDelaySecondsPerKm;
    const slices=[];
    for(const turn of plan.turns){
      const distanceM=turn.endM-turn.startM;
      const bunchSpeedKph=speed(base,turn.ability+
        TUNING.breakaway.bunchDraftAdvantage);
      const riderSeconds=distanceM*coastSecondsPerKm/1000;
      const bunchSeconds=distanceM*3.6/bunchSpeedKph;
      behindBunchSeconds+=riderSeconds-bunchSeconds;
      if(behindBunchSeconds<=0)
        throw new Error('Exhausted finish needs paid bunch contact.');
      riderElapsedSeconds+=riderSeconds;
      bunchElapsedSeconds+=bunchSeconds;
      slices.push({startDistanceM:index*1000+turn.startM,
        endDistanceM:index*1000+turn.endM,
        bunchLeaderRiderId:turn.leaderRiderId,
        bunchSpeedKph,soloBaseSpeedKph,
        coastSecondsPerKm,
        requestedWorkDemand:demand*distanceM/1000,
        curtailedWorkDemand:demand*distanceM/1000,
        paidFromReserve:0,riderSeconds,bunchSeconds,
        behindBunchSeconds});
    }
    const cap=replayRearEnergyCapV1({rider,
      kilometres:routeKilometres,throughKm:segment.km}).cap;
    const recovery=recoveryForKilometre({rider,segment,
      effort:'conserve',group:'dropped',working:false,
      quietKm:0});
    if(recovery.recovery!==0||recovery.quietKm!==0)
      throw new Error('Exhausted finish cannot claim bunch recovery.');
    steps.push({sourceKm:segment.km,choice:structuredClone(choice),
      slices,cap,recoveryAward:0,energyAfter:0,
      behindBunchSeconds});
  }
  if(Math.abs(riderElapsedSeconds-bunchElapsedSeconds-
    behindBunchSeconds)>1e-6)
    throw new Error('Exhausted finish clocks do not reconcile.');
  return {version:REAR_EXHAUSTED_FINISH_V1_VERSION,
    riderId:rider.id,finishDistanceM:routeKilometres.length*1000,
    finishElapsedSeconds:riderElapsedSeconds,
    bunchElapsedSeconds,behindBunchSeconds,
    steps,energyAfter:0,timeLimitSeconds:null,
    officialResults:false};
}

export function validateRearExhaustedFinishV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearExhaustedFinishV1(input)))
    throw new Error('Exhausted finish differs from paid source.');
  return true;
}
