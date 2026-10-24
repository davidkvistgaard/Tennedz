import {isDeepStrictEqual} from 'node:util';
import {recordFinaleCoastMixedThreeFrontStraddlingCandidateClock} from
  './finale-separated-last-km.mjs';
import {recordFinaleMixedStraddlingOutsideLaneLine} from
  './finale-mixed-straddling-outside-lane-line.mjs';

export const FINALE_MIXED_STRADDLING_OUTSIDE_LANE_RESULT_VERSION=
  'v2-finale-mixed-straddling-outside-lane-result-1';

// The marker clock is evidence for paid travel, not evidence that a rider
// joined road-2. Only separate individual runners provide conditional lines.
export function recordFinaleMixedStraddlingOutsideLaneResult(tour,{
  plans=null,pointContext=null}={}){
  const clock=recordFinaleCoastMixedThreeFrontStraddlingCandidateClock(tour);
  const line=recordFinaleMixedStraddlingOutsideLaneLine(tour,clock,{plans});
  if(clock.markerPasses.length!==7||
    line.sourceExitAudit.approachCount!==7||
    line.contactResolved!==false||
    line.conditionalCrossings.length!==160||
    !line.finalRoadBands.some(row=>row.id==='road-2')||
    clock.markerPasses.some(row=>
      !line.finalRoadBands.some(band=>
        band.id===`isolated:${row.riderId}`)))
    throw new Error('The straddling whole-race result lacks paid lanes.');
  const pointPreview=pointContext?{
    status:'unavailable',
    reason:'Inferred outside lanes leave occupied wheel order and policy points unresolved.',
    pointsStatus:'withheld',canCommitAwards:false}:null;
  return {version:FINALE_MIXED_STRADDLING_OUTSIDE_LANE_RESULT_VERSION,
    clock,line,pointPreview,
    roadStatus:'conditional_straddling_outside_lane_passes',
    classifiedResults:null,pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleMixedStraddlingOutsideLaneResult(tour,input,
  recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleMixedStraddlingOutsideLaneResult(tour,input)))
    throw new Error('The straddling whole-race result does not replay.');
  return true;
}
