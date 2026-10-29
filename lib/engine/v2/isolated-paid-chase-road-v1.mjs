// One isolated source-paid pursuit kilometre after a committed observer
// choice. Only the named front and chase riders have a complete ledger here.
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
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const ISOLATED_PAID_CHASE_ROAD_VERSION=
  'v2-isolated-paid-chase-road-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Paid chase has invalid rider pace.');
  return 3600/seconds;
};

export function advanceIsolatedPaidChaseRoadV1({
  committedChoiceInput,committedChoice,frontChoiceInput,
  frontChoice,segment}){
  if(!isDeepStrictEqual(committedChoice,
    decideCommittedTeamChaseV1(committedChoiceInput))||
    !isDeepStrictEqual(frontChoice,
      decideRoadGroupSprintChoiceV1(frontChoiceInput))||
    committedChoiceInput.roadGroups.length!==1||
    !isDeepStrictEqual(committedChoiceInput.roadGroups,
      frontChoiceInput.roadGroups)||
    !isDeepStrictEqual(committedChoiceInput.teams,
      frontChoiceInput.teams)||
    committedChoiceInput.raceSeed!==
      frontChoiceInput.raceSeed||
    frontChoiceInput.distanceKm!==
      committedChoiceInput.commitment.distanceKm||
    !isDeepStrictEqual(segment,
      committedChoiceInput.remainingSegments?.[0])||
    !Number.isInteger(segment?.km)||
    segment.km!==committedChoice.choice.sourceKm||
    frontChoice.sourceKm!==segment.km||
    frontChoice.groupId!==
      committedChoiceInput.roadGroups[0].id||
    !['commit_now','commit_and_request_help'].includes(
      committedChoice.choice.assessments[0].action))
    throw new Error('Paid chase needs matching committed road decisions.');
  const group=committedChoiceInput.roadGroups[0];
  const teams=committedChoiceInput.teams;
  const observer=teams.find(team=>team.id===
    committedChoice.choice.observerTeamId);
  const frontTurnPlan=planRoadGroupTurnsV1({group,
    riderDecisions:frontChoice.decisions,teams,segment});
  if(frontTurnPlan.status!=='worked')
    throw new Error('Paid chase needs an exposed front leader.');
  const frontIds=new Set(group.riderIds);
  const unavailable=new Set([
    ...frontIds,...(committedChoiceInput.unavailableRiderIds??[])]);
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
    throw new Error('Committed chase has no payable named helper.');
  planChaseRoadPaceV1({turnPlan:chaseTurnPlan,teams,segment});
  const boundaries=[...new Set([0,1000,
    ...frontTurnPlan.turns.flatMap(row=>[row.startM,row.endM]),
    ...chaseTurnPlan.turns.flatMap(row=>[row.startM,row.endM])])]
    .sort((a,b)=>a-b);
  const byRider=new Map(teams.flatMap(team=>team.riders.map(row=>
    [row.id,{rider:row,team}])));
  const modeledIds=[...group.riderIds,
    ...chaseCandidates.map(row=>row.riderId)];
  if(new Set(modeledIds).size!==modeledIds.length)
    throw new Error('One rider cannot lead two physical groups.');
  const energy=Object.fromEntries(modeledIds.map(id=>
    [id,byRider.get(id).team.energy[id]]));
  if(Object.values(energy).some(value=>
    !Number.isFinite(value)||value<0||value>100))
    throw new Error('Paid chase needs recorded rider energy.');
  const base=segmentBaseSeconds(segment);
  const startM=(segment.km-1)*1000;
  let gapSeconds=group.gapSeconds;
  const slices=[];
  let contact=null;
  for(let index=0;index<boundaries.length-1;index++){
    const from=boundaries[index],to=boundaries[index+1];
    const frontTurn=frontTurnPlan.turns.find(row=>
      row.startM<=from&&row.endM>=to);
    const chaseTurn=chaseTurnPlan.turns.find(row=>
      row.startM<=from&&row.endM>=to);
    const frontLeader=frontTurn.leaderRiderId;
    const chaseLeader=chaseTurn.leaderRiderId;
    const frontRider=byRider.get(frontLeader).rider;
    const chaseRider=byRider.get(chaseLeader).rider;
    const frontEffect=riderKilometreEffect(frontRider,
      segment,{phase:'solo',energy:energy[frontLeader],
        exposed:segment.exposed});
    const chaseEffect=riderKilometreEffect(chaseRider,
      segment,{phase:'chase',energy:energy[chaseLeader],
        exposed:segment.exposed});
    const frontOrder=orderAt(byRider.get(frontLeader).team.orders,
      segment.km-1);
    const frontSpeedKph=speed(base,frontEffect.ability+
      (frontOrder.breakWork==='drive'?
        TUNING.breakaway.driveAbilityBonusPoints:0));
    const bunchSpeedKph=speed(base,chaseEffect.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const movement=advanceFinaleGap({slice:{
      startDistanceM:startM+from,endDistanceM:startM+to,
      lengthM:to-from},gapSeconds,frontSpeedKph,
    chaseSpeedKph:bunchSpeedKph});
    const endDistanceM=movement.catchDistanceM??startM+to;
    const share=(endDistanceM-startM-from)/1000;
    const riders=modeledIds.map(id=>{
      const {rider,team}=byRider.get(id);
      const isFront=frontIds.has(id);
      const leading=id===(isFront?frontLeader:chaseLeader);
      const order=orderAt(team.orders,segment.km-1);
      const effect=leading?
        isFront?frontEffect:chaseEffect:
        riderKilometreEffect(rider,segment,{phase:'cruise',
          energy:energy[id],exposed:segment.exposed});
      const extra=isFront?
        leading?TUNING.breakaway.extraCostPerKm:
          TUNING.breakaway.sitOnExtraCostPerKm:
        leading?chaseCandidates.find(row=>
          row.riderId===id).costPerKm:0;
      const drive=isFront&&order.breakWork==='drive'?
        TUNING.breakaway.driveExtraCostPerKm:0;
      const cost=(TUNING.effortCost[order.effort]+extra+drive)*
        effect.energyCostMultiplier*(leading?1:DRAFT_COST_FRACTION)*
        share;
      const before=energy[id];
      if(cost>before+1e-9)
        throw new Error('Named road rider cannot pay the chosen work.');
      energy[id]=Math.max(0,before-cost);
      return {riderId:id,roadRole:isFront?'front':'bunch',
        role:leading?'leader':'sheltered',
        energyBefore:before,energySpent:cost,energy:energy[id]};
    });
    slices.push({startDistanceM:startM+from,endDistanceM,
      frontLeaderRiderId:frontLeader,
      bunchLeaderRiderId:chaseLeader,
      frontSpeedKph,bunchSpeedKph,
      gapSeconds:movement.gapSeconds,riders});
    gapSeconds=movement.gapSeconds;
    if(movement.caught){
      contact={kind:'front_bunch_contact',
        atDistanceM:endDistanceM,
        frontRiderIds:[...group.riderIds]};
      break;
    }
  }
  return {version:ISOLATED_PAID_CHASE_ROAD_VERSION,
    sourceKm:segment.km,roadGroupId:group.id,
    frontTurnPlan,chaseTurnPlan,slices,
    endDistanceM:slices.at(-1).endDistanceM,
    gapSeconds,energyByRider:energy,contact,
    conditionalHelpPaid:false};
}

export function validateIsolatedPaidChaseRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceIsolatedPaidChaseRoadV1(input)))
    throw new Error('Paid chase road differs from committed source.');
  return true;
}
