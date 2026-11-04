// Pay the remaining metres of one observed rear-road contact.
// Other roads still need a whole-field crossing audit.
import {isDeepStrictEqual} from 'node:util';
import {decideV94PhysicalMidKmContactChoiceV1} from
  './v94-physical-mid-km-contact-choice-v1.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {MOTOR_RACE_DYNAMICS} from './tuning.mjs';

export const V94_PHYSICAL_MID_KM_CONTACT_FRAGMENT_VERSION=
  'v94-physical-mid-km-contact-fragment-1';
const EPS=1e-8;

export function replayV94PhysicalMidKmContactFragmentV1(
  recording,prior){
  const choice=decideV94PhysicalMidKmContactChoiceV1(
    recording,prior);
  const {sourceKm:km,remainingDistanceM}=choice;
  const segment=recording.route.kilometres[km-1];
  const leader=choice.candidates.find(row=>
    row.riderId===choice.pendingLeaderRiderId);
  if(!leader||!choice.paidWorkPending||
    choice.pendingShelterRiderIds.length!==
      choice.candidates.length-1)
    throw new Error(
      'Contact fragment needs one payable leader and all riders.');
  const secondsPerKm=segmentBaseSeconds(segment)+
    (50-leader.perceivedSoloAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  if(!Number.isFinite(secondsPerKm)||secondsPerKm<=0)
    throw new Error('Contact fragment needs positive leader speed.');
  const speedMps=1000/secondsPerKm;
  const finishClockSeconds=choice.clockSeconds+
    remainingDistanceM/speedMps;
  const byRider=new Map(recording.committedInputs.teams.flatMap(team=>
    team.riders.map(rider=>[rider.id,rider])));
  const work=choice.candidates.map(row=>{
    const rider=byRider.get(row.riderId);
    const role=row.riderId===leader.riderId?
      'leader':'sheltered';
    if(role==='sheltered'&&(
      !choice.pendingShelterRiderIds.includes(row.riderId)||
      row.perceivedShelterHoldAbility+EPS<
        leader.perceivedSoloAbility))
      throw new Error('Contact rider cannot hold paid shelter.');
    const price=priceRearEnergyDemandV1({rider,segment,
      energyBefore:row.energyAtContact,
      effort:row.managerEffort,role,
      distanceM:remainingDistanceM});
    const recovery=recoveryForKilometre({rider,segment,
      effort:row.managerEffort,group:'dropped',
      working:role==='leader',quietKm:0});
    if(recovery.recovery!==0)
      throw new Error('Contact fragment cannot claim bunch recovery.');
    const cap=replayRearEnergyCapV1({rider,
      kilometres:recording.route.kilometres,
      throughKm:km}).cap;
    const capAdjustment=Math.max(0,price.energyAfter-cap);
    const paidFromReserve=row.paidEnergyToContact+
      price.energyDemand;
    const energyAfter=+Math.min(cap,price.energyAfter).toFixed(3);
    if(Math.abs(row.energyBeforeKm-paidFromReserve-
      capAdjustment-energyAfter)>.001)
      throw new Error('Contact fragment lacks energy continuity.');
    return {version:V94_PHYSICAL_MID_KM_CONTACT_FRAGMENT_VERSION,
      sourceKm:km,riderId:row.riderId,
      previousPhysicalGroup:row.previousPhysicalGroup,
      roleBeforeContact:row.paidRoleBeforeContact,
      roleAfterContact:role,
      teamOrderEffort:row.managerEffort,
      sportingGoal:row.sportingGoal,
      sportingCaptainId:row.sportingCaptainId,
      startDistanceM:(km-1)*1000,
      atContactDistanceM:choice.atDistanceM,
      endDistanceM:km*1000,
      paidEnergyToContact:row.paidEnergyToContact,
      paidEnergyAfterContact:price.energyDemand,
      energyBeforeKm:row.energyBeforeKm,
      energyAtContact:row.energyAtContact,
      paidFromReserve,capAdjustment,
      recoveryAward:0,energyAfter,
      finishClockSeconds};
  });
  const groupId=`paid-mid-km-contact-km${km}-${
    leader.riderId}`;
  return {version:V94_PHYSICAL_MID_KM_CONTACT_FRAGMENT_VERSION,
    sourceKm:km,priorSourceKm:prior.sourceKm,
    contactChoiceVersion:choice.version,
    atDistanceM:choice.atDistanceM,
    contactClockSeconds:choice.clockSeconds,
    previousRoadIds:choice.observedRoads.map(row=>
      row.roadId),
    road:{roadId:groupId,kind:'rear_group_fragment',
      leaderRiderId:leader.riderId,
      shelteredRiderIds:[...choice.pendingShelterRiderIds],
      startDistanceM:choice.atDistanceM,
      endDistanceM:km*1000,
      startClockSeconds:choice.clockSeconds,
      finishClockSeconds,speedMps},
    riderWork:work,
    paidContactGroupFragment:true,
    otherRoadContactsUnchecked:true,
    fullFieldKilometre:false,officialResults:false};
}

export function validateV94PhysicalMidKmContactFragmentV1(
  recording,prior,fragment){
  if(!isDeepStrictEqual(fragment,
    replayV94PhysicalMidKmContactFragmentV1(
      recording,prior)))
    throw new Error('Contact fragment differs from paid source.');
  return true;
}
