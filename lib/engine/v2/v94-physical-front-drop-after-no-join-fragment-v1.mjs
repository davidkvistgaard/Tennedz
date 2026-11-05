// After an unpaid overtake, price the next measured contact only for
// riders who can hold the named solo's paid shelter through km 6.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalFrontDropNoJoinChoiceV1} from
  './v94-physical-front-drop-no-join-choice-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_AFTER_NO_JOIN_FRAGMENT_VERSION=
  'v94-physical-front-drop-after-no-join-fragment-1';
const EPS=1e-7;

export function replayV94PhysicalFrontDropAfterNoJoinFragmentV1(
  recording,prior){
  const probe=decideV94PhysicalFrontDropNoJoinChoiceV1(
    recording,prior);
  const contact=probe.nextPayableContact;
  const km=probe.sourceKm;
  const segment=recording.route.kilometres[km-1];
  if(!contact?.candidates.length||
    probe.laterPayableContactCount!==
      contact.candidates.length||
    probe.contacts.some(row=>
      row.clockSeconds>=contact.clockSeconds-EPS))
    throw new Error('No-join fragment needs the next paid contact.');
  const first=contact.candidates[0];
  const leaderId=probe.soloRoadId.slice('solo-'.length);
  if(first.soloRiderId!==leaderId||
    contact.candidates.some(row=>
      row.soloRiderId!==leaderId||
      Math.abs(row.soloEnergyAtContact-
        first.soloEnergyAtContact)>EPS||
      Math.abs(row.perceivedLeaderAbility-
        first.perceivedLeaderAbility)>EPS||
      row.choice!=='pending_paid_shelter_contact'))
    throw new Error('No-join fragment lacks one paid leader.');
  const sources=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const priorFinishes=new Map(prior.finishes.map(row=>[
    row.riderId,row]));
  const remainingM=km*1000-contact.atDistanceM;
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-first.perceivedLeaderAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0||
    remainingM<=0||remainingM>=1000)
    throw new Error('No-join fragment needs payable distance.');
  const speedMps=1000/secondsPerKm;
  const finishClockSeconds=contact.clockSeconds+
    remainingM/speedMps;
  const candidates=[{riderId:leaderId,role:'leader',
    effectiveEffort:first.soloManagerEffort,
    managerEffort:first.soloManagerEffort,
    sportingGoal:first.soloSportingGoal,
    energyAtContact:first.soloEnergyAtContact,
    priorRoadId:probe.soloRoadId},
  ...contact.candidates.map(row=>({
    riderId:row.dropRiderId,role:'sheltered',
    effectiveEffort:row.dropEffectiveEffort,
    managerEffort:row.dropManagerEffort,
    sportingGoal:row.dropSportingGoal,
    energyAtContact:row.dropEnergyAtContact,
    priorRoadId:row.dropRoadId}))];
  const riderWork=candidates.map(row=>{
    const rider=sources.get(row.riderId);
    const previous=priorFinishes.get(row.riderId);
    if(!rider||!previous)
      throw new Error('No-join fragment lacks paid rider source.');
    const paidEnergyToContact=previous.energyAfter-
      row.energyAtContact;
    if(paidEnergyToContact<0)
      throw new Error('No-join fragment creates reserve.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.effectiveEffort,role:row.role,
      distanceM:remainingM});
    const recovery=recoveryForKilometre({rider,segment,
      effort:row.effectiveEffort,group:'dropped',
      working:row.role==='leader',quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('No-join fragment cannot claim recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,
      throughKm:km}).cap;
    const capAdjustment=Math.max(0,price.energyAfter-cap);
    const paidFromReserve=paidEnergyToContact+
      price.energyDemand;
    const energyAfter=+Math.min(cap,
      price.energyAfter).toFixed(3);
    if(Math.abs(previous.energyAfter-paidFromReserve-
      capAdjustment-energyAfter)>.001+EPS)
      throw new Error('No-join fragment lacks paid continuity.');
    return {version:
      V94_PHYSICAL_FRONT_DROP_AFTER_NO_JOIN_FRAGMENT_VERSION,
    sourceKm:km,riderId:row.riderId,
    previousPhysicalGroup:previous.physicalGroup,
    previousRoadId:row.priorRoadId,
    roleAfterContact:row.role,
    managerEffort:row.managerEffort,
    effectiveEffort:row.effectiveEffort,
    sportingGoal:row.sportingGoal,
    energyBeforeKm:previous.energyAfter,
    energyAtContact:row.energyAtContact,
    paidEnergyToContact,
    paidEnergyAfterContact:price.energyDemand,
    paidFromReserve,recoveryAward:0,
    capAdjustment,energyAfter,
    finishClockSeconds,endDistanceM:km*1000};
  });
  return {version:
    V94_PHYSICAL_FRONT_DROP_AFTER_NO_JOIN_FRAGMENT_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactChoiceVersion:probe.version,
    noJoinContactCount:probe.contacts.length,
    contactClockSeconds:contact.clockSeconds,
    atDistanceM:contact.atDistanceM,
    previousRoadIds:candidates.map(row=>row.priorRoadId),
    road:{roadId:`paid-front-drop-after-no-join-km${km}-${
      leaderId}`,kind:'rear_group_fragment',
      leaderRiderId:leaderId,
      shelteredRiderIds:contact.candidates.map(row=>
        row.dropRiderId),
      startClockSeconds:contact.clockSeconds,
      finishClockSeconds,
      startDistanceM:contact.atDistanceM,
      endDistanceM:km*1000,speedMps},
    riderWork,
    paidContactGroupFragment:true,
    otherRoadContactsUnchecked:true,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalFrontDropAfterNoJoinFragmentV1(
  recording,prior,fragment){
  if(!isDeepStrictEqual(fragment,
    replayV94PhysicalFrontDropAfterNoJoinFragmentV1(
      recording,prior)))
    throw new Error('No-join fragment differs from paid roads.');
  return true;
}
