// The first paid shared turn after a solo physically joins a rear group.
// Recompute every member's decision at contact; one rider takes the wind.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupSoloJoinV1} from './rear-group-solo-join-v1.mjs';
import {decideRearGroupMembersV2} from './rear-group-choice-v2.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_JOINED_GROUP_CONTINUATION_VERSION=
  'v2-rear-joined-group-continuation-1';
const DRAFT_COST_FRACTION=.8;

export function continueRearJoinedGroupV1({joinInput,join,rearGoals}){
  if(!isDeepStrictEqual(join,advanceRearGroupSoloJoinV1(joinInput)))
    throw new Error('Joined rear group needs replayed paid contact.');
  const group=join.joinedGroup,segment=joinInput.segment;
  const remainingM=segment.km*1000-group.atDistanceM;
  if(remainingM<=0||remainingM>1000)
    throw new Error('Joined rear group needs remaining route distance.');
  const {memberDecisions,pullerIds}=decideRearGroupMembersV2({
    riderIds:group.riderIds,energyByRider:group.energyByRider,
    teams:joinInput.teams,rearGoals,roadGroups:joinInput.roadGroups,
    stageNumber:joinInput.stageNumber,stageCount:joinInput.stageCount,
    km:segment.km});
  const priorLeaderIndex=group.riderIds.indexOf(
    join.groupPlan.road.leaderRiderId);
  const rotation=[...group.riderIds.slice(priorLeaderIndex+1),
    ...group.riderIds.slice(0,priorLeaderIndex+1)];
  const leaderRiderId=rotation.find(id=>pullerIds.includes(id));
  const byDecision=new Map(memberDecisions.map(row=>[row.riderId,row]));
  const byRider=new Map(joinInput.teams.flatMap(team=>team.riders.map(row=>
    [row.id,row])));
  const leader=byRider.get(leaderRiderId);
  const leaderDecision=byDecision.get(leaderRiderId);
  const leaderEffect=riderKilometreEffect(leader,segment,{
    phase:'solo',energy:group.energyByRider[leaderRiderId],
    exposed:segment.exposed});
  const ability=leaderEffect.ability+
    (TUNING.effortPressure[leaderDecision.effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-ability)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const bunchSecondsPerKm=3600/join.groupPlan.bunchSpeedKph;
  if(secondsPerKm<=0||bunchSecondsPerKm<=0)
    throw new Error('Joined rear group has invalid paid pace.');
  const gainPerM=(bunchSecondsPerKm-secondsPerKm)/1000;
  const catchM=gainPerM>0?group.behindBunchSeconds/gainPerM:
    Infinity;
  const riddenM=Math.min(remainingM,catchM);
  const endDistanceM=group.atDistanceM+riddenM;
  const caughtBunch=catchM<=remainingM+1e-9;
  const riders=memberDecisions.map(decision=>{
    const rider=byRider.get(decision.riderId);
    const energyBefore=group.energyByRider[decision.riderId];
    const leading=decision.riderId===leaderRiderId;
    const effect=leading?leaderEffect:riderKilometreEffect(rider,
      segment,{phase:'cruise',energy:energyBefore,
        exposed:segment.exposed});
    const costPerKm=(TUNING.effortCost[decision.effort]+
      (leading?TUNING.breakaway.extraCostPerKm:0))*
      effect.energyCostMultiplier*(leading?1:DRAFT_COST_FRACTION);
    const energySpent=costPerKm*riddenM/1000;
    if(energySpent>energyBefore+1e-9)
      throw new Error('Joined rear rider cannot pay the chosen turn.');
    return {riderId:decision.riderId,choice:decision.choice,
      reason:decision.reason,role:leading?'leader':'sheltered',
      energySpent,energy:Math.max(0,energyBefore-energySpent)};
  });
  const gap=caughtBunch?0:group.behindBunchSeconds+
    riddenM*(secondsPerKm-bunchSecondsPerKm)/1000;
  const nextGroup=caughtBunch?null:{id:group.id,
    riderIds:[...group.riderIds],atDistanceM:endDistanceM,
    behindBunchSeconds:gap,turnCount:group.turnCount+1,
    energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energy]))};
  return {version:REAR_JOINED_GROUP_CONTINUATION_VERSION,
    sourceKm:segment.km,groupId:group.id,memberDecisions,
    leaderRiderId,startDistanceM:group.atDistanceM,endDistanceM,
    groupElapsedSeconds:riddenM*secondsPerKm/1000,
    bunchElapsedSeconds:riddenM*bunchSecondsPerKm/1000,
    riders,rearGroup:nextGroup,
    event:caughtBunch?{kind:'rejoin_bunch',atDistanceM:endDistanceM,
      riderIds:[...group.riderIds]}:null};
}

export function validateRearJoinedGroupV1(input,recording){
  if(!isDeepStrictEqual(recording,continueRearJoinedGroupV1(input)))
    throw new Error('Joined rear group differs from contact and paid work.');
  return true;
}
