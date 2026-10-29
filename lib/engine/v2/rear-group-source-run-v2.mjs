// Consecutive rear-group road with a paid leader and a physical hold check
// for every sheltered rider in every kilometre.
import {isDeepStrictEqual} from 'node:util';
import {decideRearGroupChoiceV2} from './rear-group-choice-v2.mjs';
import {advanceRearGroupFromPaidSourceV2} from
  './rear-group-source-road-v2.mjs';

export const REAR_GROUP_SOURCE_RUN_V2_VERSION=
  'v2-rear-group-source-run-2';

export function runRearGroupSourceV2({initialChoiceInput,initialChoice,
  kilometres}){
  if(!isDeepStrictEqual(initialChoice,
    decideRearGroupChoiceV2(initialChoiceInput))||
    !Array.isArray(kilometres)||!kilometres.length)
    throw new Error('Rear hold run needs replayed contact and road.');
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
      throw new Error('Rear hold run needs consecutive source road.');
    const step=advanceRearGroupFromPaidSourceV2({...kilometre,group});
    steps.push(step);
    group=step.sourceRoad.road.rearGroup;
    nextKm++;
  }
  return {version:REAR_GROUP_SOURCE_RUN_V2_VERSION,
    initialGroupId:initialChoice.groupId,steps,
    finalRearGroup:group,
    bunchContact:steps.at(-1).sourceRoad.road.event,
    officialResults:false};
}

export function validateRearGroupSourceRunV2(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupSourceV2(input)))
    throw new Error('Rear hold run differs from paid source.');
  return true;
}
