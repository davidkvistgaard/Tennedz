// Consecutive terrain-priced rear road from one replayed physical contact.
// Each kilometre redecides the paid leader and every follower's hold.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupChoiceV2} from './rear-group-choice-v2.mjs';
import {advanceRearGroupFromPaidSourceV3} from
  './rear-group-source-road-v3.mjs';

export const REAR_GROUP_SOURCE_RUN_V3_VERSION=
  'v2-rear-group-source-run-3';

export function runRearGroupSourceV3({initialChoiceInput,initialChoice,
  kilometres}){
  if(!isDeepStrictEqual(initialChoice,
    decideRearGroupChoiceV2(initialChoiceInput))||
    !Array.isArray(kilometres)||!kilometres.length)
    throw new Error('Terrain rear run needs replayed contact and road.');
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
      throw new Error('Terrain rear run needs consecutive source road.');
    const step=advanceRearGroupFromPaidSourceV3({...kilometre,group});
    steps.push(step);
    group=step.road.rearGroup;
    nextKm++;
  }
  return {version:REAR_GROUP_SOURCE_RUN_V3_VERSION,
    initialGroupId:initialChoice.groupId,steps,
    finalRearGroup:group,bunchContact:steps.at(-1).road.event,
    officialResults:false};
}

export function validateRearGroupSourceRunV3(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupSourceV3(input)))
    throw new Error('Terrain rear run differs from paid source.');
  return true;
}
