// Price the first observed front-drop/solo contact to the km boundary.
// The remaining roads require a separate crossing audit and settlement.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalFrontDropContactChoiceV1} from
  './v94-physical-front-drop-contact-choice-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PHYSICAL_FRONT_DROP_CONTACT_FRAGMENT_VERSION=
  'v94-physical-front-drop-contact-fragment-1';
const EPS=1e-8;

export function replayV94PhysicalFrontDropContactFragmentV1(
  recording,prior){
  const choice=decideV94PhysicalFrontDropContactChoiceV1(
    recording,prior);
  const km=choice.sourceKm;
  const segment=recording.route.kilometres[km-1];
  const leader=choice.candidates.find(row=>
    row.riderId===choice.pendingLeaderRiderId);
  const sheltered=choice.candidates.filter(row=>
    choice.pendingShelterRiderIds.includes(row.riderId));
  if(!choice.paidWorkPending||!leader||
    sheltered.length<1||
    choice.candidates.length<3||
    leader.choice!=='volunteer_paid_turn_after_contact'||
    sheltered.some(row=>row.choice!==
      'eligible_for_paid_shelter_after_contact'))
    throw new Error('Front-drop fragment needs payable riders.');
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-leader.perceivedSoloAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Front-drop fragment needs paid leader speed.');
  const speedMps=1000/secondsPerKm;
  const finishClockSeconds=choice.contactClockSeconds+
    choice.remainingDistanceM/speedMps;
  const riders=new Map(recording.committedInputs.teams.flatMap(
    team=>team.riders.map(rider=>[rider.id,rider])));
  const riderWork=choice.candidates.filter(candidate=>
    candidate.riderId===leader.riderId||
    choice.pendingShelterRiderIds.includes(
      candidate.riderId)).map(candidate=>{
    const rider=riders.get(candidate.riderId);
    const role=candidate.riderId===leader.riderId?
      'leader':'sheltered';
    if(!rider||role==='sheltered'&&(
      candidate.perceivedShelterHoldAbility+EPS<
        leader.perceivedSoloAbility||
      candidate.perceivedShelterHoldAbilityAtEnd+EPS<
        leader.perceivedSoloAbility))
      throw new Error(
        'Front-drop fragment cannot hold priced shelter.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:candidate.energyAtContact,
      effort:candidate.effectiveEffort,role,
      distanceM:choice.remainingDistanceM});
    const recovery=recoveryForKilometre({rider,segment,
      effort:candidate.effectiveEffort,
      group:'dropped',working:role==='leader',quietKm:0});
    if(recovery.recovery!==0)
      throw new Error(
        'Front-drop fragment cannot claim front recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,
      throughKm:km}).cap;
    const paidFromReserve=candidate.paidEnergyToContact+
      price.energyDemand;
    const capAdjustment=Math.max(0,price.energyAfter-cap);
    const energyAfter=+Math.min(cap,
      price.energyAfter).toFixed(3);
    if(Math.abs(candidate.energyBeforeKm-
      paidFromReserve-capAdjustment-energyAfter)>.001+EPS)
      throw new Error(
        'Front-drop fragment lacks paid reserve continuity.');
    return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_FRAGMENT_VERSION,
      sourceKm:km,riderId:candidate.riderId,
      teamId:candidate.teamId,
      previousPhysicalGroup:candidate.previousPhysicalGroup,
      paidRoleBeforeContact:
        candidate.paidRoleBeforeContact,
      roleAfterContact:role,
      teamOrderEffort:candidate.managerEffort,
      effectiveEffort:candidate.effectiveEffort,
      sportingGoal:candidate.sportingGoal,
      sportingCaptainId:candidate.sportingCaptainId,
      startDistanceM:(km-1)*1000,
      atContactDistanceM:choice.atDistanceM,
      endDistanceM:km*1000,
      paidEnergyToContact:candidate.paidEnergyToContact,
      paidEnergyAfterContact:price.energyDemand,
      energyBeforeKm:candidate.energyBeforeKm,
      energyAtContact:candidate.energyAtContact,
      paidFromReserve,recoveryAward:0,
      capAdjustment,energyAfter,
      finishClockSeconds};
  });
  const roadId=`paid-front-drop-contact-km${km}-${
    leader.riderId}`;
  return {version:V94_PHYSICAL_FRONT_DROP_CONTACT_FRAGMENT_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactChoiceVersion:choice.version,
    atDistanceM:choice.atDistanceM,
    contactClockSeconds:choice.contactClockSeconds,
    previousRoadIds:[choice.observedRoadIds[0],
      ...sheltered.map(row=>`solo-${row.riderId}`)],
    road:{roadId,kind:'rear_group_fragment',
      leaderRiderId:leader.riderId,
      shelteredRiderIds:sheltered.map(row=>row.riderId),
      startDistanceM:choice.atDistanceM,
      endDistanceM:km*1000,
      startClockSeconds:choice.contactClockSeconds,
      finishClockSeconds,speedMps},
    riderWork,
    paidContactGroupFragment:true,
    otherRoadContactsUnchecked:true,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalFrontDropContactFragmentV1(
  recording,prior,fragment){
  if(!isDeepStrictEqual(fragment,
    replayV94PhysicalFrontDropContactFragmentV1(
      recording,prior)))
    throw new Error(
      'Front-drop fragment differs from paid source.');
  return true;
}
