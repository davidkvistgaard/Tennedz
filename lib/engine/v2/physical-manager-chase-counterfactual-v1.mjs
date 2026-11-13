// Read-only physical consequence of a manager's already named chase
// order, even when the experimental tactical policy advises watch or
// capacity shortfall. It never routes a race or changes that advice.
import {isDeepStrictEqual} from 'node:util';
import {decidePhysicalFrontThreatV1} from
  './physical-front-threat-choice-v1.mjs';
import {advancePhysicalPerceivedChaseBunchKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalChasedFrontStepV1} from
  './physical-chased-front-step-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_MANAGER_CHASE_COUNTERFACTUAL_VERSION=
  'v2-physical-manager-chase-counterfactual-1';

export function runPhysicalManagerChaseCounterfactualV1(input){
  const {startInput,start,attackKm,choiceKm,
    observerTeamId,nominatedChaseTeamIds,
    conditionalChaseTeamIds=[],throughKm}=input;
  if(!Number.isInteger(throughKm)||throughKm<choiceKm||
    throughKm>startInput?.routeKilometres?.length)
    throw new Error('Manager chase probe needs sourced road.');
  const threat=decidePhysicalFrontThreatV1({startInput,
    start,attackKm,choiceKm,observerTeamId,
    nominatedChaseTeamIds,conditionalChaseTeamIds});
  const frontRiderId=threat.frontRiderId;
  let priorBunch=threat.physicalSource.bunch.road.at(-1);
  let priorFront=threat.physicalSource.front;
  let bunchElapsedSeconds=threat.physicalSource.bunch
    .elapsedSeconds;
  let gapSeconds=threat.observedGapSeconds;
  const steps=[];
  let contact=null;
  let stoppedReason=null;
  for(let km=choiceKm;km<=throughKm;km++){
    const segment=startInput.routeKilometres[km-1];
    const workingTeams=startInput.teams.filter(team=>
      orderAt(team.orders,km-1).frontWork==='rotate');
    if(workingTeams.length!==1)
      throw new Error('Manager chase needs one named worker.');
    const workingTeam=workingTeams[0];
    const workingOrder=orderAt(workingTeam.orders,km-1);
    if(workingOrder.chase==='ignore'){
      stoppedReason='manager_chase_order_ended';break;
    }
    if(!nominatedChaseTeamIds.includes(workingTeam.id))
      throw new Error('Manager chase needs nominated working team.');
    const prior={riderIds:priorBunch.physicalGroup.riderIds,
      energyByRider:priorBunch.energyByRider,
      quietKmByRider:priorBunch.quietKmByRider};
    const bunchStep=advancePhysicalPerceivedChaseBunchKmV1({
      startInput,prior,segment,frontRiderId});
    const leaderDecision=bunchStep.riderDecisions.find(row=>
      row.riderId===bunchStep.leaderRiderId);
    if(leaderDecision.choice!=='chase'||
      bunchStep.leaderRiderId!==workingOrder
        .frontWorkRiderId)
      throw new Error('Manager chase lacks its paid leader.');
    const frontStep=advancePhysicalChasedFrontStepV1({
      startInput,frontRiderId,priorFront,segment});
    const nextGap=gapSeconds+bunchStep.elapsedSeconds-
      frontStep.seconds;
    if(nextGap<=0){
      const fraction=gapSeconds/(
        frontStep.seconds-bunchStep.elapsedSeconds);
      if(!Number.isFinite(fraction)||fraction<=0||
        fraction>1)
        throw new Error('Manager chase needs valid paid contact.');
      const atDistanceM=(km-1+fraction)*1000;
      const clockSeconds=priorFront.elapsedSeconds+
        frontStep.seconds*fraction;
      if(Math.abs(clockSeconds-(bunchElapsedSeconds+
        bunchStep.elapsedSeconds*fraction))>1e-7)
        throw new Error('Manager chase contact clocks differ.');
      const frontTeam=startInput.teams.find(team=>
        team.riders.some(rider=>rider.id===frontRiderId));
      const frontRider=frontTeam.riders.find(row=>
        row.id===frontRiderId);
      const frontPaid=priceRearEnergyDemandV1({
        rider:frontRider,segment,
        energyBefore:priorFront.energyAfter,
        effort:frontStep.decision.effort,
        role:'solo',distanceM:fraction*1000});
      contact={sourceKm:km,riderId:frontRiderId,
        atDistanceM,clockSeconds,
        leaderRiderId:bunchStep.leaderRiderId,
        frontEnergyBefore:priorFront.energyAfter,
        frontEnergySpent:frontPaid.energyDemand,
        frontEnergyAtContact:frontPaid.energyAfter,
        bunchPartial:bunchStep.riders.map(row=>({
          riderId:row.riderId,role:row.role,
          energyBefore:row.energyBefore,
          energySpent:row.energySpent*fraction,
          energyAtContact:row.energyBefore-
            row.energySpent*fraction}))};
      steps.push({sourceKm:km,bunchStep,
        frontDecision:frontStep.decision,
        gapBeforeSeconds:gapSeconds,
        contactFraction:fraction,
        remainingKmUnsettled:true});
      break;
    }
    bunchElapsedSeconds+=bunchStep.elapsedSeconds;
    if(Math.abs(bunchElapsedSeconds-
      frontStep.elapsedSeconds-nextGap)>1e-7)
      throw new Error('Manager chase gap differs from clocks.');
    steps.push({sourceKm:km,bunchStep,frontStep,
      gapBeforeSeconds:gapSeconds,
      gapAfterSeconds:nextGap});
    priorBunch=bunchStep;
    priorFront=frontStep;
    gapSeconds=nextGap;
  }
  return {version:PHYSICAL_MANAGER_CHASE_COUNTERFACTUAL_VERSION,
    sourceKm:choiceKm,throughKm,observerTeamId,
    frontRiderId,
    perceivedAction:threat.choice.choice.assessments[0].action,
    observedGapSeconds:threat.observedGapSeconds,
    threat,steps,contact,stoppedReason,
    ...(contact||stoppedReason?{}:{
      finalGapSeconds:gapSeconds}),
    decisionSource:'precommitted_manager_order',
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerChaseCounterfactualV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalManagerChaseCounterfactualV1(input)))
    throw new Error('Manager chase probe differs from paid source.');
  return true;
}
