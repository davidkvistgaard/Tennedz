// Every paid kilometre after a three-rider join checks whether sheltered
// riders can physically hold the single named leader's pace.
import {isDeepStrictEqual} from 'node:util';
import {continueRearJoinedGroupV1} from
  './rear-joined-group-continuation-v1.mjs';
import {advanceRearGroupSourceStepV3} from
  './rear-group-source-step-v3.mjs';

export const REAR_GROUP_AFTER_JOIN_RUN_V2_VERSION=
  'v2-rear-group-after-join-run-2';

export function runRearGroupAfterJoinV2({continuationInput,
  continuation,kilometres}){
  if(!isDeepStrictEqual(continuation,
    continueRearJoinedGroupV1(continuationInput))||
    !Array.isArray(kilometres)||!kilometres.length)
    throw new Error('Three-rider hold run needs replayed paid join.');
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
      throw new Error('Three-rider hold run needs consecutive source road.');
    const step=advanceRearGroupSourceStepV3({...kilometre,group,
      lastLeaderRiderId});
    steps.push(step);
    group=step.sourceStep.rearGroup;
    lastLeaderRiderId=step.sourceStep.leaderRiderId;
    nextKm++;
  }
  return {version:REAR_GROUP_AFTER_JOIN_RUN_V2_VERSION,
    groupId:continuation.groupId,steps,finalRearGroup:group,
    bunchContact:steps.at(-1).sourceStep.event,
    officialResults:false};
}

export function validateRearGroupAfterJoinV2(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupAfterJoinV2(input)))
    throw new Error('Three-rider hold run differs from paid join.');
  return true;
}
