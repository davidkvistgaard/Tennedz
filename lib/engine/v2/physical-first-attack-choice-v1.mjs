// A boundary attack is a rider choice, never a source-frame gap. The
// physical road step and replay check any attempted movement separately.
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {MOTOR_RACE_DYNAMICS,TUNING} from './tuning.mjs';

export const PHYSICAL_FIRST_ATTACK_CHOICE_VERSION=
  'physical-first-attack-choice-4';

export function choosePhysicalFirstBoundaryAttacksV1({prior,segment,
  teams,stakes,kilometres=null}){
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
    const phaseStarts=team.orders.phases?.some(phase=>
      phase.atKm===km-1&&
      (phase.attack!==undefined||
        phase.attackRiderId!==undefined))??false;
    const attackWindow=named?'named_order':
      phaseStarts?'committed_phase':
      order.attack==='repeated'&&
        km%TUNING.attack.repeatedEveryKm===0?
        'ordered_repeated_window':
      order.attack==='selective'&&
        km%TUNING.attack.selectiveEveryKm===0?
        'ordered_selective_window':null;
    const teamRiderIds=new Set(team.riders.map(
      rider=>rider.id));
    const forwardRiders=prior.riders.filter(row=>
      teamRiderIds.has(row.riderId)&&
      row.roadId!=='peloton'&&
      row.clockSeconds<bunch.clockSeconds-.002)
      .sort((a,b)=>b.clockSeconds-
        a.clockSeconds);
    const forwardRiderCount=forwardRiders.length;
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
    let bridge=null;
    if(candidate&&forwardRiderCount===1&&
      !named&&!phaseStarts){
      const forward=forwardRiders[0];
      const forwardSource=team.riders.find(row=>
        row.id===forward.riderId);
      const candidateSource=team.riders.find(row=>
        row.id===candidate.riderId);
      if(!Array.isArray(kilometres)||
        kilometres[km-1]?.km!==km||
        !Number.isFinite(forward.reserve)||
        !Number.isFinite(candidate.reserve))
        throw new Error(
          'Forward bridge choice needs committed remaining route.');
      const soloAbility=(rider,energy,effort)=>
        riderKilometreEffect(rider,segment,{
          phase:'solo',energy,
          exposed:segment.exposed}).ability+
        (TUNING.effortPressure[effort]-1)*20;
      const candidateSustainedAbility=soloAbility(
        candidateSource,candidate.reserve,
        order.effort);
      const forwardSustainedAbility=soloAbility(
        forwardSource,forward.reserve,
        order.effort);
      const measuredGapSeconds=bunch.clockSeconds-
        forward.clockSeconds;
      const closingSecondsPerKm=Math.max(0,
        candidateSustainedAbility-
          forwardSustainedAbility)*
        MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
      const remainingKm=kilometres.length-km+1;
      const projectedContactKm=closingSecondsPerKm>0?
        measuredGapSeconds/closingSecondsPerKm:
        null;
      bridge={forwardRiderId:forward.riderId,
        measuredGapSeconds,
        candidateSustainedAbility,
        forwardSustainedAbility,
        closingSecondsPerKm,
        remainingKm,projectedContactKm,
        minimumSharedKm:
          TUNING.breakaway.reciprocalPullEveryKm};
    }
    const choice=order.attack==='none'?'hold_no_attack_order':
      !attackWindow?'hold_until_ordered_attack_window':
      forwardRiderCount>=TUNING.breakaway
        .maxRidersPerTeam?
        'hold_team_forward_limit':
      !candidate?'hold_no_available_attacker':
      !canPay?'hold_insufficient_reserve':
      !named&&!goalSupportsAttack?'hold_no_sporting_stake':
      bridge&&(bridge.projectedContactKm===null||
        bridge.projectedContactKm+
        bridge.minimumSharedKm>
        bridge.remainingKm)?
        'hold_unhelpful_forward_bridge':
      'attempt_paid_attack';
    return {version:PHYSICAL_FIRST_ATTACK_CHOICE_VERSION,
      sourceKm:km,teamId:team.id,
      teamOrderAttack:order.attack,
      attackWindow,
      forwardRiderCount,
      bridge,
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
