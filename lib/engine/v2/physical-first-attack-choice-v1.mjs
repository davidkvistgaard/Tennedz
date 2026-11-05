// A boundary attack is a rider choice, never a source-frame gap. The
// physical road step and replay check any attempted movement separately.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_ATTACK_CHOICE_VERSION=
  'physical-first-attack-choice-1';

export function choosePhysicalFirstBoundaryAttacksV1({prior,segment,
  teams,stakes}){
  const km=prior?.sourceKm+1;
  const bunch=prior?.roads?.find(row=>row.roadId==='peloton');
  if(!Number.isInteger(km)||segment?.km!==km||
    !Array.isArray(bunch?.riderIds)||!Array.isArray(prior?.riders)||
    !Array.isArray(teams)||!Array.isArray(stakes)||
    new Set(bunch.riderIds).size!==bunch.riderIds.length)
    throw new Error('Attack choices need a measured bunch.');
  const states=new Map(prior.riders.map(row=>[row.riderId,row]));
  const byStake=new Map(stakes.map(row=>[row.teamId,row]));
  if(states.size!==prior.riders.length||
    byStake.size!==stakes.length)
    throw new Error('Attack choices need distinct committed inputs.');
  const present=new Set(bunch.riderIds);
  return teams.map(team=>{
    const order=orderAt(team.orders,km-1);
    const stake=byStake.get(team.id);
    if(!stake?.sportingGoal||!stake.sportingCaptainId||
      !['none','selective','repeated'].includes(order.attack))
      throw new Error('Attack choice lacks committed order or stake.');
    const named=order.attackRiderId??null;
    if(named&&!team.riders.some(rider=>rider.id===named))
      throw new Error('Named attacker is not on the ordered team.');
    const specialist=stake.specialistRiderId??null;
    if(specialist&&!team.riders.some(rider=>rider.id===specialist))
      throw new Error('Committed specialist is not on the team.');
    const goalSupportsAttack=['break_stage','summit_attack']
      .includes(stake.sportingGoal);
    const candidates=team.riders.filter(rider=>
      present.has(rider.id)&&(!named||rider.id===named)&&
      (named||!team.orders.helperIds?.includes(rider.id)||
        order.helperAttackPolicy==='open'||
        order.helperAttackPolicy==='release_if_dropped'&&
          !present.has(stake.sportingCaptainId))).map(rider=>{
      const state=states.get(rider.id);
      if(state?.roadId!=='peloton'||
        state.distanceM!==(km-1)*1000||
        Math.abs(state.clockSeconds-bunch.clockSeconds)>.002||
        !Number.isFinite(state.reserve))
        throw new Error('Attacker lacks measured bunch contact.');
      const perceivedAbility=riderKilometreEffect(rider,segment,{
        phase:'attack',energy:state.reserve,
        exposed:segment.exposed}).ability+
        (TUNING.effortPressure[order.effort]-1)*20;
      return {riderId:rider.id,perceivedAbility,
        reserve:state.reserve};
    }).sort((a,b)=>
      (!named&&specialist?
        Number(b.riderId===specialist)-
          Number(a.riderId===specialist):0)||
      b.perceivedAbility-a.perceivedAbility||
      a.riderId.localeCompare(b.riderId));
    const attackCost=order.attack==='repeated'?
      TUNING.attack.repeatedCost:TUNING.attack.selectiveCost;
    const payable=row=>row.reserve>=
      Math.max(attackCost,TUNING.attack.minEnergyFraction*100);
    const candidate=candidates.find(payable)??candidates[0]??null;
    const canPay=candidate&&candidate.reserve>=
      Math.max(attackCost,TUNING.attack.minEnergyFraction*100);
    const choice=order.attack==='none'?'hold_no_attack_order':
      !candidate?'hold_no_available_attacker':
      !canPay?'hold_insufficient_reserve':
      !named&&!goalSupportsAttack?'hold_no_sporting_stake':
      'attempt_paid_attack';
    return {version:PHYSICAL_FIRST_ATTACK_CHOICE_VERSION,
      sourceKm:km,teamId:team.id,
      teamOrderAttack:order.attack,
      namedAttackerRiderId:named,
      committedSpecialistRiderId:specialist,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      riderId:candidate?.riderId??null,
      perceivedAbilityAtChoice:candidate?.perceivedAbility??null,
      reserveAtChoice:candidate?.reserve??null,
      attackInitiationCost:choice==='attempt_paid_attack'?
        attackCost:0,
      choice,officialResults:false};
  });
}
