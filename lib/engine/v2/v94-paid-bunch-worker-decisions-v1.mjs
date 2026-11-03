// Opt-in choices for named, paid V94 bunch turns. A turn plan is a
// committed source; it does not choose shelter or decide other riders.
import {orderAt} from './orders.mjs';
import {PELOTON_FRONT_TURNS_VERSION} from
  './peloton-front-turns-v1.mjs';

export const V94_PAID_BUNCH_WORKER_DECISIONS_VERSION=
  'v94-paid-bunch-worker-decisions-1';

export function decideV94PaidBunchWorkersV1({
  plan,teams,intent,km}){
  if(!Number.isInteger(km)||km<1||
    plan?.version!==PELOTON_FRONT_TURNS_VERSION||
    !['worked','no_front'].includes(plan.status)||
    !Array.isArray(plan.turns)||
    !Array.isArray(plan.extraEnergyCosts)||
    !Array.isArray(teams)||!Array.isArray(intent)||
    intent.length!==teams.length||
    intent.some(row=>typeof row.sportingGoal!==
      'string'||!row.sportingCaptainId))
    throw new Error('Paid worker decisions need committed V94 stakes and turns.');
  if(plan.status==='no_front'){
    if(plan.turns.length||plan.extraEnergyCosts.length)
      throw new Error('No-front plan cannot name a worker.');
    return [];
  }
  const byTeam=new Map(teams.map(team=>[team.id,team]));
  const stakeByTeam=new Map(intent.map(row=>[
    row.teamId,row]));
  const costByRider=new Map(plan.extraEnergyCosts.map(row=>[
    row.riderId,row]));
  if(byTeam.size!==teams.length||
    stakeByTeam.size!==teams.length||
    costByRider.size!==plan.turns.length||
    plan.turns[0]?.startM!==0||
    plan.turns.at(-1)?.endM!==1000||
    plan.turns.some((turn,index)=>
      turn.startM!==(index?
        plan.turns[index-1].endM:0)||
      turn.endM<=turn.startM)||
    new Set(plan.turns.map(turn=>
      turn.leaderRiderId)).size!==plan.turns.length)
    throw new Error('Paid worker decisions need one sourced leader per metre.');
  return plan.turns.map(turn=>{
    const team=byTeam.get(turn.teamId);
    const stake=stakeByTeam.get(turn.teamId);
    const riderId=turn.leaderRiderId;
    const cost=costByRider.get(riderId);
    if(!team?.riders.some(rider=>rider.id===riderId)||
      !stake||!team.riders.some(rider=>
        rider.id===stake.sportingCaptainId)||
      !['front','chase'].includes(turn.workKind)||
      !cost||cost.teamId!==turn.teamId||
      cost.workKind!==turn.workKind||
      cost.leadingM!==turn.endM-turn.startM||
      !Number.isFinite(cost.extraCost)||
      cost.extraCost<=0)
      throw new Error('Paid worker choice differs from named turn and stake.');
    const order=orderAt(team.orders,km-1);
    if(turn.workKind==='front'&&
      order.frontWork!=='rotate')
      throw new Error('Paid front choice lacks a manager front order.');
    return {version:V94_PAID_BUNCH_WORKER_DECISIONS_VERSION,
      sourceKm:km,riderId,teamId:team.id,
      goal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      teamOrderEffort:order.effort,
      teamOrderFrontWork:order.frontWork??null,
      teamOrderChase:order.chase,
      choice:turn.workKind==='front'?
        'take_paid_front_turn':'take_paid_chase_turn',
      reason:'committed_order_and_paid_turn',
      startM:turn.startM,endM:turn.endM,
      paidExtraCost:cost.extraCost};
  });
}
