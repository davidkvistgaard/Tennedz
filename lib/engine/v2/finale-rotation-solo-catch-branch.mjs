import {isDeepStrictEqual} from 'node:util';
import {decideFinaleRotationSoloOutcomeFromTour} from
  './finale-rotation-solo-slice.mjs';
import {recordFinaleRotationSoloSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleRotationSoloFirstCatchSprintFromTour,
  recordFinaleRotationSoloSecondCatchSprintFromTour,
  recordFinaleRotationSoloLateCatchSprintFromTour} from
  './finale-rotation-solo-late-catch-sprint.mjs';
import {probeFinaleRotationSoloFirstCatchBoundsFromTour,
  probeFinaleRotationSoloSecondCatchBoundsFromTour,
  probeFinaleRotationSoloLateCatchBoundsFromTour} from
  './finale-rotation-solo-finish-bounds.mjs';
import {projectV2FinalePointBounds} from
  '../../race/v2-finale-point-bounds.mjs';

export const FINALE_ROTATION_SOLO_CATCH_BRANCH_VERSION=
  'v2-finale-rotation-solo-catch-branch-1';

// Read-only contact → manager plan → paid line → possible place/point chain.
// The selected contact branch comes exclusively from the measured road.
export function recordFinaleRotationSoloCatchBranchFromTour(tour,input){
  const decision=decideFinaleRotationSoloOutcomeFromTour(tour,input);
  if(!['first_catch','second_catch','late_catch']
    .includes(decision.branch))
    throw new Error('The solo catch bundle needs measured contact.');
  const plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
  const sprint=decision.branch==='first_catch'?
    recordFinaleRotationSoloFirstCatchSprintFromTour(tour,input):
    decision.branch==='second_catch'?
      recordFinaleRotationSoloSecondCatchSprintFromTour(tour,input):
      recordFinaleRotationSoloLateCatchSprintFromTour(tour,input);
  const bounds=decision.branch==='first_catch'?
    probeFinaleRotationSoloFirstCatchBoundsFromTour(tour,input):
    decision.branch==='second_catch'?
      probeFinaleRotationSoloSecondCatchBoundsFromTour(tour,input):
      probeFinaleRotationSoloLateCatchBoundsFromTour(tour,input);
  const points=projectV2FinalePointBounds(tour,{
    ...input,branch:decision.branch});
  if(sprint.sourceCatchVersion!==decision.sourceOutcomeVersion||
    sprint.sprintPlanVersion!==plan.version||
    bounds.sourceRunVersion!==sprint.version||
    points.sourceBoundsVersion!==bounds.version||
    bounds.elapsedBunchSecondsFromLastKmStart!==
      sprint.bunchElapsedSecondsAtLine||
    sprint.endDistanceM!==decision.finishDistanceM||
    points.canCommitAwards||points.awardRows.length)
    throw new Error('The solo contact result chain is inconsistent.');
  return {version:FINALE_ROTATION_SOLO_CATCH_BRANCH_VERSION,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    branch:decision.branch,
    decision,plan,sprint,bounds,points,
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleRotationSoloCatchBranchFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationSoloCatchBranchFromTour(tour,input)))
    throw new Error('The solo catch branch does not replay.');
  return true;
}
