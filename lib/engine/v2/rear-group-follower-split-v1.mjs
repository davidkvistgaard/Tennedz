// A two-rider rear group whose follower cannot hold its paid leader.
// This narrow road pays both riders; a separate solo state is recorded only
// after their calculated separation exceeds the existing drop threshold.
import {isDeepStrictEqual} from 'node:util';
import {advanceRearGroupSourceRoadV1} from
  './rear-group-source-road-v1.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const REAR_GROUP_FOLLOWER_SPLIT_VERSION=
  'v2-rear-group-follower-split-1';
const speed=(base,ability)=>{
  const seconds=base+(50-ability)*
    MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(seconds<=0)throw new Error('Rear split speed is invalid.');
  return 3600/seconds;
};

export function advanceRearGroupFollowerSplitV1(input){
  const proposal=advanceRearGroupSourceRoadV1(input);
  const prior=input.priorChoice.group.continuation.rearGroup;
  if(prior?.riderIds?.length!==2||
    proposal.road.event||
    proposal.road.endDistanceM!==input.segment.km*1000)
    throw new Error('Rear split needs a full paid two-rider road.');
  const leaderId=proposal.road.leaderRiderId;
  const followerId=prior.riderIds.find(id=>id!==leaderId);
  const leaderDecision=proposal.memberDecisions.find(row=>
    row.riderId===leaderId);
  const decision=proposal.memberDecisions.find(row=>
    row.riderId===followerId);
  const rider=input.teams.flatMap(team=>team.riders).find(row=>
    row.id===followerId);
  const base=segmentBaseSeconds(input.segment);
  const sheltered=riderKilometreEffect(rider,input.segment,{
    phase:'cruise',energy:prior.energyByRider[followerId],
    exposed:input.segment.exposed});
  const draftAbility=TUNING.breakaway.bunchDraftAdvantage;
  const effortAbility=(TUNING.effortPressure[decision.effort]-1)*20;
  const holdSpeedKph=speed(base,sheltered.ability+
    effortAbility+draftAbility);
  const leaderSpeedKph=proposal.riderPlans.find(row=>
    row.riderId===leaderId).speedKph;
  if(holdSpeedKph+1e-9>=leaderSpeedKph)
    throw new Error('Rear follower can hold the paid leader.');
  const solo=riderKilometreEffect(rider,input.segment,{
    phase:'solo',energy:prior.energyByRider[followerId],
    exposed:input.segment.exposed});
  const soloSpeedKph=speed(base,solo.ability+effortAbility);
  const soloCost=TUNING.effortCost[decision.effort]*
    solo.energyCostMultiplier;
  const followerEnergy=prior.energyByRider[followerId];
  if(soloCost>followerEnergy+1e-9)
    throw new Error('Rear follower cannot pay the solo split road.');
  const leaderRoad=proposal.road.riders.find(row=>
    row.riderId===leaderId);
  const leaderElapsedSeconds=3600/leaderSpeedKph;
  const followerElapsedSeconds=3600/soloSpeedKph;
  const separationSeconds=followerElapsedSeconds-
    leaderElapsedSeconds;
  if(separationSeconds<=0)
    throw new Error('Rear follower did not lose physical ground.');
  const startDistanceM=(input.segment.km-1)*1000;
  const endDistanceM=input.segment.km*1000;
  const confirmed=separationSeconds>
    TUNING.groups.droppedAtSeconds;
  const splitDistanceM=confirmed?startDistanceM+
    1000*TUNING.groups.droppedAtSeconds/separationSeconds:null;
  const followerBehindBunchSeconds=prior.behindBunchSeconds+
    followerElapsedSeconds-3600/proposal.bunchSpeedKph;
  const leaderBehindBunchSeconds=
    proposal.road.rearGroup.behindBunchSeconds;
  if(followerBehindBunchSeconds<=0||
    leaderBehindBunchSeconds<=0)
    throw new Error('Rear split needs a separate bunch contact road.');
  return {version:REAR_GROUP_FOLLOWER_SPLIT_VERSION,
    sourceKm:input.segment.km,sourceGroupId:prior.id,
    leaderRiderId:leaderId,followerRiderId:followerId,
    leaderDecision,followerDecision:decision,
    startDistanceM,endDistanceM,splitDistanceM,
    leaderSpeedKph,soloSpeedKph,holdSpeedKph,
    leaderElapsedSeconds,followerElapsedSeconds,
    separationSeconds,leaderBehindBunchSeconds,
    followerBehindBunchSeconds,
    status:confirmed?'two_solos_behind':'wheel_gap_unresolved',
    riders:[{riderId:leaderId,role:'solo_leader',
      energyBefore:prior.energyByRider[leaderId],
      energySpent:leaderRoad.energySpent,
      energy:leaderRoad.energy},
    {riderId:followerId,role:'solo_follower',
      energyBefore:followerEnergy,energySpent:soloCost,
      energy:Math.max(0,followerEnergy-soloCost)}],
    solos:confirmed?[
      {riderId:leaderId,atDistanceM:endDistanceM,
        behindBunchSeconds:leaderBehindBunchSeconds,
        energyAfter:leaderRoad.energy},
      {riderId:followerId,atDistanceM:endDistanceM,
        behindBunchSeconds:followerBehindBunchSeconds,
        energyAfter:Math.max(0,followerEnergy-soloCost)}]:null,
    event:confirmed?{kind:'rear_group_follower_drops',
      atDistanceM:splitDistanceM,riderId:followerId}:null,
    officialResults:false};
}

export function validateRearGroupFollowerSplitV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advanceRearGroupFollowerSplitV1(input)))
    throw new Error('Rear split differs from the paid group source.');
  return true;
}
