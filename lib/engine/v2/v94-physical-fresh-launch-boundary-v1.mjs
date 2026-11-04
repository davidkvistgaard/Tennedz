// A source-backed boundary observation before fresh attackers move.
// It grants no break road, wheel, gap, shelter or new energy payment.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {TUNING} from './tuning.mjs';

export const V94_PHYSICAL_FRESH_LAUNCH_BOUNDARY_VERSION=
  'v94-physical-fresh-launch-boundary-1';
export const V94_PHYSICAL_FRESH_LAUNCH_DECISION_VERSION=
  'v94-physical-fresh-launch-decision-1';

export function inspectV94PhysicalFreshLaunchBoundaryV1(
  recording,prior){
  const km=prior?.sourceKm+1;
  const frame=recording.frames[km-1];
  const segment=recording.route.kilometres[km-1];
  if(!Number.isInteger(km)||km<2||
    !prior.fullFieldKilometre||segment?.km!==km||
    !frame?.attackers.length||
    !Number.isFinite(prior.front?.frontClockSeconds))
    throw new Error('Fresh launch needs a paid prior peloton.');
  const priorById=new Map(prior.finishes.map(row=>
    [row.riderId,row]));
  const sourceById=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,{rider,team}])));
  const stakeByTeam=new Map(
    recording.committedInputs.rivalIntent?.map(row=>
      [row.teamId,row])??[]);
  const sourceDecisions=new Map(
    frame.freshAttackRiderDecisions?.map(row=>
      [row.riderId,row])??[]);
  const sourceLedger=new Map(frame.energyLedger.map(row=>
    [row.riderId,row]));
  if(sourceDecisions.size!==frame.attackers.length)
    throw new Error('Fresh launch decisions need every attacker.');
  const decisions=frame.attackers.map(riderId=>{
    const priorFinish=priorById.get(riderId);
    const source=sourceById.get(riderId);
    const stake=stakeByTeam.get(source?.team.id);
    const order=source&&orderAt(source.team.orders,km-1);
    const declared=sourceDecisions.get(riderId);
    const ledger=sourceLedger.get(riderId);
    if(priorFinish?.physicalGroup!=='peloton'||
      priorFinish.endDistanceM!==(km-1)*1000||
      Math.abs(priorFinish.clockSeconds-
        prior.front.frontClockSeconds)>1e-8||
      !ledger||Math.abs(ledger.energyBefore-
        priorFinish.energyAfter)>1e-6||
      declared?.sourceKm!==km||
      declared.choice!=='launch_paid_attack'||
      declared.teamId!==source?.team.id||
      declared.teamOrderEffort!==order?.effort||
      declared.teamOrderAttack!==order?.attack||
      declared.goal!==stake?.sportingGoal||
      declared.sportingCaptainId!==stake?.sportingCaptainId||
      !Number.isFinite(declared.paidExtraCost)||
      !Number.isFinite(ledger.paidFromReserve))
      throw new Error(
        'Fresh attacker lacks continuous physical source.');
    const attack=riderKilometreEffect(source.rider,segment,{
      phase:'attack',energy:priorFinish.energyAfter,
      exposed:segment.exposed});
    const solo=riderKilometreEffect(source.rider,segment,{
      phase:'solo',energy:priorFinish.energyAfter,
      exposed:segment.exposed});
    const effortBonus=(TUNING.effortPressure[
      order.effort]-1)*20;
    return {version:V94_PHYSICAL_FRESH_LAUNCH_DECISION_VERSION,
      sourceKm:km,riderId,teamId:source.team.id,
      atDistanceM:(km-1)*1000,
      clockSeconds:priorFinish.clockSeconds,
      energyAtBoundary:priorFinish.energyAfter,
      managerEffort:order.effort,
      managerAttack:order.attack,
      managerBreakWork:order.breakWork,
      sportingGoal:stake.sportingGoal,
      sportingCaptainId:stake.sportingCaptainId,
      attackReason:declared.attackReason,
      perceivedAttackAbility:attack.ability+effortBonus,
      perceivedSoloAbility:solo.ability+effortBonus,
      sourceAttackDecisionVersion:declared.version,
      sourcePaidExtraCost:declared.paidExtraCost,
      sourceFullKmPaidFromReserve:ledger.paidFromReserve,
      choice:'attempt_paid_launch',
      paidNewDistanceM:0,paidNewEnergy:0};
  });
  return {
    version:V94_PHYSICAL_FRESH_LAUNCH_BOUNDARY_VERSION,
    sourceKm:km,atDistanceM:(km-1)*1000,
    clockSeconds:prior.front.frontClockSeconds,
    decisions,
    sourceBreakRoadIds:frame.roadGroups.map(row=>row.id),
    sourceNewBreakHasPaidTurnPlan:frame.roadGroups.some(group=>
      frame.roadGroupTurnPlans?.some(plan=>
        plan.roadGroupId===group.id))??false,
    physicalRoadGroups:[],paidLaunchPending:true,
    officialResults:false};
}

export function validateV94PhysicalFreshLaunchBoundaryV1(
  recording,prior,observation){
  if(!isDeepStrictEqual(observation,
    inspectV94PhysicalFreshLaunchBoundaryV1(recording,prior)))
    throw new Error('Fresh launch boundary differs from paid source.');
  return true;
}
