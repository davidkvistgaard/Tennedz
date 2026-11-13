// Paid solo remainder after a rider loses a physically carried bunch wheel.
// The split comes from the complete starting-bunch road, not a checkpoint.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {runRearBunchOriginRoadV1} from
  './rear-bunch-origin-road-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_ORIGIN_PACE_SOLO_V1_VERSION=
  'v2-rear-origin-pace-solo-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Origin solo has invalid pace.');
  return 3600/seconds;
};

export function continueRearOriginPaceSoloV1({originInput,origin,
  soloChoice}){
  if(!isDeepStrictEqual(origin,
    runRearBunchOriginRoadV1(originInput))||
    origin.status!=='wheel_lost'||
    origin.steps.at(-1).split?.kind!=='physical_pace_loss'||
    soloChoice?.riderId!==origin.riderId||
    soloChoice.km!==origin.sourceKm||
    !['conserve','steady','hard'].includes(soloChoice.effort)||
    !['finish_safely','rejoin_bunch'].includes(soloChoice.reason))
    throw new Error('Origin solo needs replayed physical wheel loss.');
  const {rider,routeKilometres,bunchTurnPlans}=originInput;
  const segment=routeKilometres[origin.sourceKm-1];
  const plan=bunchTurnPlans[origin.sourceKm-1];
  bunchAbilityFromPaidTurnsV1(plan);
  const splitDistanceM=origin.steps.at(-1).split.atDistanceM;
  const base=segmentBaseSeconds(segment);
  let energy=origin.energyAfter;
  let behindBunchSeconds=0;
  let soloElapsedSeconds=0,bunchElapsedSeconds=0;
  const slices=[];
  for(const turn of plan.turns){
    const startDistanceM=Math.max(splitDistanceM,
      (segment.km-1)*1000+turn.startM);
    const endDistanceM=(segment.km-1)*1000+turn.endM;
    if(endDistanceM<=startDistanceM)continue;
    if(turn.leaderRiderId===rider.id)
      throw new Error('Detached rider cannot lead the later bunch turn.');
    const distanceM=endDistanceM-startDistanceM;
    const effect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const soloSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure[soloChoice.effort]-1)*20);
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:energy,effort:soloChoice.effort,
      role:'solo',distanceM});
    const soloSeconds=distanceM*3.6/soloSpeedKph;
    const bunchSeconds=distanceM*3.6/bunchSpeedKph;
    behindBunchSeconds+=soloSeconds-bunchSeconds;
    if(behindBunchSeconds<=0)
      throw new Error('Origin solo needs a separate bunch-contact road.');
    energy=price.energyAfter;
    soloElapsedSeconds+=soloSeconds;
    bunchElapsedSeconds+=bunchSeconds;
    slices.push({startDistanceM,endDistanceM,
      bunchLeaderRiderId:turn.leaderRiderId,
      bunchSpeedKph,soloSpeedKph,
      energyBefore:price.energyBefore,
      energySpent:price.energyDemand,
      energyAfter:energy,soloSeconds,bunchSeconds,
      behindBunchSeconds});
  }
  if(!slices.length||slices.at(-1).endDistanceM!==
    segment.km*1000)
    throw new Error('Origin solo needs a complete split kilometre.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:routeKilometres,throughKm:segment.km}).cap;
  const recovery=recoveryForKilometre({rider,segment,
    effort:soloChoice.effort,group:'dropped',working:false,
    quietKm:0});
  if(recovery.recovery!==0||recovery.quietKm!==0)
    throw new Error('Origin solo cannot claim bunch recovery.');
  const capAdjustment=Math.max(0,energy-cap);
  energy=+Math.min(energy,cap).toFixed(3);
  return {version:REAR_ORIGIN_PACE_SOLO_V1_VERSION,
    riderId:rider.id,sourceKm:segment.km,
    splitDistanceM,endDistanceM:segment.km*1000,
    soloChoice:structuredClone(soloChoice),slices,
    soloElapsedSeconds,bunchElapsedSeconds,
    behindBunchSeconds,energyBefore:origin.energyAfter,
    paidWork:slices.reduce((sum,row)=>sum+row.energySpent,0),
    recoveryAward:0,cap,capAdjustment,energyAfter:energy,
    status:behindBunchSeconds>TUNING.groups.droppedAtSeconds?
      'solo_behind':'wheel_gap_unresolved',
    officialResults:false};
}

export function validateRearOriginPaceSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,
    continueRearOriginPaceSoloV1(input)))
    throw new Error('Origin solo differs from paid bunch source.');
  return true;
}
