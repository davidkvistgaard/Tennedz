// Replays a watched, paid control road before the observer's first
// cooperative chase kilometre. No additional road is inferred.
import {isDeepStrictEqual} from 'node:util';
import {runIsolatedPaidControlV1} from
  './isolated-paid-control-run-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  './road-group-sprint-choice-v1.mjs';
import {advanceIsolatedPaidCooperativeRoadV1} from
  './isolated-paid-cooperative-road-v1.mjs';

export const ISOLATED_PAID_CONTROL_CHASE_HANDOFF_VERSION=
  'v2-isolated-paid-control-chase-handoff-1';

export function advancePaidControlChaseHandoffV1({
  controlRunInput,controlRun}){
  if(!isDeepStrictEqual(controlRun,
    runIsolatedPaidControlV1(controlRunInput))||
    controlRun.contact||
    !['commit_now','commit_and_request_help'].includes(
      controlRun.handoff?.action))
    throw new Error('Cooperative handoff needs replayed paid control.');
  const handoff=controlRun.handoff;
  const segment=controlRunInput.remainingSegments.find(row=>
    row.km===handoff.sourceKm);
  if(!segment||
    !isDeepStrictEqual(handoff.committedChoiceInput.teams,
      controlRun.finalTeams)||
    handoff.observedGapSeconds!==controlRun.finalGapSeconds)
    throw new Error('Cooperative handoff differs from paid road state.');
  const group=handoff.committedChoiceInput.roadGroups[0];
  const frontChoiceInput={roadGroups:[group],groupId:group.id,
    teams:handoff.committedChoiceInput.teams,
    riderGoals:controlRunInput.frontRiderGoals,
    km:segment.km,
    distanceKm:controlRunInput.commitment.distanceKm,
    raceSeed:controlRunInput.raceSeed};
  const frontChoice=decideRoadGroupSprintChoiceV1(
    frontChoiceInput);
  const cooperativeInput={
    committedChoiceInput:handoff.committedChoiceInput,
    committedChoice:handoff.committedChoice,
    frontChoiceInput,frontChoice,segment,
    controlTeamId:controlRunInput.controlTeamId};
  const cooperativeRoad=advanceIsolatedPaidCooperativeRoadV1(
    cooperativeInput);
  const finalTeams=structuredClone(controlRun.finalTeams);
  for(const team of finalTeams)for(const rider of team.riders){
    if(cooperativeRoad.energyByRider[rider.id]!==undefined)
      team.energy[rider.id]=cooperativeRoad.energyByRider[rider.id];
  }
  const worked=new Set([
    ...controlRun.steps.flatMap(step=>
      Object.keys(step.road.energyByRider)),
    ...Object.keys(cooperativeRoad.energyByRider)]);
  return {version:ISOLATED_PAID_CONTROL_CHASE_HANDOFF_VERSION,
    controlRun,cooperativeInput,cooperativeRoad,
    finalTeams,endDistanceM:cooperativeRoad.endDistanceM,
    unmodeledRiderIds:finalTeams.flatMap(team=>
      team.riders.map(row=>row.id)).filter(id=>!worked.has(id)),
    officialResults:false};
}

export function validatePaidControlChaseHandoffV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advancePaidControlChaseHandoffV1(input)))
    throw new Error('Control-to-chase handoff differs from source.');
  return true;
}
