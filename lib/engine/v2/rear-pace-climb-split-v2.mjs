// Opt-in physical solo road for an occupied wheel lost at the first paid
// climbing turn. Each later bunch turn and rider slice shares one clock.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearPaceClimbSplitV1} from
  './rear-pace-climb-split-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from './rear-energy-cap-source-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_PACE_CLIMB_SPLIT_V2_VERSION=
  'v2-rear-pace-climb-split-2';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Climb solo has invalid road pace.');
  return 3600/seconds;
};

export function advanceRearPaceClimbSplitV2(input){
  const prior=advanceRearPaceClimbSplitV1(input);
  const {rider,segment,bunchTurnPlan,energy,soloEffort,
    routeKilometres}=input;
  const startDistanceM=(segment.km-1)*1000;
  if(prior.splitDistanceM!==startDistanceM||
    !isDeepStrictEqual(routeKilometres?.[segment.km-1],segment))
    throw new Error('Climb solo needs a route-bound first-turn split.');
  const capSource=replayRearEnergyCapV1({rider,
    kilometres:routeKilometres,throughKm:segment.km});
  if(energy>capSource.initialCap+1e-6)
    throw new Error('Climb solo cannot start above source capacity.');
  const recovery=recoveryForKilometre({rider,segment,
    effort:soloEffort,group:'dropped',working:false,quietKm:0});
  if(recovery.recovery!==0||recovery.quietKm!==0)
    throw new Error('Climb solo cannot claim bunch recovery.');
  const base=segmentBaseSeconds(segment);
  let reserve=energy,gapSeconds=0;
  const soloSlices=bunchTurnPlan.turns.map(turn=>{
    const distanceM=turn.endM-turn.startM;
    const effect=riderKilometreEffect(rider,segment,{phase:'solo',
      energy:reserve,exposed:segment.exposed});
    const soloSpeedKph=speed(base,effect.ability+
      (TUNING.effortPressure[soloEffort]-1)*20);
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:reserve,effort:soloEffort,role:'solo',distanceM});
    gapSeconds+=distanceM*3.6/soloSpeedKph-
      distanceM*3.6/bunchSpeedKph;
    if(gapSeconds<=0)
      throw new Error('Climb solo did not detach from the paid bunch.');
    reserve=price.energyAfter;
    return {startDistanceM:startDistanceM+turn.startM,
      endDistanceM:startDistanceM+turn.endM,
      bunchLeaderAbility:turn.ability,bunchSpeedKph,soloSpeedKph,
      energyBefore:price.energyBefore,
      energySpent:price.energyDemand,energyAfter:reserve,
      behindBunchSeconds:gapSeconds};
  });
  const capAdjustment=Math.max(0,reserve-capSource.cap);
  const energyAfter=+Math.min(reserve,capSource.cap).toFixed(3);
  return {version:REAR_PACE_CLIMB_SPLIT_V2_VERSION,
    riderId:rider.id,sourceKm:segment.km,decision:prior.decision,
    soloEffort,soloReason:input.soloReason,
    splitDistanceM:startDistanceM,endDistanceM:startDistanceM+1000,
    soloSlices,behindBunchSeconds:gapSeconds,
    energyBefore:energy,paidWork:energy-reserve,
    recoveryAward:0,cap:capSource.cap,capAdjustment,energyAfter,
    status:gapSeconds>TUNING.groups.droppedAtSeconds?
      'solo_behind':'wheel_gap_unresolved',officialResults:false};
}

export function validateRearPaceClimbSplitV2(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearPaceClimbSplitV2(input)))
    throw new Error('Terrain climb solo differs from paid source.');
  return true;
}
