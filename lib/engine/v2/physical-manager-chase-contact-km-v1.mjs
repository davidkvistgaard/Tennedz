// Finish the exact contact kilometre after a manager-ordered paid
// chase probe, only when the caught rider cannot hold the bunch.
// The diagnostic remains separate from guided race routing.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalManagerChaseCounterfactualV1} from
  './physical-manager-chase-counterfactual-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const PHYSICAL_MANAGER_CHASE_CONTACT_KM_VERSION=
  'v2-physical-manager-chase-contact-km-1';

export function completePhysicalManagerChaseContactKmV1(input){
  const {startInput,start,paidProbe}=input;
  const {paidProbe:unused,...sourceInput}=input;
  void unused;
  if(!isDeepStrictEqual(paidProbe,
    runPhysicalManagerChaseCounterfactualV1(sourceInput))||
    !paidProbe.contact)
    throw new Error('Manager contact km needs replayed paid meeting.');
  const contact=paidProbe.contact;
  const km=contact.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const bunchStep=paidProbe.steps.at(-1).bunchStep;
  const leader=bunchStep.riders.find(row=>
    row.riderId===bunchStep.leaderRiderId);
  const team=startInput.teams.find(row=>row.riders.some(rider=>
    rider.id===contact.riderId));
  const rider=team.riders.find(row=>row.id===contact.riderId);
  const order=orderAt(team.orders,km-1);
  const effect=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy:contact.frontEnergyAtContact,
    exposed:segment.exposed});
  const holdAbility=effect.ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(holdAbility+1e-9>=leader.holdAbility)
    throw new Error('Manager-caught rider can hold; slide is not paid.');
  const effort='conserve';
  const soloEffect=riderKilometreEffect(rider,segment,{
    phase:'solo',energy:contact.frontEnergyAtContact,
    exposed:segment.exposed});
  const soloAbility=soloEffect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-soloAbility)*MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Manager-caught solo needs safe paid pace.');
  const remainingM=km*1000-contact.atDistanceM;
  const soloSeconds=secondsPerKm*remainingM/1000;
  const soloElapsedSeconds=contact.clockSeconds+
    soloSeconds;
  const bunchElapsedSeconds=contact.clockSeconds+
    bunchStep.elapsedSeconds*remainingM/1000;
  const gapSecondsToBunch=soloElapsedSeconds-
    bunchElapsedSeconds;
  if(gapSecondsToBunch<=0)
    throw new Error('Manager-caught rider needs paid return contact.');
  const price=priceRearEnergyDemandV1({rider,segment,
    energyBefore:contact.frontEnergyAtContact,
    effort,role:'solo',distanceM:remainingM});
  const recovery=recoveryForKilometre({rider,segment,
    effort,group:'dropped',working:false,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error('Manager-caught solo cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,price.energyAfter)
    .toFixed(3);
  const frontDecision=paidProbe.steps.at(-1).frontDecision;
  const slideDecision={riderId:contact.riderId,
    sourceGoal:frontDecision.goal,goal:'finish_safely',
    teamOrderEffort:order.effort,effort,
    choice:'slide_through',
    reason:'cannot_hold_paid_bunch_pace'};
  const decisions=new Map(bunchStep.riderDecisions.map(row=>
    [row.riderId,row]));
  const riderStates=bunchStep.physicalGroup.riderIds.map(id=>{
    const row=bunchStep.riders.find(item=>
      item.riderId===id);
    return {riderId:id,sourceKm:km,
      physicalGroupId:'peloton',atDistanceM:km*1000,
      elapsedSeconds:bunchElapsedSeconds,
      energyAfter:row.energyAfter,
      decisions:[decisions.get(id)]};
  });
  riderStates.push({riderId:contact.riderId,
    sourceKm:km,
    physicalGroupId:`solo-${contact.riderId}`,
    atDistanceM:km*1000,
    elapsedSeconds:soloElapsedSeconds,
    energyAfter,
    decisions:[frontDecision,slideDecision]});
  if(riderStates.length!==start.riderIds.length||
    new Set(riderStates.map(row=>row.riderId)).size!==
      start.riderIds.length)
    throw new Error('Manager contact km lacks full field.');
  riderStates.sort((a,b)=>start.riderIds.indexOf(a.riderId)-
    start.riderIds.indexOf(b.riderId));
  return {version:PHYSICAL_MANAGER_CHASE_CONTACT_KM_VERSION,
    sourceKm:km,riderId:contact.riderId,
    contactAtDistanceM:contact.atDistanceM,
    holdAbility,bunchLeaderAbility:leader.holdAbility,
    bunchElapsedSeconds,soloElapsedSeconds,
    gapSecondsToBunch,
    soloRemainingEnergySpent:price.energyDemand,
    soloRecoveryAward:0,cap,energyAfter,
    slideDecision,riderStates,
    remainingRaceUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalManagerChaseContactKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    completePhysicalManagerChaseContactKmV1(input)))
    throw new Error('Manager contact km differs from paid source.');
  return true;
}
