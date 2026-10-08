import {isDeepStrictEqual} from 'node:util';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationContainedFromTour} from
  './finale-last-km-rotation-contained.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationContainedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleRotationCatchOrderedApproachFromTour,
  recordFinaleRotationContainedOrderedApproachFromTour} from
  './finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleRotationCatchOrderedSprintFromTour,
  recordFinaleRotationContainedOrderedSprintFromTour} from
  './finale-rotation-catch-ordered-sprint.mjs';
import {probeFinaleRotationCatchOrderedBoundsFromTour,
  probeFinaleRotationContainedOrderedBoundsFromTour} from
  './finale-rotation-catch-finish-bounds.mjs';

export const FINALE_ROTATION_BRANCH_RECORDING_VERSION=
  'v2-finale-rotation-branch-recording-1';

// Read-only bundle for one narrow last-kilometre branch. It binds the
// validated v91 source, player plan and every short-step transition to the
// same branch; no result or award may be inferred from its position bounds.
export function recordFinaleRotationBranchFromTour(tour,input){
  const branch=input?.branch;
  if(!['caught','contained'].includes(branch))
    throw new Error('The finale rotation branch must be caught or contained.');
  const caught=branch==='caught';
  const road=caught?
    probeLastKmRotationCatchFromTour(tour,{teamId:input.attackTeamId}):
    probeLastKmRotationContainedFromTour(tour,{teamId:input.attackTeamId});
  const plan=caught?
    recordFinaleRotationCatchSprintPlanFromTour(tour,input):
    recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  const approach=caught?
    recordFinaleRotationCatchOrderedApproachFromTour(tour,input):
    recordFinaleRotationContainedOrderedApproachFromTour(tour,input);
  const sprint=caught?
    recordFinaleRotationCatchOrderedSprintFromTour(tour,input):
    recordFinaleRotationContainedOrderedSprintFromTour(tour,input);
  const bounds=caught?
    probeFinaleRotationCatchOrderedBoundsFromTour(tour,input):
    probeFinaleRotationContainedOrderedBoundsFromTour(tour,input);
  if(plan.sourceRoadTraceVersion!==road.version||
    approach.sourceRoadTraceVersion!==road.version||
    approach.sprintPlanVersion!==plan.version||
    sprint.sourceApproachVersion!==approach.version||
    sprint.sprintPlanVersion!==plan.version||
    bounds.sourceRunVersion!==sprint.version||
    bounds.elapsedSecondsFromLastKmStart!==
      sprint.bunchElapsedSecondsAtLine)
    throw new Error('The finale branch has inconsistent source handoffs.');
  return {version:FINALE_ROTATION_BRANCH_RECORDING_VERSION,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    sourceKm:road.sourceKm,
    branch,attackTeamId:input.attackTeamId,
    resultStatus:'unclassified',
    road,plan,approach,sprint,bounds};
}

export function validateFinaleRotationBranchFromTour(tour,input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationBranchFromTour(tour,input)))
    throw new Error('The finale rotation branch does not replay.');
  return true;
}
