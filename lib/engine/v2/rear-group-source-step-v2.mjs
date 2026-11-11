// Source-derived next whole kilometre for an existing three-rider rear group.
// Rotation starts after the recorded previous leader, not a modulo counter.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupMembersV2} from './rear-group-choice-v2.mjs';
import {bunchAbilityFromPaidTurnsV1} from './rear-detachment-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {advanceFinaleGap} from './finale-step.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_SOURCE_STEP_V2_VERSION=
  'v2-rear-group-source-step-2';
const DRAFT_COST_FRACTION=.8;
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear group has invalid source pace.');
  return 3600/seconds;
};

export function advanceRearGroupSourceStepV2({group,lastLeaderRiderId,
  segment,bunchTurnPlan,teams,rearGoals,roadGroups=[],stageNumber,
  stageCount}){
  if(!group||!Array.isArray(group.riderIds)||
    group.riderIds.length!==3||
    !group.riderIds.includes(lastLeaderRiderId)||
    !Number.isInteger(segment?.km)||segment.km<2||
    group.atDistanceM!==(segment.km-1)*1000||
    !Number.isFinite(group.behindBunchSeconds)||
    group.behindBunchSeconds<=0||
    !Number.isInteger(group.turnCount)||group.turnCount<1||
    !group.energyByRider||
    Object.keys(group.energyByRider).length!==3)
    throw new Error('Three-rider rear road needs its exact paid source.');
  const {memberDecisions,pullerIds}=decideRearGroupMembersV2({
    riderIds:group.riderIds,energyByRider:group.energyByRider,
    teams,rearGoals,roadGroups,stageNumber,stageCount,km:segment.km});
  const previousIndex=group.riderIds.indexOf(lastLeaderRiderId);
  const rotation=[...group.riderIds.slice(previousIndex+1),
    ...group.riderIds.slice(0,previousIndex+1)];
  const leaderRiderId=rotation.find(id=>pullerIds.includes(id));
  const byRider=new Map(teams.flatMap(team=>team.riders.map(row=>
    [row.id,row])));
  const byDecision=new Map(memberDecisions.map(row=>[row.riderId,row]));
  const base=segmentBaseSeconds(segment);
  const bunchAbility=bunchAbilityFromPaidTurnsV1(bunchTurnPlan)+
    TUNING.breakaway.bunchDraftAdvantage;
  const bunchSpeedKph=speed(base,bunchAbility);
  const leader=byRider.get(leaderRiderId);
  const leaderDecision=byDecision.get(leaderRiderId);
  const leaderEffect=riderKilometreEffect(leader,segment,{
    phase:'solo',energy:group.energyByRider[leaderRiderId],
    exposed:segment.exposed});
  const leaderSpeedKph=speed(base,leaderEffect.ability+
    (TUNING.effortPressure[leaderDecision.effort]-1)*20);
  const slice={startDistanceM:(segment.km-1)*1000,
    endDistanceM:segment.km*1000,lengthM:1000};
  const movement=advanceFinaleGap({slice,
    gapSeconds:group.behindBunchSeconds,
    frontSpeedKph:bunchSpeedKph,chaseSpeedKph:leaderSpeedKph});
  const endDistanceM=movement.catchDistanceM??slice.endDistanceM;
  const fraction=(endDistanceM-slice.startDistanceM)/1000;
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
    const energySpent=costPerKm*fraction;
    if(energySpent>energyBefore+1e-9)
      throw new Error('Rear rider cannot pay the chosen group turn.');
    return {riderId:decision.riderId,choice:decision.choice,
      reason:decision.reason,role:leading?'leader':'sheltered',
      energySpent,energy:Math.max(0,energyBefore-energySpent)};
  });
  const nextGroup=movement.caught?null:{id:group.id,
    riderIds:[...group.riderIds],atDistanceM:endDistanceM,
    behindBunchSeconds:movement.gapSeconds,
    turnCount:group.turnCount+1,
    energyByRider:Object.fromEntries(riders.map(row=>
      [row.riderId,row.energy]))};
  return {version:REAR_GROUP_SOURCE_STEP_V2_VERSION,
    sourceKm:segment.km,groupId:group.id,memberDecisions,
    lastLeaderRiderId,leaderRiderId,bunchAbility,bunchSpeedKph,
    leaderSpeedKph,startDistanceM:slice.startDistanceM,
    endDistanceM,
    groupElapsedSeconds:movement.chaseSeconds*fraction,
    bunchElapsedSeconds:movement.frontSeconds*fraction,
    riders,rearGroup:nextGroup,
    event:movement.caught?{kind:'rejoin_bunch',
      atDistanceM:endDistanceM,riderIds:[...group.riderIds]}:null};
}

export function validateRearGroupSourceStepV2(input,recording){
  if(!isDeepStrictEqual(recording,advanceRearGroupSourceStepV2(input)))
    throw new Error('Three-rider rear step differs from source work.');
  return true;
}
