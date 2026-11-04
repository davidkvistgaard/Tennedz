// A follower pays the recorded shelter workload or exhausts the available
// reserve. The prior peloton state and named front are the only group source;
// this does not infer a wheel or a within-kilometre contact point.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {PELOTON_FRONT_TURNS_VERSION} from
  './peloton-front-turns-v1.mjs';

export const V94_PELOTON_FOLLOWER_DECISIONS_VERSION=
  'v94-peloton-follower-decisions-1';
export const V94_PELOTON_FOLLOWER_EFFORT_VERSION=
  'v94-peloton-follower-effort-2';

export function decideV94PelotonFollowerV1({rider,team,stake,segment,
  priorState,plan,draftCost,requestedWorkDemand,aheadRiderIds}){
  const km=segment?.km;
  if(!Number.isInteger(km)||km<1||
    priorState?.id!==rider?.id||priorState?.group!=='peloton'||
    !Number.isFinite(priorState.energy)||priorState.energy<0||
    !team?.riders?.some(row=>row.id===rider.id)||
    !stake||stake.teamId!==team.id||
    !team.riders.some(row=>row.id===stake.sportingCaptainId)||
    typeof stake.sportingGoal!=='string'||
    plan?.version!==PELOTON_FRONT_TURNS_VERSION||
    !['worked','no_front'].includes(plan.status)||
    !Array.isArray(plan.turns)||
    !Array.isArray(aheadRiderIds)||
    aheadRiderIds.includes(rider.id)||
    plan.turns.some(turn=>turn.leaderRiderId===rider.id)||
    !Number.isFinite(requestedWorkDemand)||requestedWorkDemand<0||
    (plan.status==='worked'&&(
      draftCost?.riderId!==rider.id||
      !Number.isFinite(draftCost.baseCostFraction)))||
    (plan.status==='no_front'&&(plan.turns.length||draftCost)))
    throw new Error('Invalid V94 peloton follower source.');
  const order=orderAt(team.orders,km-1);
  const perceivedAbility=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy:priorState.energy,
    exposed:segment.exposed}).ability;
  const available=priorState.energy;
  const canPay=requestedWorkDemand<=available+1e-6;
  return {version:V94_PELOTON_FOLLOWER_DECISIONS_VERSION,
    sourceKm:km,riderId:rider.id,teamId:team.id,
    goal:stake.sportingGoal,
    sportingCaptainId:stake.sportingCaptainId,
    teamOrderEffort:order.effort,
    teamOrderChase:order.chase,
    perceivedAbility,
    energyBefore:available,
    requestedWorkDemand:+requestedWorkDemand.toFixed(6),
    paidFront:plan.status==='worked',
    draftCostFraction:draftCost?.baseCostFraction??1,
    choice:canPay?(plan.status==='worked'?
      'pay_sheltered_peloton_work':'pay_unworked_peloton_work'):
      'coast_after_reserve_exhausted',
    reason:canPay?'payable_ordered_work':
      'insufficient_reserve_for_ordered_work'};
}

export function decideV94PelotonFollowerV2({appliedEffort,
  restApplied=false,...source}){
  const prior=decideV94PelotonFollowerV1(source);
  if(typeof restApplied!=='boolean'||
    !['conserve','steady','hard'].includes(appliedEffort)||
    appliedEffort!==(restApplied?'conserve':prior.teamOrderEffort))
    throw new Error('Invalid V94 follower applied effort source.');
  return {...prior,version:V94_PELOTON_FOLLOWER_EFFORT_VERSION,
    appliedEffort,
    effortSource:restApplied?'recorded_peloton_rest':'team_order',
    reason:prior.choice==='coast_after_reserve_exhausted'?
      restApplied?'insufficient_reserve_for_recorded_rest_work':
        prior.reason:
      restApplied?'payable_recorded_rest_work':prior.reason};
}
