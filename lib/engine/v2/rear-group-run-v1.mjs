// Source-replayed chain from exact solo meeting through subsequent short
// slices. This is an isolated road witness, not a route into V93/V94 frames.
import {isDeepStrictEqual} from 'node:util';
import {continueRearContactV1} from './rear-contact-continuation-v1.mjs';
import {advanceRearGroupStepV1} from './rear-group-step-v1.mjs';

export const REAR_GROUP_RUN_VERSION='v2-rear-group-run-1';

export function runRearGroupV1({soloInput,groupId,initialTurn,
  followingSteps=[]}){
  if(!initialTurn||typeof initialTurn!=='object'||
    !Array.isArray(followingSteps))
    throw new Error('Rear-group run needs an initial paid turn and steps.');
  const initial=continueRearContactV1({soloInput,groupId,...initialTurn});
  let group=initial.rearGroup;
  const steps=[];
  for(const input of followingSteps){
    if(!group)throw new Error('A rejoined rear group cannot keep riding behind.');
    const step=advanceRearGroupStepV1({...input,group});
    steps.push(step);
    group=step.rearGroup;
  }
  return {version:REAR_GROUP_RUN_VERSION,initial,steps,
    finalGroup:group,
    riderIds:[...initial.contact.event.riderIds],
    joinedBunchAtDistanceM:initial.event?.kind==='rejoin_bunch'?
      initial.event.atDistanceM:
      steps.at(-1)?.event?.kind==='rejoin_bunch'?
        steps.at(-1).event.atDistanceM:null};
}

export function validateRearGroupRunV1(input,recording){
  if(!isDeepStrictEqual(recording,runRearGroupV1(input)))
    throw new Error('Rear-group run differs from its source plans.');
  return true;
}
