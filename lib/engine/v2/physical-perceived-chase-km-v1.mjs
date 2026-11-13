// One paid full-field chase kilometre. An observer first commits from
// a source-derived gap and perceived rival strength; its manager-named
// helper then leads the bunch while every other rider pays shelter.
import {isDeepStrictEqual} from 'node:util';
import {decidePhysicalFrontThreatV1} from
  './physical-front-threat-choice-v1.mjs';
import {advancePhysicalPerceivedChaseBunchKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalChasedFrontStepV1} from
  './physical-chased-front-step-v1.mjs';

export const PHYSICAL_PERCEIVED_CHASE_KM_VERSION=
  'v2-physical-perceived-chase-km-1';

export function advancePhysicalPerceivedChaseKmV1({startInput,
  start,attackKm,choiceKm,observerTeamId,
  nominatedChaseTeamIds,conditionalChaseTeamIds=[]}){
  const threat=decidePhysicalFrontThreatV1({startInput,start,
    attackKm,choiceKm,observerTeamId,
    nominatedChaseTeamIds,conditionalChaseTeamIds});
  if(!['commit_now','commit_and_request_help'].includes(
    threat.choice.choice.assessments[0].action))
    throw new Error('Perceived threat has not committed paid chase.');
  const segment=startInput.routeKilometres[choiceKm-1];
  const priorStep=threat.physicalSource.bunch.road.at(-1);
  const prior={riderIds:priorStep.physicalGroup.riderIds,
    energyByRider:priorStep.energyByRider,
    quietKmByRider:priorStep.quietKmByRider};
  const bunchStep=advancePhysicalPerceivedChaseBunchKmV1({
    startInput,prior,segment,
    frontRiderId:threat.frontRiderId});
  const leaderTeam=startInput.teams.find(team=>team.riders.some(
    rider=>rider.id===bunchStep.leaderRiderId));
  const chaseDecision=bunchStep.riderDecisions.find(row=>
    row.riderId===bunchStep.leaderRiderId);
  if(leaderTeam.id!==observerTeamId||
    chaseDecision.choice!=='chase')
    throw new Error('Perceived choice lacks named paid chase leader.');
  const frontBefore=threat.physicalSource.front;
  const frontStep=advancePhysicalChasedFrontStepV1({
    startInput,frontRiderId:threat.frontRiderId,
    priorFront:frontBefore,segment});
  const gapSecondsToBunch=threat.observedGapSeconds+
    bunchStep.elapsedSeconds-frontStep.seconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Paid pursuit needs a separate contact road.');
  const bunchElapsedSeconds=threat.physicalSource.bunch
    .elapsedSeconds+bunchStep.elapsedSeconds;
  if(Math.abs(bunchElapsedSeconds-frontStep.elapsedSeconds-
    gapSecondsToBunch)>1e-7)
    throw new Error('Paid pursuit clocks differ from physical gap.');
  const riderStates=bunchStep.physicalGroup.riderIds.map(id=>{
    const row=bunchStep.riders.find(item=>item.riderId===id);
    return {riderId:id,sourceKm:choiceKm,
      physicalGroupId:'peloton',atDistanceM:choiceKm*1000,
      elapsedSeconds:bunchElapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[bunchStep.riderDecisions.find(item=>
        item.riderId===id)]};
  });
  riderStates.push({riderId:threat.frontRiderId,
    sourceKm:choiceKm,
    physicalGroupId:frontBefore.physicalGroup.id,
    atDistanceM:choiceKm*1000,
    elapsedSeconds:frontStep.elapsedSeconds,
    energyAfter:frontStep.energyAfter,
    decisions:[frontStep.decision]});
  if(riderStates.length!==start.riderIds.length||
    new Set(riderStates.map(row=>row.riderId)).size!==
      start.riderIds.length)
    throw new Error('Paid pursuit lacks full-field rider decisions.');
  riderStates.sort((a,b)=>start.riderIds.indexOf(a.riderId)-
    start.riderIds.indexOf(b.riderId));
  return {version:PHYSICAL_PERCEIVED_CHASE_KM_VERSION,
    sourceKm:choiceKm,threat,bunchStep,
    frontStep,
    gapSecondsToBunch,riderStates,
    officialResults:false};
}

export function validatePhysicalPerceivedChaseKmV1(input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalPerceivedChaseKmV1(input)))
    throw new Error('Paid perceived chase differs from source.');
  return true;
}
