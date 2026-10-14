import {isDeepStrictEqual} from 'node:util';
import {probeLastKmRotationCatchFromTour} from
  './finale-last-km-rotation-catch.mjs';
import {probeLastKmRotationContainedFromTour} from
  './finale-last-km-rotation-contained.mjs';
import {decideLastKmRotationOutcomeFromTour} from
  './finale-last-km-rotation-outcome.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  recordFinaleRotationContainedSprintPlanFromTour} from
  './finale-sprint-plan.mjs';
import {recordFinaleRotationCatchLeadOutApproachFromTour,
  recordFinaleRotationContainedLeadOutApproachFromTour} from
  './finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleRotationCatchLeadOutSprintFromTour,
  recordFinaleRotationContainedLeadOutSprintFromTour} from
  './finale-rotation-catch-ordered-sprint.mjs';

export const FINALE_ROTATION_LEAD_OUT_CANDIDATE_VERSION=
  'v2-finale-rotation-lead-out-candidate-1';

// One replayable 500 m movement and energy contract for a complete bunch.
// A time advantage relative to that bunch is not an overtaking rule: neither
// individual placings nor the existing point ledger may be derived from it.
export function recordFinaleRotationLeadOutCandidateFromTour(tour,input){
  const leadOutTiming=input?.leadOutTiming??'late';
  if(leadOutTiming!=='late')
    throw new Error('This candidate supports a late 500 m lead-out only.');
  const initialDecision=decideLastKmRotationOutcomeFromTour(tour,{
    teamId:input?.attackTeamId});
  const branch=initialDecision.branch;
  if(input?.branch!==undefined&&input.branch!==branch)
    throw new Error('The chosen lead-out branch differs from the road.');
  if(!['caught','contained'].includes(branch))
    throw new Error('A surviving solo needs a separate lead-out finale.');
  const caught=branch==='caught';
  const road=caught?
    probeLastKmRotationCatchFromTour(tour,{teamId:input.attackTeamId}):
    probeLastKmRotationContainedFromTour(tour,{
      teamId:input.attackTeamId});
  const plan=caught?
    recordFinaleRotationCatchSprintPlanFromTour(tour,input):
    recordFinaleRotationContainedSprintPlanFromTour(tour,input);
  const approach=caught?
    recordFinaleRotationCatchLeadOutApproachFromTour(tour,input):
    recordFinaleRotationContainedLeadOutApproachFromTour(tour,input);
  const sprint=caught?
    recordFinaleRotationCatchLeadOutSprintFromTour(tour,input):
    recordFinaleRotationContainedLeadOutSprintFromTour(tour,input);
  const riderIds=tour.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(initialDecision.sourceBridgeVersion!==road.version||
    plan.sourceRoadTraceVersion!==road.version||
    approach.sourceRoadTraceVersion!==road.version||
    approach.sourceBunchElapsedSeconds!==
      road.at500M.bunchElapsedSeconds||
    approach.sprintPlanVersion!==plan.version||
    sprint.sourceApproachVersion!==approach.version||
    sprint.sprintPlanVersion!==plan.version||
    sprint.sourceBunchElapsedSecondsAt300M!==
      approach.bunchElapsedSecondsAt300M||
    sprint.startDistanceM!==approach.endDistanceM||
    sprint.endDistanceM!==tour.route.distanceKm*1000||
    sprint.bunchElapsedSecondsAtLine!==
      approach.bunchElapsedSecondsAt300M+
      sprint.frames.reduce((sum,frame)=>
        sum+frame.bunchTravelSeconds,0)||
    !isDeepStrictEqual(new Set(sprint.lineRiderEnergy.map(row=>
      row.riderId)),new Set(riderIds))||
    sprint.lineRiderEnergy.length!==riderIds.length)
    throw new Error('The paid lead-out line has inconsistent handoffs.');
  const leadOutEffects=plan.decisions.filter(row=>row.leadOutRiderId)
    .map(row=>({teamId:row.teamId,helperId:row.leadOutRiderId,
      finisherId:row.finisherId,
      helperEnergySpent:approach.frames.reduce((sum,frame)=>
        sum+frame.riderEnergy.find(energy=>
          energy.riderId===row.leadOutRiderId).energySpent,0),
      gainSecondsAt300M:approach.finisherGainsAt300M.find(gain=>
        gain.riderId===row.finisherId).gainSeconds,
      gainSecondsAtLine:sprint.lineRiderEnergy.find(energy=>
        energy.riderId===row.finisherId).gainSeconds}));
  return {version:FINALE_ROTATION_LEAD_OUT_CANDIDATE_VERSION,
    sourceTourVersion:tour.version,sourceMotorVersion:tour.tuningVersion,
    raceCategory:tour.raceCategory,initialDecision,branch,
    leadOutTiming,leadOutStartDistanceM:tour.route.distanceKm*1000-500,
    road,plan,approach,sprint,leadOutEffects,
    resultStatus:'unclassified',pointsStatus:'withheld',
    canCommitAwards:false};
}

export function validateFinaleRotationLeadOutCandidateFromTour(tour,
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordFinaleRotationLeadOutCandidateFromTour(tour,input)))
    throw new Error('The paid lead-out candidate does not replay.');
  return true;
}
