// Sourced launch choices for riders not yet in a road group when the
// kilometre begins. Road-group work is decided separately thereafter.
import {orderAt} from './orders.mjs';
import {TUNING} from './tuning.mjs';

export const V94_FRESH_ATTACK_DECISIONS_VERSION=
  'v94-fresh-attack-decisions-1';
const REASONS=new Set(['gc_target','named_order','keypoint',
  'preset_cadence']);

export function decideV94FreshAttacksV1({
  attackers,teams,intent,km}){
  if(!Number.isInteger(km)||km<1||
    !Array.isArray(attackers)||!Array.isArray(teams)||
    !Array.isArray(intent)||intent.length!==teams.length||
    new Set(attackers.map(row=>row.riderId)).size!==
      attackers.length||
    new Set(intent.map(row=>row.teamId)).size!==teams.length)
    throw new Error('Invalid V94 fresh attack decision source.');
  const teamById=new Map(teams.map(team=>[team.id,team]));
  const stakeByTeam=new Map(intent.map(row=>[row.teamId,row]));
  if(teamById.size!==teams.length)
    throw new Error('Duplicate attack decision team.');
  return attackers.map(attack=>{
    const team=teamById.get(attack.teamId);
    const stake=stakeByTeam.get(attack.teamId);
    const order=team&&orderAt(team.orders,km-1);
    if(!team?.riders.some(row=>row.id===attack.riderId)||
      !stake||typeof stake.sportingGoal!=='string'||
      !team.riders.some(row=>
        row.id===stake.sportingCaptainId)||
      !REASONS.has(attack.reason)||
      !Number.isFinite(attack.pressure)||
      attack.pressure<=0||
      attack.reason==='named_order'&&
        order.attackRiderId!==attack.riderId||
      attack.reason!=='gc_target'&&
        !['selective','repeated'].includes(order.attack))
      throw new Error('Fresh attack choice differs from committed source.');
    const effectiveAttack=attack.reason==='gc_target'?
      'selective':order.attack;
    return {version:V94_FRESH_ATTACK_DECISIONS_VERSION,
      sourceKm:km,riderId:attack.riderId,
      teamId:team.id,goal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      teamOrderEffort:order.effort,
      teamOrderAttack:order.attack,
      attackReason:attack.reason,
      choice:'launch_paid_attack',
      attackPressure:attack.pressure,
      paidExtraCost:effectiveAttack==='repeated'?
        TUNING.attack.repeatedCost:
        TUNING.attack.selectiveCost};
  });
}
