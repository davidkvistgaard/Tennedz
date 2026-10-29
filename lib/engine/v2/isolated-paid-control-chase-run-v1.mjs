// Reassess one observed front each kilometre. An explicit controller
// works while the observer waits and shares the wind when chase begins.
import {isDeepStrictEqual} from 'node:util';
import {decideCommittedTeamChaseV1} from './team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  './road-group-sprint-choice-v1.mjs';
import {advanceIsolatedPaidControlRoadV1} from
  './isolated-paid-control-road-v1.mjs';
import {advanceIsolatedPaidCooperativeRoadV1} from
  './isolated-paid-cooperative-road-v1.mjs';

export const ISOLATED_PAID_CONTROL_CHASE_RUN_VERSION=
  'v2-isolated-paid-control-chase-run-1';

export function runIsolatedPaidControlChaseV1({commitment,teams,
  roadGroup,observerTeamId,controlTeamId,raceSeed,
  nominatedChaseTeamIds,conditionalChaseTeamIds=[],
  unavailableRiderIds=[],frontRiderGoals,
  remainingSegments}){
  if(!Array.isArray(remainingSegments)||!remainingSegments.length||
    remainingSegments.at(-1).km!==commitment?.distanceKm||
    remainingSegments.some((row,index)=>
      !Number.isInteger(row?.km)||row.km<1||
      index>0&&row.km!==remainingSegments[index-1].km+1)||
    roadGroup?.riderIds?.length!==1||
    !Array.isArray(teams)||
    !Array.isArray(frontRiderGoals)||
    frontRiderGoals.length!==1||
    frontRiderGoals[0].riderId!==roadGroup.riderIds[0])
    throw new Error('Control-chase run needs a complete one-front route.');
  let workingTeams=structuredClone(teams);
  let group=structuredClone(roadGroup);
  const steps=[];
  let unresolved=null;
  for(let index=0;index<remainingSegments.length;index++){
    const segment=remainingSegments[index];
    const stepTeams=structuredClone(workingTeams);
    const committedChoiceInput={commitment,teams:stepTeams,
      roadGroups:[group],observerTeamId,raceSeed,
      nominatedChaseTeamIds,conditionalChaseTeamIds,
      unavailableRiderIds,
      remainingSegments:remainingSegments.slice(index)};
    const committedChoice=decideCommittedTeamChaseV1(
      committedChoiceInput);
    const action=committedChoice.choice.assessments[0]?.action;
    if(!['watch','commit_now','commit_and_request_help'].includes(
      action)){
      unresolved={sourceKm:segment.km,action,
        observedGapSeconds:group.gapSeconds,
        committedChoiceInput,committedChoice};
      break;
    }
    const frontChoiceInput={roadGroups:[group],
      groupId:group.id,teams:stepTeams,
      riderGoals:frontRiderGoals,km:segment.km,
      distanceKm:commitment.distanceKm,raceSeed};
    const frontChoice=decideRoadGroupSprintChoiceV1(
      frontChoiceInput);
    const paidInput={committedChoiceInput,committedChoice,
      frontChoiceInput,frontChoice,segment,controlTeamId};
    const road=action==='watch'?
      advanceIsolatedPaidControlRoadV1(paidInput):
      advanceIsolatedPaidCooperativeRoadV1(paidInput);
    steps.push({action,paidInput,road});
    workingTeams=structuredClone(stepTeams);
    for(const team of workingTeams)for(const rider of team.riders){
      if(road.energyByRider[rider.id]!==undefined)
        team.energy[rider.id]=road.energyByRider[rider.id];
    }
    if(road.contact)break;
    group={...group,gapSeconds:road.gapSeconds};
  }
  if(!steps.length)
    throw new Error('Control-chase run has no supported paid road.');
  const worked=new Set(steps.flatMap(step=>
    Object.keys(step.road.energyByRider)));
  return {version:ISOLATED_PAID_CONTROL_CHASE_RUN_VERSION,
    sourceKm:remainingSegments[0].km,steps,unresolved,
    contact:steps.at(-1).road.contact,
    endDistanceM:steps.at(-1).road.endDistanceM,
    finalGapSeconds:steps.at(-1).road.gapSeconds,
    finalTeams:workingTeams,
    unmodeledRiderIds:teams.flatMap(team=>team.riders.map(row=>
      row.id)).filter(id=>!worked.has(id)),
    officialResults:false};
}

export function validateIsolatedPaidControlChaseRunV1(input,recording){
  if(!isDeepStrictEqual(recording,
    runIsolatedPaidControlChaseV1(input)))
    throw new Error('Control-chase run differs from paid source.');
  return true;
}
