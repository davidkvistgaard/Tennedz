import {isDeepStrictEqual} from 'node:util';
import {divisionMultiplier} from '../calendar/division-reveal.mjs';
import {POINT_POLICY_VERSION,pointsForDivisionResult} from
  '../calendar/points.mjs';
import {probeFinaleRotationSoloFinishBoundsFromTour,
  probeFinaleRotationSoloLateCatchBoundsFromTour,
  probeFinaleRotationSoloSecondCatchBoundsFromTour,
  probeFinaleRotationSoloFirstCatchBoundsFromTour,
  probeFinaleRotationSoloPenultimateCatchBoundsFromTour,
  probeFinaleRotationSoloFinalContactBoundsFromTour} from
  '../engine/v2/finale-rotation-solo-finish-bounds.mjs';

export const V2_FINALE_POINT_BOUNDS_VERSION=
  'v2-finale-point-bounds-1';
export const V2_FINALE_SECOND_CATCH_POINT_BOUNDS_VERSION=
  'v2-finale-second-catch-point-bounds-1';
export const V2_FINALE_FIRST_CATCH_POINT_BOUNDS_VERSION=
  'v2-finale-first-catch-point-bounds-1';
export const V2_FINALE_PENULTIMATE_CATCH_POINT_BOUNDS_VERSION=
  'v2-finale-penultimate-catch-point-bounds-1';
export const V2_FINALE_FINAL_CONTACT_POINT_BOUNDS_VERSION=
  'v2-finale-final-contact-point-bounds-1';

// Read-only exposure of the existing one-day point scale over every place
// still possible in the road recording. This never creates an award row.
export function projectV2FinalePointBounds(tour,input){
  const {branch,tier,divisionIndex,divisionCount}=input??{};
  if(!['surviving_solo','late_catch','second_catch',
    'first_catch','penultimate_catch','final_contact'].includes(branch)||
    !Number.isInteger(tier)||tier<1||tier>6)
    throw new Error('Finale point bounds need a supported branch and tier.');
  const multiplier=divisionMultiplier(divisionIndex,divisionCount);
  const bounds=branch==='surviving_solo'?
    probeFinaleRotationSoloFinishBoundsFromTour(tour,input):
    branch==='late_catch'?
      probeFinaleRotationSoloLateCatchBoundsFromTour(tour,input):
      branch==='second_catch'?
        probeFinaleRotationSoloSecondCatchBoundsFromTour(tour,input):
        branch==='first_catch'?
          probeFinaleRotationSoloFirstCatchBoundsFromTour(tour,input):
          branch==='penultimate_catch'?
            probeFinaleRotationSoloPenultimateCatchBoundsFromTour(tour,input):
            probeFinaleRotationSoloFinalContactBoundsFromTour(tour,input);
  const riders=bounds.riders.map(row=>{
    const possiblePoints=[];
    for(let placing=row.firstPossiblePlace;
      placing<=row.lastPossiblePlace;placing++)
      possiblePoints.push(pointsForDivisionResult({tier,
        resultType:'ONE_DAY',placing,multiplier}));
    return {riderId:row.riderId,teamId:row.teamId,
      firstPossiblePlace:row.firstPossiblePlace,
      lastPossiblePlace:row.lastPossiblePlace,
      minPossiblePoints:Math.min(...possiblePoints),
      maxPossiblePoints:Math.max(...possiblePoints)};
  });
  return {version:branch==='second_catch'?
    V2_FINALE_SECOND_CATCH_POINT_BOUNDS_VERSION:
    branch==='first_catch'?
      V2_FINALE_FIRST_CATCH_POINT_BOUNDS_VERSION:
      branch==='penultimate_catch'?
        V2_FINALE_PENULTIMATE_CATCH_POINT_BOUNDS_VERSION:
        branch==='final_contact'?
          V2_FINALE_FINAL_CONTACT_POINT_BOUNDS_VERSION:
          V2_FINALE_POINT_BOUNDS_VERSION,
    sourceBoundsVersion:bounds.version,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    branch,tier,divisionIndex,divisionCount,multiplier,
    pointsPolicyVersion:POINT_POLICY_VERSION,
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false,awardRows:[],riders};
}

export function validateV2FinalePointBounds(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,projectV2FinalePointBounds(tour,input)))
    throw new Error('The finale point bounds do not replay.');
  return true;
}
