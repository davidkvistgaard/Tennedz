// Complete the contact kilometre for a source-replayed paid chase whose
// caught front rider explicitly chooses to finish alone behind the bunch.
import {isDeepStrictEqual} from 'node:util';
import {runIsolatedPaidChaseV1} from './isolated-paid-chase-run-v1.mjs';
import {advanceCaughtFrontSlideV1} from
  './isolated-caught-front-slide-v1.mjs';

export const ISOLATED_PAID_CHASE_SLIDE_RUN_VERSION=
  'v2-isolated-paid-chase-slide-run-1';

export function runIsolatedPaidChaseSlideV1({paidChaseInput,
  slideDecision}){
  const chase=runIsolatedPaidChaseV1(paidChaseInput);
  if(!chase.contact||chase.steps.at(-1).road.endDistanceM>=
    chase.steps.at(-1).paidInput.segment.km*1000)
    throw new Error('Slide run needs a within-kilometre paid contact.');
  const finalStep=chase.steps.at(-1);
  const slide=advanceCaughtFrontSlideV1({
    paidInput:finalStep.paidInput,paidRoad:finalStep.road,
    slideDecision});
  if(slide.endDistanceM!==finalStep.paidInput.segment.km*1000)
    throw new Error('Slide run needs a complete paid postcontact road.');
  const finalTeams=structuredClone(chase.finalTeams);
  for(const team of finalTeams)for(const rider of team.riders){
    if(slide.energyByRider[rider.id]!==undefined)
      team.energy[rider.id]=slide.energyByRider[rider.id];
  }
  return {version:ISOLATED_PAID_CHASE_SLIDE_RUN_VERSION,
    chase,slide,finalTeams,
    unmodeledRiderIds:chase.unmodeledRiderIds,
    endDistanceM:slide.endDistanceM,officialResults:false};
}

export function validateIsolatedPaidChaseSlideV1(input,recording){
  if(!isDeepStrictEqual(recording,runIsolatedPaidChaseSlideV1(input)))
    throw new Error('Chase and slide run differs from paid source.');
  return true;
}
