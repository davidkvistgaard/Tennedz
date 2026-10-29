// Isolated next-kilometre continuation of a source-replayed two-rider rear
// group. Choices, speeds and energy prices are derived again each kilometre.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupChoiceV2,decideRearGroupMembersV2} from
  './rear-group-choice-v2.mjs';
import {advanceRearGroupStepV1} from './rear-group-step-v1.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_SOURCE_ROAD_VERSION='v2-rear-group-source-road-1';
const DRAFT_COST_FRACTION=.8;
const effortAbility=effort=>(TUNING.effortPressure[effort]-1)*20;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear road speed is invalid.');
  return 3600/seconds;
};

export function advanceRearGroupSourceRoadV1({priorChoiceInput,priorChoice,
  segment,bunchTurnPlan,teams,rearGoals,roadGroups=[],stageNumber,
  stageCount}){
  if(!isDeepStrictEqual(priorChoice,
    decideRearGroupChoiceV2(priorChoiceInput)))
    throw new Error('Rear road needs a replayed prior group choice.');
  const group=priorChoice.group.continuation.rearGroup;
  if(!group||!Number.isInteger(segment?.km)||
    segment.km!==priorChoice.group.sourceKm+1||
    group.atDistanceM!==(segment.km-1)*1000||
    !Array.isArray(teams)||
    !isDeepStrictEqual(teams.map(team=>[team.id,team.riders]),
      priorChoiceInput.teams.map(team=>[team.id,team.riders])))
    throw new Error('Rear road needs the next exact kilometre and roster.');
  const {memberDecisions}=decideRearGroupMembersV2({
    riderIds:group.riderIds,energyByRider:group.energyByRider,
    teams,rearGoals,roadGroups,stageNumber,stageCount,km:segment.km});
  const riderById=new Map(teams.flatMap(team=>team.riders.map(rider=>
    [rider.id,rider])));
  const base=segmentBaseSeconds(segment);
  const bunchAbility=bunchAbilityFromPaidTurnsV1(bunchTurnPlan)+
    TUNING.breakaway.bunchDraftAdvantage;
  const bunchSpeedKph=speed(base,bunchAbility);
  const riderPlans=memberDecisions.map(decision=>{
    const rider=riderById.get(decision.riderId);
    const energy=group.energyByRider[decision.riderId];
    const leaderEffect=riderKilometreEffect(rider,segment,{
      phase:'solo',energy,exposed:segment.exposed});
    const shelteredEffect=riderKilometreEffect(rider,segment,{
      phase:'cruise',energy,exposed:segment.exposed});
    const leadCostPerKm=(TUNING.effortCost[decision.effort]+
      TUNING.breakaway.extraCostPerKm)*
      leaderEffect.energyCostMultiplier;
    const shelteredCostPerKm=TUNING.effortCost[decision.effort]*
      shelteredEffect.energyCostMultiplier*DRAFT_COST_FRACTION;
    return {riderId:decision.riderId,choice:decision.choice,
      reason:decision.reason,
      speedKph:speed(base,leaderEffect.ability+
        effortAbility(decision.effort)),
      leadCostPerKm,shelteredCostPerKm};
  });
  const slice={startDistanceM:(segment.km-1)*1000,
    endDistanceM:segment.km*1000,lengthM:1000};
  const road=advanceRearGroupStepV1({slice,group,bunchSpeedKph,
    riderPlans});
  return {version:REAR_GROUP_SOURCE_ROAD_VERSION,
    sourceKm:segment.km,groupId:group.id,memberDecisions,
    bunchAbility,bunchSpeedKph,riderPlans,road};
}

export function validateRearGroupSourceRoadV1(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearGroupSourceRoadV1(input)))
    throw new Error('Rear group road differs from paid source and decisions.');
  return true;
}
