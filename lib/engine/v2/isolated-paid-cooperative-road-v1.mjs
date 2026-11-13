// One front rider against a paid cooperative bunch road: a named control
// helper and committed chase helpers take mutually exclusive turns.
import {isDeepStrictEqual} from 'node:util';
import {decideCommittedTeamChaseV1} from './team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  './road-group-sprint-choice-v1.mjs';
import {planRoadGroupTurnsV1} from './road-group-turns-v1.mjs';
import {chaseCapacity} from './tactics.mjs';
import {planChaseTurnsV1} from './chase-turns-v1.mjs';
import {planChaseRoadPaceV1} from './chase-road-pace-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,MOTOR_EXPLICIT_FRONT} from
  './tuning.mjs';

export const ISOLATED_PAID_COOPERATIVE_ROAD_VERSION=
  'v2-isolated-paid-cooperative-road-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Cooperative road has invalid pace.');
  return 3600/seconds;
};

export function advanceIsolatedPaidCooperativeRoadV1({
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
    committedChoiceInput.raceSeed!==frontChoiceInput.raceSeed||
    !isDeepStrictEqual(segment,
      committedChoiceInput.remainingSegments?.[0])||
    frontChoiceInput.distanceKm!==
      committedChoiceInput.commitment.distanceKm||
    segment.km!==frontChoice.sourceKm||
    frontChoice.groupId!==
      committedChoiceInput.roadGroups[0]?.id||
    committedChoiceInput.roadGroups.length!==1||
    committedChoiceInput.roadGroups[0].riderIds.length!==1||
    !['commit_now','commit_and_request_help'].includes(
      committedChoice.choice.assessments[0]?.action))
    throw new Error('Cooperative road needs matching paid decisions.');
  const teams=committedChoiceInput.teams;
  const group=committedChoiceInput.roadGroups[0];
  const observer=teams.find(row=>row.id===
    committedChoice.choice.observerTeamId);
  const control=teams.find(row=>row.id===controlTeamId);
  if(!control||control.id===observer.id||
    group.teamIds.includes(control.id)||
    teams.some(team=>team.id!==control.id&&
      orderAt(team.orders,segment.km-1).frontWork==='rotate'))
    throw new Error('Cooperative road needs one distinct controller.');
  const controlOrder=orderAt(control.orders,segment.km-1);
  const controlId=controlOrder.frontWorkRiderId;
  const controlRider=control.riders.find(row=>row.id===controlId);
  if(controlOrder.frontWork!=='rotate'||
    controlOrder.attack!=='none'||
    controlOrder.chase!=='ignore'||
    !control.orders.helperIds.includes(controlId)||
    !controlRider||
    committedChoiceInput.unavailableRiderIds?.includes(controlId)||
    !Number.isFinite(control.energy[controlId])||
    control.energy[controlId]<0||control.energy[controlId]>100)
    throw new Error('Cooperative road needs a payable named controller.');
  const frontId=group.riderIds[0];
  const frontTurnPlan=planRoadGroupTurnsV1({group,
    riderDecisions:frontChoice.decisions,teams,segment});
  if(frontTurnPlan.status!=='worked'||
    frontTurnPlan.turns.length!==1||
    frontTurnPlan.turns[0].leaderRiderId!==frontId)
    throw new Error('Cooperative road needs an exposed front rider.');
  const frontTeam=teams.find(row=>row.riders.some(
    rider=>rider.id===frontId));
  const unavailable=new Set([frontId,
    ...(committedChoiceInput.unavailableRiderIds??[]),controlId]);
  const {helpers}=chaseCapacity(observer,segment,unavailable);
  const chaseOrder=orderAt(observer.orders,segment.km-1);
  const commitment=chaseOrder.chase==='all'?1:
    TUNING.chase.selectiveCommitment;
  const chaseCandidates=helpers.map(helper=>({
    teamId:observer.id,riderId:helper.rider.id,
    capacity:helper.capacity*TUNING.chase.helperCapacityFactor*
      commitment*TUNING.effortPressure[chaseOrder.effort],
    costPerKm:chaseOrder.chase==='all'?TUNING.chase.allCost:
      TUNING.chase.selectiveCost,
    energy:observer.energy[helper.rider.id]}));
  const chaseTurnPlan=planChaseTurnsV1({km:segment.km,
    candidates:chaseCandidates});
  if(chaseTurnPlan.status!=='worked')
    throw new Error('Cooperative road needs paid chase helpers.');
  planChaseRoadPaceV1({turnPlan:chaseTurnPlan,teams,segment});
  const workers=[{team:control,rider:controlRider,
    workKind:'control',extraCostPerKm:
      controlOrder.effort==='hard'?
        TUNING.groups.hardPaceWorkerExtraCostPerKm:
        controlOrder.effort==='steady'?
          TUNING.groups.steadyPaceWorkerExtraCostPerKm:
          MOTOR_EXPLICIT_FRONT.conserveWorkerExtraCostPerKm},
  ...chaseCandidates.map(candidate=>({team:observer,
    rider:observer.riders.find(row=>row.id===candidate.riderId),
    workKind:'chase',extraCostPerKm:candidate.costPerKm}))]
    .sort((a,b)=>a.team.id.localeCompare(b.team.id)||
      a.rider.id.localeCompare(b.rider.id));
  if(new Set(workers.map(row=>row.rider.id)).size!==workers.length||
    workers.some(row=>row.rider.id===frontId))
    throw new Error('One rider cannot lead two physical groups.');
  const start=(segment.km-1)%workers.length;
  const rotated=[...workers.slice(start),...workers.slice(0,start)];
  let metre=0;
  const turns=rotated.map((worker,index)=>{
    const lengthM=Math.floor(1000/rotated.length)+
      (index<1000%rotated.length?1:0);
    const row={teamId:worker.team.id,
      leaderRiderId:worker.rider.id,workKind:worker.workKind,
      startM:metre,endM:metre+lengthM};
    metre+=lengthM;
    return row;
  });
  const byId=new Map([...workers,{team:frontTeam,
    rider:frontTeam.riders.find(row=>row.id===frontId)}]
    .map(row=>[row.rider.id,row]));
  const energy=Object.fromEntries(byId.values().map(row=>
    [row.rider.id,row.team.energy[row.rider.id]]));
  if(Object.values(energy).some(value=>
    !Number.isFinite(value)||value<0||value>100))
    throw new Error('Cooperative road needs known rider energy.');
  const base=segmentBaseSeconds(segment);
  const startM=(segment.km-1)*1000;
  const frontOrder=orderAt(frontTeam.orders,segment.km-1);
  let gapSeconds=group.gapSeconds;
  const slices=[];
  let contact=null;
  for(const turn of turns){
    const leader=byId.get(turn.leaderRiderId);
    const frontEffect=riderKilometreEffect(byId.get(frontId).rider,
      segment,{phase:'solo',energy:energy[frontId],
        exposed:segment.exposed});
    const leaderEffect=riderKilometreEffect(leader.rider,
      segment,{phase:turn.workKind==='chase'?'chase':'cruise',
        energy:energy[turn.leaderRiderId],
        exposed:segment.exposed});
    const controlAdjustment=controlOrder.effort==='conserve'?
      MOTOR_EXPLICIT_FRONT.conserveFrontAdjustmentPoints:
      TUNING.groups.frontPaceAdjustmentPoints[
        controlOrder.effort];
    const frontSpeedKph=speed(base,frontEffect.ability+
      (frontOrder.breakWork==='drive'?
        TUNING.breakaway.driveAbilityBonusPoints:0));
    const bunchSpeedKph=speed(base,leaderEffect.ability+
      (turn.workKind==='control'?controlAdjustment:0)+
      TUNING.breakaway.bunchDraftAdvantage);
    const movement=advanceFinaleGap({slice:{
      startDistanceM:startM+turn.startM,
      endDistanceM:startM+turn.endM,
      lengthM:turn.endM-turn.startM},gapSeconds,
    frontSpeedKph,chaseSpeedKph:bunchSpeedKph});
    const endDistanceM=movement.catchDistanceM??
      startM+turn.endM;
    const share=(endDistanceM-startM-turn.startM)/1000;
    const riders=[frontId,...workers.map(row=>row.rider.id)]
      .map(id=>{
        const source=byId.get(id);
        const isFront=id===frontId;
        const leading=isFront||id===turn.leaderRiderId;
        const effect=isFront?frontEffect:
          leading?leaderEffect:
            riderKilometreEffect(source.rider,segment,{
              phase:'cruise',energy:energy[id],
              exposed:segment.exposed});
        const order=orderAt(source.team.orders,segment.km-1);
        const extra=isFront?TUNING.breakaway.extraCostPerKm+
          (frontOrder.breakWork==='drive'?
            TUNING.breakaway.driveExtraCostPerKm:0):
          leading?workers.find(row=>
            row.rider.id===id).extraCostPerKm:0;
        const spent=share*(TUNING.effortCost[order.effort]+extra)*
          effect.energyCostMultiplier*
          (leading?1:DRAFT_COST_FRACTION);
        const before=energy[id];
        if(spent>before+1e-9)
          throw new Error('Cooperative rider cannot pay road.');
        energy[id]=Math.max(0,before-spent);
        return {riderId:id,role:isFront?'front_leader':
          leading?'bunch_leader':'sheltered',
        energyBefore:before,energySpent:spent,energy:energy[id]};
      });
    slices.push({startDistanceM:startM+turn.startM,
      endDistanceM,bunchLeaderRiderId:turn.leaderRiderId,
      frontLeaderRiderId:frontId,
      frontSpeedKph,bunchSpeedKph,
      gapSeconds:movement.gapSeconds,riders});
    gapSeconds=movement.gapSeconds;
    if(movement.caught){
      contact={kind:'front_bunch_contact',
        atDistanceM:endDistanceM,frontRiderIds:[frontId]};
      break;
    }
  }
  return {version:ISOLATED_PAID_COOPERATIVE_ROAD_VERSION,
    sourceKm:segment.km,roadGroupId:group.id,
    frontTurnPlan,chaseTurnPlan,turns,slices,
    endDistanceM:slices.at(-1).endDistanceM,
    gapSeconds,energyByRider:energy,contact,
    unmodeledRiderIds:teams.flatMap(team=>team.riders.map(row=>
      row.id)).filter(id=>!Object.hasOwn(energy,id)),
    officialResults:false};
}

export function validateIsolatedPaidCooperativeRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceIsolatedPaidCooperativeRoadV1(input)))
    throw new Error('Cooperative road differs from committed source.');
  return true;
}
