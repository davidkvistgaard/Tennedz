// Sustainable solo coast after a source-replayed bunch worker runs out of
// effort reserve. The existing exhaustion clock prices the unpaid demand.
import {isDeepStrictEqual} from 'node:util';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {advanceRearBunchEnergyLossV1} from
  './rear-bunch-energy-loss-v1.mjs';
import {quoteRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {exhaustionCoastDelaySeconds} from './energy-coast.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_EXHAUSTED_SOLO_V1_VERSION=
  'v2-rear-exhausted-solo-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Exhausted solo has invalid pace.');
  return 3600/seconds;
};

export function continueRearExhaustedSoloV1({lossInput,loss,
  soloEffort='conserve',soloReason='finish_safely'}){
  if(!isDeepStrictEqual(loss,
    advanceRearBunchEnergyLossV1(lossInput))||
    loss.status!=='wheel_lost'||
    loss.split.kind!=='physical_energy_loss'||
    loss.energyAfter!==0||
    soloEffort!=='conserve'||soloReason!=='finish_safely')
    throw new Error('Exhausted solo needs exact paid wheel-loss source.');
  const {segment,bunchTurnPlan,priorInput,
    routeKilometres}=lossInput;
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const rider=priorInput.rider;
  const base=segmentBaseSeconds(segment);
  const soloEffect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:0,exposed:segment.exposed});
  const soloBaseSpeedKph=speed(base,soloEffect.ability+
    (TUNING.effortPressure.conserve-1)*20);
  const demand=quoteRearEnergyDemandV1({rider,segment,
    energyBefore:0,effort:soloEffort,
    role:'solo',distanceM:1000}).energyDemand;
  const coastDelaySecondsPerKm=exhaustionCoastDelaySeconds(
    segment,demand,0);
  const coastSecondsPerKm=3600/soloBaseSpeedKph+
    coastDelaySecondsPerKm;
  const coastSpeedKph=3600/coastSecondsPerKm;
  let behindBunchSeconds=0;
  let soloElapsedSeconds=0;
  let bunchElapsedSeconds=0;
  const slices=[];
  for(const turn of bunchTurnPlan.turns){
    const startDistanceM=Math.max(loss.endDistanceM,
      (segment.km-1)*1000+turn.startM);
    const endDistanceM=(segment.km-1)*1000+turn.endM;
    if(endDistanceM<=startDistanceM)continue;
    if(turn.leaderRiderId===rider.id)
      throw new Error('Exhausted rider cannot lead the later bunch turn.');
    const distanceM=endDistanceM-startDistanceM;
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const soloSeconds=distanceM*coastSecondsPerKm/1000;
    const bunchSeconds=distanceM*3.6/bunchSpeedKph;
    behindBunchSeconds+=soloSeconds-bunchSeconds;
    if(behindBunchSeconds<=0)
      throw new Error('Exhausted solo needs a separate bunch-contact road.');
    soloElapsedSeconds+=soloSeconds;
    bunchElapsedSeconds+=bunchSeconds;
    slices.push({startDistanceM,endDistanceM,
      bunchLeaderAbility:turn.ability,
      bunchSpeedKph,soloBaseSpeedKph,coastSpeedKph,
      requestedWorkDemand:demand*distanceM/1000,
      curtailedWorkDemand:demand*distanceM/1000,
      paidFromReserve:0,coastDelaySeconds:
        coastDelaySecondsPerKm*distanceM/1000,
      soloSeconds,bunchSeconds,behindBunchSeconds});
  }
  if(!slices.length||slices.at(-1).endDistanceM!==
    segment.km*1000)
    throw new Error('Exhausted solo needs paid remainder to kilometre end.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:routeKilometres,throughKm:segment.km}).cap;
  const recovery=recoveryForKilometre({rider,segment,
    effort:soloEffort,group:'dropped',working:false,quietKm:0});
  if(recovery.recovery!==0||recovery.quietKm!==0)
    throw new Error('Exhausted rear solo cannot claim bunch recovery.');
  return {version:REAR_EXHAUSTED_SOLO_V1_VERSION,
    riderId:rider.id,sourceKm:segment.km,
    splitDistanceM:loss.endDistanceM,
    endDistanceM:segment.km*1000,
    soloEffort,soloReason,slices,
    soloElapsedSeconds,bunchElapsedSeconds,
    behindBunchSeconds,energyBefore:0,
    paidFromReserve:0,cap,recoveryAward:0,
    energyAfter:0,status:behindBunchSeconds>
      TUNING.groups.droppedAtSeconds?'solo_behind':
      'wheel_gap_unresolved',
    officialResults:false};
}

export function validateRearExhaustedSoloV1(input,recording){
  if(!isDeepStrictEqual(recording,
    continueRearExhaustedSoloV1(input)))
    throw new Error('Exhausted solo differs from paid wheel-loss source.');
  return true;
}
