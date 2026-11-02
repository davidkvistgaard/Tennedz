// Continue a source-replayed three-rider rear join using pre-race goals.
// Later per-kilometre intentions cannot be supplied or relabelled by callers.
import {isDeepStrictEqual} from 'node:util';
import {continueRearJoinedGroupV1} from
  './rear-joined-group-continuation-v1.mjs';
import {rearGoalsAtKmV1} from './rear-goal-commitment-v1.mjs';
import {runRearGroupAfterJoinV2} from
  './rear-group-after-join-run-v2.mjs';

export const REAR_GROUP_COMMITTED_AFTER_JOIN_RUN_VERSION=
  'v2-rear-group-committed-after-join-run-1';

export function runCommittedRearAfterJoinV1({commitment,
  continuationInput,continuation,kilometres}){
  if(!isDeepStrictEqual(continuation,
    continueRearJoinedGroupV1(continuationInput))||
    !Array.isArray(kilometres)||!kilometres.length||
    kilometres.some(row=>row?.rearGoals!==undefined||
      row?.stageNumber!==undefined||row?.stageCount!==undefined))
    throw new Error('Committed rear join needs replayed contact and road.');
  const riderIds=continuation.rearGroup?.riderIds;
  const roster=continuationInput.joinInput.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(!riderIds||!Array.isArray(commitment?.riderIds)||
    !isDeepStrictEqual([...commitment.riderIds].sort(),
      [...roster].sort())||
    commitment.stageNumber!==continuationInput.joinInput.stageNumber||
    commitment.stageCount!==continuationInput.joinInput.stageCount||
    !isDeepStrictEqual(continuationInput.rearGoals,
      rearGoalsAtKmV1({commitment,riderIds,
        km:continuation.sourceKm})))
    throw new Error('Rear join goals differ from pre-race commitment.');
  const sourcedKilometres=kilometres.map(row=>({
    ...row,rearGoals:rearGoalsAtKmV1({commitment,riderIds,
      km:row.segment?.km}),stageNumber:commitment.stageNumber,
    stageCount:commitment.stageCount}));
  const paidRun=runRearGroupAfterJoinV2({continuationInput,
    continuation,kilometres:sourcedKilometres});
  return {version:REAR_GROUP_COMMITTED_AFTER_JOIN_RUN_VERSION,
    commitment:structuredClone(commitment),paidRun,
    officialResults:false};
}

export function validateCommittedRearAfterJoinV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runCommittedRearAfterJoinV1(input)))
    throw new Error('Committed rear join differs from paid source.');
  return true;
}
