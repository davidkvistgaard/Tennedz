// Consecutive paid kilometres for one observed front and one committed chase
// team. The ledger includes only front and named chase riders, not the field.
import {isDeepStrictEqual} from 'node:util';
import {decideCommittedTeamChaseV1} from './team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  './road-group-sprint-choice-v1.mjs';
import {advanceIsolatedPaidChaseRoadV1} from
  './isolated-paid-chase-road-v1.mjs';

export const ISOLATED_PAID_CHASE_RUN_VERSION=
  'v2-isolated-paid-chase-run-1';

export function runIsolatedPaidChaseV1({commitment,teams,
  roadGroup,observerTeamId,raceSeed,
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
    throw new Error('Paid chase run needs a complete one-front route.');
  let workingTeams=structuredClone(teams);
  let group=structuredClone(roadGroup);
  const steps=[];
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
    if(!['commit_now','commit_and_request_help'].includes(
      committedChoice.choice.assessments[0]?.action))
      throw new Error(`No paid chase order at km ${segment.km}: `+
        committedChoice.choice.assessments[0]?.action);
    const frontChoiceInput={roadGroups:[group],
      groupId:group.id,teams:stepTeams,
      riderGoals:frontRiderGoals,km:segment.km,
      distanceKm:commitment.distanceKm,raceSeed};
    const frontChoice=decideRoadGroupSprintChoiceV1(
      frontChoiceInput);
    const paidInput={committedChoiceInput,committedChoice,
      frontChoiceInput,frontChoice,segment};
    const road=advanceIsolatedPaidChaseRoadV1(paidInput);
    steps.push({paidInput,road});
    workingTeams=structuredClone(stepTeams);
    for(const team of workingTeams)for(const rider of team.riders){
      if(road.energyByRider[rider.id]!==undefined)
        team.energy[rider.id]=road.energyByRider[rider.id];
    }
    if(road.contact)break;
    group={...group,gapSeconds:road.gapSeconds};
  }
  return {version:ISOLATED_PAID_CHASE_RUN_VERSION,
    sourceKm:remainingSegments[0].km,
    steps,contact:steps.at(-1).road.contact,
    endDistanceM:steps.at(-1).road.endDistanceM,
    finalGapSeconds:steps.at(-1).road.gapSeconds,
    finalTeams:workingTeams,
    unmodeledRiderIds:teams.flatMap(team=>team.riders.map(row=>
      row.id)).filter(id=>!steps.some(step=>
      step.road.energyByRider[id]!==undefined)),
    officialResults:false};
}

export function validateIsolatedPaidChaseRunV1(input,recording){
  if(!isDeepStrictEqual(recording,runIsolatedPaidChaseV1(input)))
    throw new Error('Paid chase run differs from committed source.');
  return true;
}
