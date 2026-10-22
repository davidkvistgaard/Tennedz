import {isDeepStrictEqual} from 'node:util';
import {decideLastKmRotationOutcomeFromTour} from
  './finale-last-km-rotation-outcome.mjs';
import {recordFinaleRotationBranchFromTour} from
  './finale-rotation-branch-recording.mjs';
import {decideFinaleRotationSoloOutcomeFromTour,
  recordFinaleRotationSoloRunFromTour,
  recordFinaleRotationSoloFinalContactFromTour} from
  './finale-rotation-solo-slice.mjs';
import {recordFinaleRotationSoloCatchBranchFromTour} from
  './finale-rotation-solo-catch-branch.mjs';
import {recordFinaleRotationSoloSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {probeFinaleRotationSoloFinishBoundsFromTour,
  probeFinaleRotationSoloFinalContactBoundsFromTour} from
  './finale-rotation-solo-finish-bounds.mjs';
import {projectV2FinalePointBounds} from
  '../../race/v2-finale-point-bounds.mjs';

export const FINALE_ROTATION_V91_CANDIDATE_VERSION=
  'v2-finale-rotation-v91-candidate-1';

// One read-only shape across the supported named-attack outcomes. Road,
// energy and possible results are linked; classification is always withheld.
export function recordFinaleRotationV91CandidateFromTour(tour,input){
  const initialDecision=decideLastKmRotationOutcomeFromTour(tour,{
    teamId:input.attackTeamId});
  let soloDecision=null,sourceBranch,plan,line,bounds,pointBounds;
  let planStatus='applied';
  let branch=initialDecision.branch;
  if(branch==='caught'||branch==='contained'){
    sourceBranch=recordFinaleRotationBranchFromTour(tour,{
      ...input,branch});
    if(sourceBranch.road.version!==initialDecision.sourceBridgeVersion)
      throw new Error('The 500 m branch does not match its road decision.');
    ({plan,bounds}=sourceBranch);
    line=sourceBranch.sprint;
  }else{
    soloDecision=decideFinaleRotationSoloOutcomeFromTour(tour,input);
    if(soloDecision.sourceRoadTraceVersion!==
      initialDecision.sourceBridgeVersion)
      throw new Error('The solo branch has a different 500 m road.');
    branch=soloDecision.branch;
    if(!['surviving_solo','final_contact'].includes(branch)){
      sourceBranch=recordFinaleRotationSoloCatchBranchFromTour(
        tour,input);
      if(!isDeepStrictEqual(sourceBranch.decision,soloDecision))
        throw new Error('The solo contact branch does not match its decision.');
      ({plan,bounds}=sourceBranch);
      line=sourceBranch.sprint;
      pointBounds=sourceBranch.points;
    }else{
      plan=recordFinaleRotationSoloSprintPlanFromTour(tour,input);
      if(plan.decisions.some(row=>row.leadOutRiderId))
        throw new Error('Unpaid solo lead-outs cannot enter the line candidate.');
      planStatus='recorded_unapplied';
      line=branch==='surviving_solo'?
        recordFinaleRotationSoloRunFromTour(tour,input):
        recordFinaleRotationSoloFinalContactFromTour(tour,input);
      bounds=branch==='surviving_solo'?
        probeFinaleRotationSoloFinishBoundsFromTour(tour,input):
        probeFinaleRotationSoloFinalContactBoundsFromTour(tour,input);
    }
  }
  pointBounds??=projectV2FinalePointBounds(tour,{
    ...input,branch});
  const lineTime=bounds.elapsedSecondsFromLastKmStart??
    bounds.elapsedBunchSecondsFromLastKmStart;
  const riderCount=tour.committedInputs.teams.reduce((count,team)=>
    count+team.riders.length,0);
  if(bounds.sourceRunVersion!==line.version||
    pointBounds.sourceBoundsVersion!==bounds.version||
    lineTime!==line.bunchElapsedSecondsAtLine||
    line.endDistanceM!==tour.route.distanceKm*1000||
    line.lineRiderEnergy.length!==riderCount||
    pointBounds.canCommitAwards||pointBounds.awardRows.length)
    throw new Error('The v91 candidate has inconsistent line or points.');
  return {version:FINALE_ROTATION_V91_CANDIDATE_VERSION,
    sourceTourVersion:tour.version,
    sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,
    initialDecision,soloDecision,branch,
    sourceBranchVersion:sourceBranch?.version??null,
    plan,planStatus,line,bounds,pointBounds,
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleRotationV91CandidateFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationV91CandidateFromTour(tour,input)))
    throw new Error('The v91 finale candidate does not replay.');
  return true;
}
