// Consecutive paid three-rider road after a replayed physical join.
import {isDeepStrictEqual} from 'node:util';
import {continueRearJoinedGroupV1} from
  './rear-joined-group-continuation-v1.mjs';
import {advanceRearGroupSourceStepV2} from
  './rear-group-source-step-v2.mjs';

export const REAR_GROUP_AFTER_JOIN_RUN_VERSION=
  'v2-rear-group-after-join-run-1';

export function runRearGroupAfterJoinV1({continuationInput,
  continuation,kilometres}){
  if(!isDeepStrictEqual(continuation,
    continueRearJoinedGroupV1(continuationInput))||
    !Array.isArray(kilometres)||!kilometres.length)
    throw new Error('Three-rider run needs a replayed paid join.');
  let group=continuation.rearGroup;
  let lastLeaderRiderId=continuation.leaderRiderId;
  let nextKm=continuation.sourceKm+1;
  const roster=continuationInput.joinInput.teams.map(team=>
    [team.id,team.riders]);
  const steps=[];
  for(const kilometre of kilometres){
    if(!group||kilometre?.group!==undefined||
      kilometre?.lastLeaderRiderId!==undefined||
      kilometre?.segment?.km!==nextKm||
      !Array.isArray(kilometre.teams)||
      !isDeepStrictEqual(kilometre.teams.map(team=>
        [team.id,team.riders]),roster))
      throw new Error('Three-rider run needs consecutive source road.');
    const step=advanceRearGroupSourceStepV2({...kilometre,group,
      lastLeaderRiderId});
    steps.push(step);
    group=step.rearGroup;
    lastLeaderRiderId=step.leaderRiderId;
    nextKm++;
  }
  return {version:REAR_GROUP_AFTER_JOIN_RUN_VERSION,
    groupId:continuation.groupId,steps,finalRearGroup:group,
    bunchRejoin:steps.at(-1).event};
}

export function validateRearGroupAfterJoinV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupAfterJoinV1(input)))
    throw new Error('Three-rider run differs from its paid join source.');
  return true;
}
