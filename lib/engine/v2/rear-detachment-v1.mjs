// Isolated climb entry from an occupied bunch wheel. A new rear clock starts
// only from this explicit paid kilometre, never from a provisional deficit.
import {isDeepStrictEqual} from 'node:util';
import {decideRiderClimbV1} from './rider-climb-decision-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_DETACHMENT_VERSION='v2-rear-detachment-1';
// Candidate shelter price, deliberately isolated until group-road calibration.
const DRAFT_COST_FRACTION=.8;
const effortAbility=effort=>(TUNING.effortPressure[effort]-1)*20;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function bunchAbilityFromPaidTurnsV1(plan){
  if(plan?.status!=='worked'||!Array.isArray(plan.turns)||!plan.turns.length||
    !Number.isFinite(plan.leaderAbility)||
    plan.turns.some((turn,index)=>
      !Number.isInteger(turn.startM)||!Number.isInteger(turn.endM)||
      turn.startM!==(index?plan.turns[index-1].endM:0)||
      turn.endM<=turn.startM||!Number.isFinite(turn.ability))||
    plan.turns.at(-1).endM!==1000)
    throw new Error('Rear entry needs a complete paid bunch turn source.');
  const calculated=+(plan.turns.reduce((sum,turn)=>sum+
    turn.ability*(turn.endM-turn.startM),0)/1000).toFixed(3);
  if(Math.abs(calculated-plan.leaderAbility)>1e-6)
    throw new Error('Rear entry bunch ability differs from paid turns.');
  return calculated;
}

export function advanceRearDetachmentV1({rider,segment,energy,
  bunchTurnPlan,stageNumber,stageCount,teamOrder='follow_plan',
  committedStagePlan=null}){
  if(!rider||typeof rider.id!=='string'||!rider.id||
    segment?.terrain!=='climb'||!Number.isInteger(segment.km)||
    segment.km<1||!Number.isFinite(energy)||energy<0||energy>100)
    throw new Error('Rear detachment needs a rider and paid climb source.');
  const bunchLeaderAbility=bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const holdEffect=riderKilometreEffect(rider,segment,{phase:'cruise',
    energy,exposed:segment.exposed});
  const projectedHoldCost=TUNING.effortCost.hard*
    holdEffect.energyCostMultiplier*DRAFT_COST_FRACTION;
  const decision=decideRiderClimbV1({riderId:rider.id,stageNumber,
    stageCount,terrain:segment.terrain,energy,projectedHoldCost,
    teamOrder,committedStagePlan});
  if(decision.choice==='cannot_hold')
    throw new Error('Unpayable climb hold needs a within-kilometre coast clock.');
  const released=decision.choice==='release';
  const effort=released?'conserve':'hard';
  const effect=released?riderKilometreEffect(rider,segment,{phase:'solo',
    energy,exposed:segment.exposed}):holdEffect;
  const paidCost=TUNING.effortCost[effort]*effect.energyCostMultiplier*
    (released?1:DRAFT_COST_FRACTION);
  if(paidCost>energy+1e-9)
    throw new Error('Climb decision cannot pay its committed effort.');
  const riderAbility=effect.ability+effortAbility(effort)+
    (released?0:TUNING.breakaway.bunchDraftAdvantage);
  const bunchAbility=bunchLeaderAbility+TUNING.breakaway.bunchDraftAdvantage;
  const behindBunchSeconds=clamp((bunchAbility-riderAbility)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint,0,
  MOTOR_RACE_DYNAMICS.maxPassiveDeltaSecondsPerKm);
  // A sub-threshold time difference cannot establish that the rider lost
  // the occupied wheel. Keep it observable but do not create a rear solo.
  const status=behindBunchSeconds===0?'bunch_contact':
    behindBunchSeconds<=TUNING.groups.droppedAtSeconds?
      'wheel_gap_unresolved':'solo_behind';
  return {version:REAR_DETACHMENT_VERSION,riderId:rider.id,
    sourceKm:segment.km,startDistanceM:(segment.km-1)*1000,
    endDistanceM:segment.km*1000,decision,effort,
    bunchAbility:+bunchAbility.toFixed(3),
    riderAbility:+riderAbility.toFixed(3),
    energyBefore:energy,energySpent:+paidCost.toFixed(6),
    energyAfter:+(energy-paidCost).toFixed(6),
    behindBunchSeconds:+behindBunchSeconds.toFixed(6),status};
}

export function validateRearDetachmentV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearDetachmentV1(input)))
    throw new Error('Rear detachment differs from its rider and climb source.');
  return true;
}
