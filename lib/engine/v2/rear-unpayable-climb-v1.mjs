// Isolated climb split when a rider cannot fund a whole-kilometre hard hold.
// An occupied bunch wheel exists at the start; a solo begins only at the
// calculated loss of that wheel, never from a checkpoint deficit alone.
import {isDeepStrictEqual} from 'node:util';
import {decideRiderClimbV1} from './rider-climb-decision-v1.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_UNPAYABLE_CLIMB_VERSION=
  'v2-rear-unpayable-climb-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Climb detachment has invalid pace.');
  return 3600/seconds;
};

export function advanceRearUnpayableClimbV1({rider,segment,energy,
  bunchTurnPlan,stageNumber,stageCount,
  teamOrder='follow_plan',committedStagePlan=null}){
  if(!rider||!Number.isInteger(segment?.km)||
    segment.terrain!=='climb'||
    !Number.isFinite(energy)||energy<0||energy>100)
    throw new Error('Climb loss needs a rider on paid climb road.');
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const holdEffect=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy,exposed:segment.exposed});
  const soloEffect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy,exposed:segment.exposed});
  const holdCostPerKm=TUNING.effortCost.hard*
    holdEffect.energyCostMultiplier*DRAFT_COST_FRACTION;
  const soloCostPerKm=TUNING.effortCost.conserve*
    soloEffect.energyCostMultiplier;
  const decision=decideRiderClimbV1({riderId:rider.id,
    stageNumber,stageCount,terrain:segment.terrain,energy,
    projectedHoldCost:holdCostPerKm,teamOrder,
    committedStagePlan});
  if(decision.choice!=='cannot_hold'||
    energy+1e-9<soloCostPerKm||
    holdCostPerKm<=soloCostPerKm)
    throw new Error('Climb loss needs payable solo road after failed hold.');
  const energySplitM=Math.max(0,Math.min(1000,
    1000*(energy-soloCostPerKm)/
      (holdCostPerKm-soloCostPerKm)));
  const holdAbility=holdEffect.ability+
    (TUNING.effortPressure.hard-1)*20;
  const firstUnholdable=bunchTurnPlan.turns.find(turn=>
    holdAbility+1e-9<turn.ability);
  const paceSplitM=firstUnholdable?.startM??Infinity;
  const splitM=Math.min(energySplitM,paceSplitM);
  const detachmentCause=paceSplitM<=energySplitM?
    'cannot_match_bunch_turn':'insufficient_hold_energy';
  const startM=(segment.km-1)*1000;
  const holdEnergySpent=holdCostPerKm*splitM/1000;
  let remainingEnergy=energy-holdEnergySpent;
  const base=segmentBaseSeconds(segment);
  const soloSlices=[];
  let behindBunchSeconds=0;
  for(const turn of bunchTurnPlan.turns){
    const from=Math.max(splitM,turn.startM);
    const to=turn.endM;
    if(to<=from)continue;
    const fraction=(to-from)/1000;
    const solo=riderKilometreEffect(rider,segment,{
      phase:'solo',energy:remainingEnergy,
        exposed:segment.exposed});
    const soloSpeedKph=speed(base,solo.ability+
      (TUNING.effortPressure.conserve-1)*20);
    const bunchSpeedKph=speed(base,turn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const energySpent=soloCostPerKm*fraction;
    if(energySpent>remainingEnergy+1e-9)
      throw new Error('Detached rider cannot pay the remaining climb.');
    const delta=(to-from)*3.6/soloSpeedKph-
      (to-from)*3.6/bunchSpeedKph;
    behindBunchSeconds+=delta;
    if(behindBunchSeconds<=0)
      throw new Error('Failed hold did not create a detached road.');
    const energyBefore=remainingEnergy;
    remainingEnergy=Math.max(0,remainingEnergy-energySpent);
    soloSlices.push({startDistanceM:startM+from,
      endDistanceM:startM+to,bunchLeaderAbility:turn.ability,
      bunchSpeedKph,soloSpeedKph,energyBefore,
      energySpent,energy:remainingEnergy,
      behindBunchSeconds});
  }
  const status=behindBunchSeconds>
    TUNING.groups.droppedAtSeconds?'solo_behind':
    'wheel_gap_unresolved';
  return {version:REAR_UNPAYABLE_CLIMB_VERSION,
    riderId:rider.id,sourceKm:segment.km,decision,
    detachmentCause,splitDistanceM:startM+splitM,
    endDistanceM:startM+1000,
    holdEnergySpent,soloSlices,
    energyBefore:energy,energyAfter:remainingEnergy,
    behindBunchSeconds,status};
}

export function validateRearUnpayableClimbV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearUnpayableClimbV1(input)))
    throw new Error('Climb detachment differs from paid source.');
  return true;
}
