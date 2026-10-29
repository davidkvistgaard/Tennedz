// Isolated consecutive paid kilometres after a two-rider rear contact.
// Every kilometre redecides turns from explicit goals and current energy.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupChoiceV2} from './rear-group-choice-v2.mjs';
import {advanceRearGroupFromPaidSourceV1} from
  './rear-group-source-road-v1.mjs';

export const REAR_GROUP_SOURCE_RUN_VERSION='v2-rear-group-source-run-1';

export function runRearGroupSourceV1({initialChoiceInput,initialChoice,
  kilometres}){
  if(!isDeepStrictEqual(initialChoice,
    decideRearGroupChoiceV2(initialChoiceInput))||
    !Array.isArray(kilometres)||!kilometres.length)
    throw new Error('Rear run needs a replayed contact and road kilometres.');
  let group=initialChoice.group.continuation.rearGroup;
  let nextKm=initialChoice.group.sourceKm+1;
  const roster=initialChoiceInput.teams.map(team=>[team.id,team.riders]);
  const steps=[];
  for(const kilometre of kilometres){
    if(!group||kilometre?.group!==undefined||
      kilometre?.segment?.km!==nextKm||
      !Array.isArray(kilometre.teams)||
      !isDeepStrictEqual(kilometre.teams.map(team=>
        [team.id,team.riders]),roster))
      throw new Error('Rear run needs consecutive road and the source roster.');
    const step=advanceRearGroupFromPaidSourceV1({...kilometre,group});
    steps.push(step);
    group=step.road.rearGroup;
    nextKm++;
  }
  return {version:REAR_GROUP_SOURCE_RUN_VERSION,
    initialGroupId:initialChoice.groupId,steps,
    finalRearGroup:group,
    bunchRejoin:steps.at(-1).road.event};
}

export function validateRearGroupSourceRunV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupSourceV1(input)))
    throw new Error('Rear run differs from its paid contact and road source.');
  return true;
}
