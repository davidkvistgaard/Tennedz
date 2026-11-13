// An isolated occupied wheel can be lost when a named bunch turn exceeds the
// rider's hard climbing pace. The rider then pays an explicit solo effort.
import {isDeepStrictEqual} from 'node:util';
import {decideRiderClimbV1} from './rider-climb-decision-v1.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_PACE_CLIMB_SPLIT_VERSION=
  'v2-rear-pace-climb-split-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Climb split has invalid road pace.');
  return 3600/seconds;
};

export function advanceRearPaceClimbSplitV1({rider,segment,energy,
  bunchTurnPlan,stageNumber,stageCount,
  teamOrder='follow_plan',committedStagePlan=null,
  soloEffort,soloReason}){
  if(typeof rider?.id!=='string'||!rider.id||
    !Number.isInteger(segment?.km)||segment.km<1||
    segment.terrain!=='climb'||
    !Number.isFinite(energy)||energy<0||energy>100||
    !['conserve','steady','hard'].includes(soloEffort)||
    !['finish_safely','rejoin_bunch'].includes(soloReason))
    throw new Error('Pace split needs an occupied climb wheel and solo goal.');
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const holdEffect=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy,exposed:segment.exposed});
  const holdCostPerKm=TUNING.effortCost.hard*
    holdEffect.energyCostMultiplier*DRAFT_COST_FRACTION;
  const decision=decideRiderClimbV1({riderId:rider.id,
    stageNumber,stageCount,terrain:segment.terrain,energy,
    projectedHoldCost:holdCostPerKm,teamOrder,
    committedStagePlan});
  if(decision.choice!=='hold')
    throw new Error('Pace split needs a committed hard hold attempt.');
  const holdAbility=holdEffect.ability+
    (TUNING.effortPressure.hard-1)*20;
  const firstUnholdable=bunchTurnPlan.turns.find(turn=>
    holdAbility+1e-9<turn.ability);
  if(!firstUnholdable)
    throw new Error('Rider can match every paid bunch turn.');
  const splitM=firstUnholdable.startM;
  let remainingEnergy=energy-holdCostPerKm*splitM/1000;
  const base=segmentBaseSeconds(segment);
  const soloSlices=[];
  let behindBunchSeconds=0;
  const startM=(segment.km-1)*1000;
  for(const turn of bunchTurnPlan.turns){
    const from=Math.max(splitM,turn.startM);
    const to=turn.endM;
    if(to<=from)continue;
    const fraction=(to-from)/1000;
    const solo=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:remainingEnergy,
      exposed:segment.exposed});
    const soloAbility=solo.ability+
      (TUNING.effortPressure[soloEffort]-1)*20;
    const soloSpeedKph=speed(base,soloAbility);
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const energySpent=fraction*TUNING.effortCost[soloEffort]*
      solo.energyCostMultiplier;
    if(energySpent>remainingEnergy+1e-9)
      throw new Error('Climb split cannot pay its chosen solo work.');
    behindBunchSeconds+=(to-from)*3.6/soloSpeedKph-
      (to-from)*3.6/bunchSpeedKph;
    if(behindBunchSeconds<=0)
      throw new Error('Pace loss did not create a detached road.');
    const energyBefore=remainingEnergy;
    remainingEnergy=Math.max(0,remainingEnergy-energySpent);
    soloSlices.push({startDistanceM:startM+from,
      endDistanceM:startM+to,bunchLeaderAbility:turn.ability,
      bunchSpeedKph,soloSpeedKph,energyBefore,
      energySpent,energy:remainingEnergy,
      behindBunchSeconds});
  }
  return {version:REAR_PACE_CLIMB_SPLIT_VERSION,
    riderId:rider.id,sourceKm:segment.km,decision,
    soloEffort,soloReason,
    splitDistanceM:startM+splitM,endDistanceM:startM+1000,
    holdEnergySpent:holdCostPerKm*splitM/1000,
    soloSlices,energyBefore:energy,energyAfter:remainingEnergy,
    behindBunchSeconds,
    status:behindBunchSeconds>TUNING.groups.droppedAtSeconds?
      'solo_behind':'wheel_gap_unresolved'};
}

export function validateRearPaceClimbSplitV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearPaceClimbSplitV1(input)))
    throw new Error('Climb pace split differs from paid source.');
  return true;
}
