// A measured solo may enter bunch shelter only after its own
// committed choice and paid remaining distance.
import {isDeepStrictEqual} from 'node:util';
import {probePhysicalOrderedRearContinuationBunchContactV1} from
  './physical-ordered-rear-continuation-bunch-contact-v1.mjs';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';

export const PHYSICAL_ORDERED_REAR_CONTINUATION_BUNCH_JOIN_VERSION=
  'v2-physical-ordered-rear-continuation-bunch-join-1';
const EPS=1e-6;

export function pricePhysicalOrderedRearSoloBunchJoinV1({
  startInput,next,contact}){
  const {riderId}=contact;
  if(!contact.nextChoiceUnsettled||
    !contact.physicalGroupsStillSeparate||
    !contact.canHold||!contact.payable||
    !contact.reserveOkay||
    !contact.shelterCheaper)
    throw new Error(
      'Rear solo bunch join needs payable holding rider.');
  const km=next.sourceKm;
  const segment=startInput.routeKilometres[km-1];
  const team=startInput.teams.find(item=>
    item.riders.some(rider=>
      rider.id===riderId));
  const rider=team.riders.find(item=>
    item.id===riderId);
  const remainingM=1000-
    contact.metresIntoKm;
  const sheltered=priceRearEnergyDemandV1({
    rider,segment,
    energyBefore:contact.energyAtContact,
    effort:contact.intent.effort,
    role:'sheltered',
    distanceM:remainingM});
  const cap=replayRearEnergyCapV1({
    rider,
    kilometres:startInput.routeKilometres,
    throughKm:km}).cap;
  const energyAfter=+Math.min(cap,
    sheltered.energyAfter).toFixed(3);
  if(energyAfter<0||
    contact.intent.action==='save_for_stage'&&
      energyAfter<contact.intent
        .committedStagePlan.reserveEnergy)
    throw new Error(
      'Rear solo bunch join breaks reserve.');
  const bunchEndClock=next.bunchStartClock+
    next.step.elapsedSeconds;
  if(Math.abs(contact.clockSeconds+
    next.step.elapsedSeconds*remainingM/1000-
    bunchEndClock)>EPS)
    throw new Error(
      'Rear solo bunch join breaks clock.');
  const decision={riderId,
    teamId:team.id,
    goal:contact.intent.action,
    effort:contact.intent.effort,
    teamOrderEffort:
      contact.intent.teamOrderEffort,
    committedTeamStake:
      contact.intent.committedTeamStake,
    intentSource:contact.intent.source,
    observedSoloSecondsPerKm:
      contact.observedSecondsPerKmByRoad[
        `solo-${riderId}`],
    observedBunchSecondsPerKm:
      contact.observedSecondsPerKmByRoad
        .peloton,
    choice:'join_bunch_shelter',
    reason:'paid_contact_shelter_saves_energy',
    atDistanceM:contact.atDistanceM,
    atClockSeconds:contact.clockSeconds,
    energyAtContact:contact.energyAtContact,
    shelteredEnergySpent:
      sheltered.energyDemand,
    cap,energyAfter,
    ...(contact.intent.committedStagePlan?{
      committedStagePlan:structuredClone(
        contact.intent.committedStagePlan)}:{})};
  return {riderId,decision,energyAfter,
    bunchEndClock};
}

export function finishPhysicalOrderedRearContinuationBunchJoinV1({
  startInput,prior}){
  const probe=
    probePhysicalOrderedRearContinuationBunchContactV1({
      startInput,prior});
  const {next}=sourcePhysicalOrderedRearBoundaryFromStateV1({
    startInput,prior});
  const contact=probe.contact;
  const km=next.sourceKm;
  const {riderId,decision,energyAfter,
    bunchEndClock}=
    pricePhysicalOrderedRearSoloBunchJoinV1({
      startInput,next,contact});
  const byDecision=new Map(next.step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const riderStates=next.step.physicalGroup
    .riderIds.map(id=>{
      const row=next.step.riders.find(item=>
        item.riderId===id);
      const choice=byDecision.get(id);
      if(!row||!choice)
        throw new Error(
          'Rear solo bunch join lacks prior rider.');
      return {riderId:id,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchEndClock,
        energyAfter:row.energyAfter,
        decisions:[choice]};
    });
  riderStates.push({riderId,
    sourceKm:km,
    physicalGroupId:'peloton',
    atDistanceM:km*1000,
    elapsedSeconds:bunchEndClock,
    energyAfter,
    decisions:[{...contact.soloDecision,
      choice:'ride_to_paid_bunch_contact',
      distanceM:contact.metresIntoKm,
      energyBefore:contact.soloEnergyBefore,
      energySpent:
        contact.soloEnergySpentToContact,
      energyAtContact:
        contact.energyAtContact},
      decision]});
  const riderIds=[...next.step.physicalGroup
    .riderIds,riderId];
  if(new Set(riderIds).size!==riderIds.length)
    throw new Error(
      'Rear solo bunch join repeats rider.');
  return {version:
    PHYSICAL_ORDERED_REAR_CONTINUATION_BUNCH_JOIN_VERSION,
  sourceKm:km,
  sources:{probe},
  contactAtDistanceM:
    contact.atDistanceM,
  contactClockSeconds:
    contact.clockSeconds,
  joinDecision:decision,
  bunchEndClock,
  riderStates,
  physicalGroup:{id:'peloton',
    riderIds,atDistanceM:km*1000},
  nextBunchState:{riderIds,
    energyByRider:{
      ...next.step.energyByRider,
      [riderId]:energyAfter},
    quietKmByRider:{
      ...next.step.quietKmByRider,
      [riderId]:0}},
  otherRearRoadsUnsettled:true,
  fieldKilometreIncomplete:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearContinuationBunchJoinV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    finishPhysicalOrderedRearContinuationBunchJoinV1(
      input)))
    throw new Error(
      'Rear continuation bunch join differs from paid source.');
  return true;
}
