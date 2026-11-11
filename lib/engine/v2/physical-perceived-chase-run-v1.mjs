// Consecutive paid physical pursuit after one perceived commitment.
// Manager-named chase leaders rotate by committed orders; a caught
// front rider requires a separate paid contact source.
import {isDeepStrictEqual} from 'node:util';
import {advancePhysicalPerceivedChaseKmV1} from
  './physical-perceived-chase-km-v1.mjs';
import {advancePhysicalPerceivedChaseBunchKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalChasedFrontStepV1} from
  './physical-chased-front-step-v1.mjs';

export const PHYSICAL_PERCEIVED_CHASE_RUN_VERSION=
  'v2-physical-perceived-chase-run-1';

export function runPhysicalPerceivedChaseV1({startInput,start,
  attackKm,choiceKm,observerTeamId,nominatedChaseTeamIds,
  conditionalChaseTeamIds=[],throughKm}){
  if(!Number.isInteger(throughKm)||throughKm<choiceKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Physical chase needs later sourced road.');
  const first=advancePhysicalPerceivedChaseKmV1({startInput,
    start,attackKm,choiceKm,observerTeamId,
    nominatedChaseTeamIds,conditionalChaseTeamIds});
  const frontRiderId=first.threat.frontRiderId;
  const steps=[{sourceKm:choiceKm,
    bunchStep:first.bunchStep,frontStep:first.frontStep,
    gapSecondsToBunch:first.gapSecondsToBunch,
    riderStates:first.riderStates}];
  let priorBunch=first.bunchStep;
  let priorFront=first.frontStep;
  let bunchElapsedSeconds=first.threat.physicalSource.bunch
    .elapsedSeconds+first.bunchStep.elapsedSeconds;
  for(let km=choiceKm+1;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const prior={riderIds:priorBunch.physicalGroup.riderIds,
      energyByRider:priorBunch.energyByRider,
      quietKmByRider:priorBunch.quietKmByRider};
    const bunchStep=advancePhysicalPerceivedChaseBunchKmV1({
      startInput,prior,segment,frontRiderId});
    const leaderTeam=startInput.teams.find(team=>
      team.riders.some(row=>row.id===bunchStep.leaderRiderId));
    const leaderDecision=bunchStep.riderDecisions.find(row=>
      row.riderId===bunchStep.leaderRiderId);
    if(!nominatedChaseTeamIds.includes(leaderTeam.id)||
      leaderDecision.choice!=='chase')
      throw new Error('Later chase needs nominated paid leader.');
    const frontStep=advancePhysicalChasedFrontStepV1({
      startInput,frontRiderId,priorFront,segment});
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    const gapSecondsToBunch=bunchElapsedSeconds-
      frontStep.elapsedSeconds;
    if(gapSecondsToBunch<=0)
      throw new Error('Later pursuit needs paid contact road.');
    const decisions=new Map(bunchStep.riderDecisions.map(row=>
      [row.riderId,row]));
    const riderStates=bunchStep.physicalGroup.riderIds.map(id=>{
      const row=bunchStep.riders.find(item=>item.riderId===id);
      return {riderId:id,sourceKm:km,
        physicalGroupId:'peloton',atDistanceM:km*1000,
        elapsedSeconds:bunchElapsedSeconds,
        energyAfter:row.energyAfter,
        decisions:[decisions.get(id)]};
    });
    riderStates.push({riderId:frontRiderId,
      sourceKm:km,physicalGroupId:`front-${frontRiderId}`,
      atDistanceM:km*1000,
      elapsedSeconds:frontStep.elapsedSeconds,
      energyAfter:frontStep.energyAfter,
      decisions:[frontStep.decision]});
    if(riderStates.length!==start.riderIds.length||
      new Set(riderStates.map(row=>row.riderId)).size!==
        start.riderIds.length||riderStates.some(row=>
        !Number.isFinite(row.elapsedSeconds)||
        !Number.isFinite(row.energyAfter)||
        !row.decisions.length||row.decisions.some(
          decision=>!decision)))
      throw new Error('Physical chase lacks rider kilometre.');
    riderStates.sort((a,b)=>start.riderIds.indexOf(a.riderId)-
      start.riderIds.indexOf(b.riderId));
    steps.push({sourceKm:km,bunchStep,frontStep,
      gapSecondsToBunch,riderStates});
    priorBunch=bunchStep;
    priorFront=frontStep;
  }
  const last=steps.at(-1);
  return {version:PHYSICAL_PERCEIVED_CHASE_RUN_VERSION,
    attackKm,choiceKm,throughKm,frontRiderId,
    source:first,steps,
    gapSecondsToBunch:last.gapSecondsToBunch,
    physicalGroups:[last.bunchStep.physicalGroup,
      {id:`front-${frontRiderId}`,
        riderIds:[frontRiderId],atDistanceM:throughKm*1000}],
    ...(throughKm===startInput.routeKilometres.length?{
      observedFinishSecondsByRider:Object.fromEntries(
        last.riderStates.map(row=>[row.riderId,
          row.elapsedSeconds]))}:{}),
    officialResults:false};
}

export function validatePhysicalPerceivedChaseRunV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalPerceivedChaseV1(input)))
    throw new Error('Physical chase run differs from paid source.');
  return true;
}
