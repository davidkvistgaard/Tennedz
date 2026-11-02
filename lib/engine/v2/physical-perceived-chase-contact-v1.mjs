// An already committed physical chase meets its front solo only when
// both independently paid road clocks reach the same metre and time.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalPerceivedChaseV1} from
  './physical-perceived-chase-run-v1.mjs';
import {advancePhysicalPerceivedChaseBunchKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalChasedFrontStepV1} from
  './physical-chased-front-step-v1.mjs';
import {priceRearEnergyDemandV1} from './rear-energy-demand-v1.mjs';

export const PHYSICAL_PERCEIVED_CHASE_CONTACT_VERSION=
  'v2-physical-perceived-chase-contact-1';

export function catchPhysicalPerceivedChaseV1({startInput,
  start,attackKm,choiceKm,observerTeamId,
  nominatedChaseTeamIds,conditionalChaseTeamIds=[],catchKm}){
  if(!Number.isInteger(catchKm)||catchKm<=choiceKm||
    catchKm>startInput?.routeKilometres?.length)
    throw new Error('Perceived catch needs later sourced road.');
  const chase=runPhysicalPerceivedChaseV1({startInput,start,
    attackKm,choiceKm,observerTeamId,nominatedChaseTeamIds,
    conditionalChaseTeamIds,throughKm:catchKm-1});
  const prior=chase.steps.at(-1);
  const frontRiderId=chase.frontRiderId;
  const segment=startInput.routeKilometres[catchKm-1];
  const bunchPrior={riderIds:prior.bunchStep.physicalGroup.riderIds,
    energyByRider:prior.bunchStep.energyByRider,
    quietKmByRider:prior.bunchStep.quietKmByRider};
  const bunchStep=advancePhysicalPerceivedChaseBunchKmV1({
    startInput,prior:bunchPrior,segment,frontRiderId});
  const leaderTeam=startInput.teams.find(team=>
    team.riders.some(row=>row.id===bunchStep.leaderRiderId));
  const leaderDecision=bunchStep.riderDecisions.find(row=>
    row.riderId===bunchStep.leaderRiderId);
  if(!nominatedChaseTeamIds.includes(leaderTeam.id)||
    leaderDecision.choice!=='chase')
    throw new Error('Perceived catch needs named paid chaser.');
  const frontStep=advancePhysicalChasedFrontStepV1({
    startInput,frontRiderId,
    priorFront:prior.frontStep,segment});
  const gainSecondsPerKm=frontStep.seconds-
    bunchStep.elapsedSeconds;
  const fraction=prior.gapSecondsToBunch/
    gainSecondsPerKm;
  if(!Number.isFinite(fraction)||
    prior.gapSecondsToBunch<=0||
    gainSecondsPerKm<=0||fraction<=0||fraction>=1)
    throw new Error('Perceived chase has no paid catch here.');
  const contactAtDistanceM=(catchKm-1+fraction)*1000;
  const contactClockSeconds=prior.frontStep.elapsedSeconds+
    frontStep.seconds*fraction;
  const bunchPriorSeconds=prior.frontStep.elapsedSeconds+
    prior.gapSecondsToBunch;
  if(Math.abs(contactClockSeconds-(bunchPriorSeconds+
    bunchStep.elapsedSeconds*fraction))>1e-7)
    throw new Error('Perceived catch clocks differ.');
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===frontRiderId));
  const rider=team.riders.find(row=>row.id===frontRiderId);
  const paid=priceRearEnergyDemandV1({rider,segment,
    energyBefore:prior.frontStep.energyAfter,
    effort:frontStep.decision.effort,
    role:'solo',distanceM:fraction*1000});
  return {version:PHYSICAL_PERCEIVED_CHASE_CONTACT_VERSION,
    sourceKm:catchKm,attackKm,choiceKm,
    contact:{kind:'paid_chase_catches_front_solo',
      riderId:frontRiderId,
      atDistanceM:contactAtDistanceM,
      clockSeconds:contactClockSeconds},
    frontDecision:{...frontStep.decision,
      choice:'drive_until_caught'},
    frontPartial:{riderId:frontRiderId,
      physicalGroup:{id:`front-${frontRiderId}`,
        riderIds:[frontRiderId],
        atDistanceM:contactAtDistanceM},
      secondsPerKm:frontStep.seconds,
      energyBefore:prior.frontStep.energyAfter,
      energySpent:paid.energyDemand,
      energyAtContact:paid.energyAfter},
    bunchPartial:{physicalGroup:{id:'peloton',
      riderIds:[...bunchStep.physicalGroup.riderIds],
      atDistanceM:contactAtDistanceM},
      leaderRiderId:bunchStep.leaderRiderId,
      secondsPerKm:bunchStep.elapsedSeconds,
      riders:bunchStep.riders.map(row=>({
        riderId:row.riderId,role:row.role,
        energyBefore:row.energyBefore,
        energySpent:row.energySpent*fraction,
        energyAtContact:row.energyBefore-
          row.energySpent*fraction}))},
    priorChase:chase,bunchStep,frontStep,
    remainingKmUnsettled:true,officialResults:false};
}

export function validatePhysicalPerceivedChaseContactV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    catchPhysicalPerceivedChaseV1(input)))
    throw new Error('Perceived catch differs from paid source.');
  return true;
}
