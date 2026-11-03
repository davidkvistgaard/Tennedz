// Price a rear group's first measured bunch meeting. It remains a
// contact probe until each rider's next physical choice is resolved.
import {isDeepStrictEqual} from 'node:util';
import {resolvePhysicalOrderedRearFirstContactV1} from
  './physical-ordered-rear-first-contact-v1.mjs';
import {runPhysicalStaggeredBunchLossV1} from
  './physical-start-bunch-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {riderKilometreEffect} from
  './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {segmentBaseSeconds} from
  './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS,
  MOTOR_DRAFT_SHELTER} from
  './tuning.mjs';

export const PHYSICAL_ORDERED_REAR_BUNCH_CONTACT_VERSION=
  'v2-physical-ordered-rear-bunch-contact-1';
const EPS=1e-6;

export function probePhysicalOrderedRearBunchContactV1(
  input){
  const first=resolvePhysicalOrderedRearFirstContactV1(
    input);
  const event=first.nextCandidateEvent;
  const group=first.candidateGroupRoad;
  if(!group||!event?.involvesBunch||
    !event.roadIds.includes(group.groupId)||
    !event.roadIds.includes('peloton')||
    event.clockSeconds<=first.contact.clockSeconds||
    event.atDistanceM<=
      first.contact.atDistanceM)
    throw new Error(
      'Rear bunch probe needs next paid group meeting.');
  const {startInput,start,throughKm:km}=input;
  const segment=startInput.routeKilometres[km-1];
  const staggered=runPhysicalStaggeredBunchLossV1({
    startInput,start,throughKm:km});
  const bunchStep=staggered.road[km-1];
  if(bunchStep.splits.length||
    bunchStep.physicalGroup.riderIds.length<1)
    throw new Error(
      'Rear bunch probe needs uninterrupted bunch road.');
  const priorBunchClock=first.sources.boundary
    .prior.source.kilometres.at(-1)
    .riderStates.find(row=>
      row.physicalGroupId==='peloton')
    .elapsedSeconds;
  const metres=event.metresIntoKm;
  if(Math.abs(priorBunchClock+
    bunchStep.elapsedSeconds*metres/1000-
    event.clockSeconds)>EPS)
    throw new Error('Rear bunch contact clocks differ.');
  const leaderAbility=50+
    (segmentBaseSeconds(segment)-
      bunchStep.elapsedSeconds)/
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const groupDistanceM=event.atDistanceM-
    group.startDistanceM;
  const groupRiders=group.riderIds.map(riderId=>{
    const row=group.rows.find(item=>
      item.riderId===riderId);
    const atContact=event.riders.find(item=>
      item.riderId===riderId);
    const team=startInput.teams.find(item=>
      item.riders.some(rider=>
        rider.id===riderId));
    const rider=team.riders.find(item=>
      item.id===riderId);
    const intent=physicalRearIntentAtKmV2({
      startInput,riderId,km});
    const paid=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:row.energyBefore,
      effort:intent.effort,
      role:row.role,
      distanceM:groupDistanceM});
    if(!atContact||
      Math.abs(paid.energyAfter-
        atContact.energyAtContact)>.002)
      throw new Error(
        'Rear bunch meeting lacks paid group energy.');
    const effect=riderKilometreEffect(
      rider,segment,{phase:'cruise',
        energy:atContact.energyAtContact,
        exposed:segment.exposed});
    const holdAbility=effect.ability+
      (TUNING.effortPressure[
        intent.effort]-1)*20+
      MOTOR_DRAFT_SHELTER[segment.terrain];
    const remainingM=1000-metres;
    const sheltered=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:atContact.energyAtContact,
      effort:intent.effort,
      role:'sheltered',
      distanceM:remainingM});
    const exposed=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:atContact.energyAtContact,
      effort:intent.effort,
      role:'solo',distanceM:remainingM});
    const reserveOkay=intent.action!==
      'save_for_stage'||
      sheltered.energyAfter>=
        intent.committedStagePlan.reserveEnergy;
    return {riderId,
      groupRole:row.role,
      intent,energyBeforeGroup:
        row.energyBefore,
      groupEnergySpentToContact:
        paid.energyDemand,
      energyAtContact:
        atContact.energyAtContact,
      holdAbility,leaderAbility,
      shelteredEnergyDemand:
        sheltered.energyDemand,
      exposedAlternativeEnergyDemand:
        exposed.energyDemand,
      payable:atContact.energyAtContact+
        EPS>=sheltered.energyDemand,
      canHold:holdAbility+EPS>=
        leaderAbility,
      reserveOkay,
      shelterCheaper:
        sheltered.energyDemand<
          exposed.energyDemand};
  });
  const bunchRiders=bunchStep.physicalGroup
    .riderIds.map(riderId=>{
      const row=bunchStep.riders.find(item=>
        item.riderId===riderId);
      return {riderId,role:row.role,
        energyBefore:row.energyBefore,
        energySpentToContact:
          row.energySpent*metres/1000,
        energyAtContact:row.energyBefore-
          row.energySpent*metres/1000};
    });
  if(bunchRiders.filter(row=>
    row.role==='leader').length!==1||
    bunchRiders.some(row=>
      !Number.isFinite(row.energyAtContact)||
      row.energyAtContact<0))
    throw new Error(
      'Rear bunch meeting lacks paid bunch leader.');
  return {version:
    PHYSICAL_ORDERED_REAR_BUNCH_CONTACT_VERSION,
  sourceKm:km,sources:{first,
    bunchStep},
  contact:{...event,
    groupLeaderRiderId:
      group.leaderRiderId,
    bunchLeaderRiderId:
      bunchStep.leaderRiderId,
    groupRiders,bunchRiders,
    nextChoiceUnsettled:true,
    physicalGroupsStillSeparate:true},
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearBunchContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalOrderedRearBunchContactV1(input)))
    throw new Error(
      'Rear bunch contact differs from paid source.');
  return true;
}
