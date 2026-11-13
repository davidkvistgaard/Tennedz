import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedThreeFrontPost500CandidateClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleMixedPost500OutsideLaneLine} from
  './finale-mixed-post500-outside-lane-line.mjs';

export const FINALE_MIXED_POST500_OUTSIDE_LANE_RESULT_VERSION=
  'v2-finale-mixed-post500-outside-lane-result-1';

// The candidate group clock is retained as paid source evidence only. The
// conditional result comes from individual runners and their inferred,
// separately guarded lanes; the marker crossing never becomes a catch.
export function recordFinaleMixedPost500OutsideLaneResult(tour,{
  plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedThreeFrontPost500CandidateClock(tour);
  const line=recordFinaleMixedPost500OutsideLaneLine(tour,clock,{plans});
  const pointPreview=pointContext?{
    status:'unavailable',
    reason:'Inferred outside lanes leave occupied wheel order and policy points unresolved.',
    pointsStatus:'withheld',canCommitAwards:false}:null;
  return {version:FINALE_MIXED_POST500_OUTSIDE_LANE_RESULT_VERSION,
    clock,line,pointPreview,
    roadStatus:'conditional_paid_post500_outside_lane_passes',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleMixedPost500OutsideLaneResult(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedPost500OutsideLaneResult(tour,input)))
    throw new Error('The mixed post-500 outside-lane result does not replay.');
  return true;
}
