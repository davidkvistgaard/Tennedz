// One explicitly named bunch worker controls a watched front for one km.
// Only that worker and the single front rider have a complete energy ledger.
import {isDeepStrictEqual} from 'node:util';
import {decideCommittedTeamChaseV1} from './team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  './road-group-sprint-choice-v1.mjs';
import {planRoadGroupTurnsV1} from './road-group-turns-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {orderAt} from './orders.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT} from
  './tuning.mjs';

export const ISOLATED_PAID_CONTROL_ROAD_VERSION=
  'v2-isolated-paid-control-road-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Paid control has invalid road pace.');
  return 3600/seconds;
};

export function advanceIsolatedPaidControlRoadV1({
  committedChoiceInput,committedChoice,frontChoiceInput,
  frontChoice,segment,controlTeamId}){
  if(!isDeepStrictEqual(committedChoice,
    decideCommittedTeamChaseV1(committedChoiceInput))||
    !isDeepStrictEqual(frontChoice,
      decideRoadGroupSprintChoiceV1(frontChoiceInput))||
    !isDeepStrictEqual(committedChoiceInput.roadGroups,
      frontChoiceInput.roadGroups)||
    !isDeepStrictEqual(committedChoiceInput.teams,
      frontChoiceInput.teams)||
    !isDeepStrictEqual(segment,
      committedChoiceInput.remainingSegments?.[0])||
    committedChoiceInput.raceSeed!==frontChoiceInput.raceSeed||
    committedChoiceInput.roadGroups.length!==1||
    committedChoiceInput.roadGroups[0].riderIds.length!==1||
    committedChoice.choice.assessments[0]?.action!=='watch'||
    frontChoiceInput.distanceKm!==
      committedChoiceInput.commitment.distanceKm||
    segment.km!==frontChoice.sourceKm||
    frontChoice.groupId!==committedChoiceInput.roadGroups[0].id)
    throw new Error('Paid control needs matching watched road decisions.');
  const teams=committedChoiceInput.teams;
  const group=committedChoiceInput.roadGroups[0];
  const control=teams.find(row=>row.id===controlTeamId);
  if(!control||controlTeamId===
    committedChoice.choice.observerTeamId||
    group.teamIds.includes(controlTeamId)||
    teams.some(team=>team.id!==controlTeamId&&
      orderAt(team.orders,segment.km-1).frontWork==='rotate'))
    throw new Error('Paid control needs one distinct front-work team.');
  const order=orderAt(control.orders,segment.km-1);
  const workerId=order.frontWorkRiderId;
  const worker=control.riders.find(row=>row.id===workerId);
  if(order.frontWork!=='rotate'||
    order.attack!=='none'||order.chase!=='ignore'||
    !control.orders.helperIds.includes(workerId)||!worker||
    committedChoiceInput.unavailableRiderIds?.includes(workerId)||
    !Number.isFinite(control.energy[workerId])||
    control.energy[workerId]<0||control.energy[workerId]>100)
    throw new Error('Paid control needs an available named helper.');
  const frontId=group.riderIds[0];
  const frontTeam=teams.find(team=>team.riders.some(row=>
    row.id===frontId));
  const frontRider=frontTeam.riders.find(row=>row.id===frontId);
  const frontOrder=orderAt(frontTeam.orders,segment.km-1);
  const frontTurnPlan=planRoadGroupTurnsV1({group,
    riderDecisions:frontChoice.decisions,teams,segment});
  if(frontTurnPlan.status!=='worked'||
    frontTurnPlan.turns.length!==1||
    frontTurnPlan.turns[0].leaderRiderId!==frontId)
    throw new Error('Watched front needs one paid leader.');
  const base=segmentBaseSeconds(segment);
  const startM=(segment.km-1)*1000;
  const frontEnergy=frontTeam.energy[frontId];
  const frontEffect=riderKilometreEffect(frontRider,segment,{
    phase:'solo',energy:frontEnergy,exposed:segment.exposed});
  const workerEffect=riderKilometreEffect(worker,segment,{
    phase:'cruise',energy:control.energy[workerId],
    exposed:segment.exposed});
  const workerAdjustment=order.effort==='conserve'?
    MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
    TUNING.groups.frontPaceAdjustmentPoints[order.effort];
  const frontSpeedKph=speed(base,frontEffect.ability+
    (frontOrder.breakWork==='drive'?
      TUNING.breakaway.driveAbilityBonusPoints:0));
  const bunchSpeedKph=speed(base,workerEffect.ability+
    workerAdjustment+TUNING.breakaway.bunchDraftAdvantage);
  const movement=advanceFinaleGap({slice:{startDistanceM:startM,
    endDistanceM:startM+1000,lengthM:1000},
  gapSeconds:group.gapSeconds,frontSpeedKph,
  chaseSpeedKph:bunchSpeedKph});
  const endDistanceM=movement.catchDistanceM??startM+1000;
  const share=(endDistanceM-startM)/1000;
  const frontCost=share*(TUNING.effortCost[frontOrder.effort]+
    TUNING.breakaway.extraCostPerKm+
    (frontOrder.breakWork==='drive'?
      TUNING.breakaway.driveExtraCostPerKm:0))*
    frontEffect.energyCostMultiplier;
  const workerExtra=order.effort==='hard'?
    TUNING.groups.hardPaceWorkerExtraCostPerKm:
    order.effort==='steady'?
      TUNING.groups.steadyPaceWorkerExtraCostPerKm:
      MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm;
  const workerCost=share*(TUNING.effortCost[order.effort]+
    workerExtra)*workerEffect.energyCostMultiplier;
  if(frontCost>frontEnergy+1e-9||
    workerCost>control.energy[workerId]+1e-9)
    throw new Error('Named control and front riders cannot pay road.');
  const energyByRider={
    [frontId]:Math.max(0,frontEnergy-frontCost),
    [workerId]:Math.max(0,control.energy[workerId]-workerCost)};
  return {version:ISOLATED_PAID_CONTROL_ROAD_VERSION,
    sourceKm:segment.km,roadGroupId:group.id,
    observerAction:'watch',controlTeamId,
    frontLeaderRiderId:frontId,bunchLeaderRiderId:workerId,
    startDistanceM:startM,endDistanceM,
    frontSpeedKph,bunchSpeedKph,
    gapSeconds:movement.gapSeconds,
    riders:[{riderId:frontId,role:'front_leader',
      energyBefore:frontEnergy,energySpent:frontCost,
      energy:energyByRider[frontId]},
    {riderId:workerId,role:'bunch_leader',
      energyBefore:control.energy[workerId],energySpent:workerCost,
      energy:energyByRider[workerId]}],
    energyByRider,
    contact:movement.caught?{kind:'front_bunch_contact',
      atDistanceM:endDistanceM,frontRiderIds:[frontId]}:null,
    unmodeledRiderIds:teams.flatMap(team=>team.riders.map(row=>
      row.id)).filter(id=>id!==frontId&&id!==workerId),
    officialResults:false};
}

export function validateIsolatedPaidControlRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceIsolatedPaidControlRoadV1(input)))
    throw new Error('Paid control road differs from committed source.');
  return true;
}
