// Bind every rear-group kilometre to intentions committed before the race.
// The paid contact, terrain road and energy cap remain source-replayed by V4.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupChoiceV2} from './rear-group-choice-v2.mjs';
import {rearGoalsAtKmV1} from './rear-goal-commitment-v1.mjs';
import {runRearGroupSourceV4} from './rear-group-source-run-v4.mjs';

export const REAR_GROUP_COMMITTED_SOURCE_RUN_VERSION=
  'v2-rear-group-committed-source-run-1';

export function runCommittedRearGroupSourceV1({commitment,
  initialChoiceInput,initialChoice,routeKilometres,kilometres}){
  if(!isDeepStrictEqual(initialChoice,
    decideRearGroupChoiceV2(initialChoiceInput))||
    !Array.isArray(routeKilometres)||
    routeKilometres.length!==commitment?.distanceKm||
    routeKilometres.some((segment,index)=>segment?.km!==index+1)||
    !Array.isArray(kilometres)||!kilometres.length||
    kilometres.some(row=>row?.rearGoals!==undefined||
      row?.stageNumber!==undefined||row?.stageCount!==undefined))
    throw new Error('Committed rear run needs replayed contact and route.');
  const roster=initialChoiceInput.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const riderIds=initialChoice.group.continuation.rearGroup?.riderIds;
  const contactKm=initialChoice.group.sourceKm;
  if(!riderIds||!Array.isArray(commitment.riderIds)||
    !isDeepStrictEqual([...commitment.riderIds].sort(),
      [...roster].sort())||
    commitment.stageNumber!==initialChoiceInput.stageNumber||
    commitment.stageCount!==initialChoiceInput.stageCount||
    !isDeepStrictEqual(initialChoiceInput.rearGoals,
      rearGoalsAtKmV1({commitment,riderIds,km:contactKm})))
    throw new Error('Rear contact goals differ from pre-race commitment.');
  const sourcedKilometres=kilometres.map(row=>({
    ...row,
    rearGoals:rearGoalsAtKmV1({commitment,riderIds,
      km:row.segment?.km}),
    stageNumber:commitment.stageNumber,
    stageCount:commitment.stageCount}));
  const paidRun=runRearGroupSourceV4({initialChoiceInput,
    initialChoice,routeKilometres,kilometres:sourcedKilometres});
  return {version:REAR_GROUP_COMMITTED_SOURCE_RUN_VERSION,
    commitment:structuredClone(commitment),
    paidRun,officialResults:false};
}

export function validateCommittedRearGroupSourceRunV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runCommittedRearGroupSourceV1(input)))
    throw new Error('Committed rear run differs from paid source.');
  return true;
}
