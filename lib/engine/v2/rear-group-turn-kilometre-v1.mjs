// Isolated, source-replayed rear kilometre with sequential paid leaders.
// Each turn occupies road distance; only its leader pays exposed work.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupSourceStepV2} from './rear-group-source-step-v2.mjs';
import {decideRearGroupMembersV2} from './rear-group-choice-v2.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_TURN_KILOMETRE_VERSION=
  'v2-rear-group-turn-kilometre-1';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear turn has invalid source pace.');
  return 3600/seconds;
};

export function advanceRearGroupTurnKilometreV1({priorInput,priorStep,
  segment,bunchTurnPlan,teams,rearGoals,roadGroups=[],stageNumber,
  stageCount}){
  if(!isDeepStrictEqual(priorStep,
    advanceRearGroupSourceStepV2(priorInput))||!priorStep.rearGroup||
    segment?.km!==priorStep.sourceKm+1||
    !isDeepStrictEqual(teams,priorInput.teams))
    throw new Error('Rear turns need consecutive replayed group road.');
  const group=priorStep.rearGroup;
  const {memberDecisions,pullerIds}=decideRearGroupMembersV2({
    riderIds:group.riderIds,energyByRider:group.energyByRider,
    teams,rearGoals,roadGroups,stageNumber,stageCount,km:segment.km});
  bunchAbilityFromPaidTurnsV1(bunchTurnPlan);
  const previousIndex=group.riderIds.indexOf(priorStep.leaderRiderId);
  const rotation=[...group.riderIds.slice(previousIndex+1),
    ...group.riderIds.slice(0,previousIndex+1)]
    .filter(id=>pullerIds.includes(id));
  const startM=(segment.km-1)*1000;
  const rearTurns=rotation.map((leaderRiderId,index)=>({
    startM:Math.floor(index*1000/rotation.length),
    endM:Math.floor((index+1)*1000/rotation.length),
    leaderRiderId}));
  const boundaries=[...new Set([0,1000,
    ...rearTurns.flatMap(turn=>[turn.startM,turn.endM]),
    ...bunchTurnPlan.turns.flatMap(turn=>[turn.startM,turn.endM])])]
    .sort((a,b)=>a-b);
  const byRider=new Map(teams.flatMap(team=>team.riders.map(row=>
    [row.id,row])));
  const byDecision=new Map(memberDecisions.map(row=>[row.riderId,row]));
  const energy={...group.energyByRider};
  const base=segmentBaseSeconds(segment);
  let gapSeconds=group.behindBunchSeconds;
  let lastLeaderRiderId=priorStep.leaderRiderId;
  const slices=[];
  let contact=null;
  for(let index=0;index<boundaries.length-1;index++){
    const from=boundaries[index],to=boundaries[index+1];
    const rearTurn=rearTurns.find(turn=>turn.startM<=from&&turn.endM>=to);
    const bunchTurn=bunchTurnPlan.turns.find(turn=>
      turn.startM<=from&&turn.endM>=to);
    const leaderRiderId=rearTurn.leaderRiderId;
    const decision=byDecision.get(leaderRiderId);
    const leaderEffect=riderKilometreEffect(byRider.get(leaderRiderId),
      segment,{phase:'solo',energy:energy[leaderRiderId],
        exposed:segment.exposed});
    const leaderSpeedKph=speed(base,leaderEffect.ability+
      (TUNING.effortPressure[decision.effort]-1)*20);
    const bunchSpeedKph=speed(base,bunchTurn.ability+
      TUNING.breakaway.bunchDraftAdvantage);
    const movement=advanceFinaleGap({slice:{
      startDistanceM:startM+from,endDistanceM:startM+to,
      lengthM:to-from},gapSeconds,
    frontSpeedKph:bunchSpeedKph,chaseSpeedKph:leaderSpeedKph});
    const endDistanceM=movement.catchDistanceM??startM+to;
    const fraction=(endDistanceM-startM-from)/1000;
    const riders=memberDecisions.map(row=>{
      const leading=row.riderId===leaderRiderId;
      const energyBefore=energy[row.riderId];
      const effect=leading?leaderEffect:riderKilometreEffect(
        byRider.get(row.riderId),segment,{phase:'cruise',
          energy:energyBefore,exposed:segment.exposed});
      const spent=(TUNING.effortCost[row.effort]+
        (leading?TUNING.breakaway.extraCostPerKm:0))*
        effect.energyCostMultiplier*(leading?1:DRAFT_COST_FRACTION)*
        fraction;
      if(spent>energyBefore+1e-9)
        throw new Error('Rear rider cannot pay the selected turn.');
      energy[row.riderId]=Math.max(0,energyBefore-spent);
      return {riderId:row.riderId,role:leading?'leader':'sheltered',
        energyBefore,energySpent:spent,energy:energy[row.riderId]};
    });
    slices.push({startDistanceM:startM+from,endDistanceM,
      leaderRiderId,bunchLeaderAbility:bunchTurn.ability,
      bunchSpeedKph,leaderSpeedKph,riders,
      gapSeconds:movement.gapSeconds});
    gapSeconds=movement.gapSeconds;
    lastLeaderRiderId=leaderRiderId;
    if(movement.caught){
      contact={kind:'rejoin_bunch',atDistanceM:endDistanceM,
        riderIds:[...group.riderIds]};
      break;
    }
  }
  const endDistanceM=slices.at(-1).endDistanceM;
  return {version:REAR_GROUP_TURN_KILOMETRE_VERSION,
    groupId:group.id,sourceKm:segment.km,memberDecisions,
    rearTurns,slices,contact,lastLeaderRiderId,
    rearGroup:contact?null:{id:group.id,riderIds:[...group.riderIds],
      atDistanceM:endDistanceM,behindBunchSeconds:gapSeconds,
      turnCount:group.turnCount+new Set(slices.map(row=>
        row.leaderRiderId)).size,energyByRider:energy}};
}

export function validateRearGroupTurnKilometreV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearGroupTurnKilometreV1(input)))
    throw new Error('Rear turns differ from replayed paid source road.');
  return true;
}
