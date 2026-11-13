// A measured third rear encounter may form a group only after the
// source validates all participating roads and pays the shared road.
import {isDeepStrictEqual} from 'node:util';
import {inspectTwoRearPairsFieldContactV1} from
  './physical-two-rear-pairs-field-contact-v1.mjs';
import {finishVerifiedPairContactRoadV1} from
  './physical-loss-km-contact-road-v1.mjs';
import {runVerifiedRearPairRoadV1} from
  './physical-loss-km-rear-pair-v1.mjs';

export const PHYSICAL_THIRD_REAR_CONTACT_ROAD_VERSION=
  'v2-physical-third-rear-contact-road-1';
export const PHYSICAL_THIRD_REAR_GROUP_VERSION=
  'v2-physical-third-rear-group-1';

function sourceContact(input){
  const source=inspectTwoRearPairsFieldContactV1(input);
  const contact=source.nextContacts[0];
  if(source.nextContacts.length!==1||
    (input.thirdContact!==undefined&&
      !isDeepStrictEqual(input.thirdContact,contact))||
    !['rear_pair_meets_solo',
      'rear_pair_meets_rear_pair'].includes(
      contact.kind)||
    new Set(contact.riders.map(row=>
      row.riderId)).size!==contact.riders.length||
    contact.riders.length<3)
    throw new Error('Third rear group needs exact paid contact.');
  return contact;
}

function leaderAtContact(input,roadId,km){
  for(const [road,pair] of [[input.contactRoad,
    input.pair],[input.secondContactRoad,
    input.secondPair]]){
    if(road.physicalGroup.id!==roadId)continue;
    if(road.sourceKm===km)
      return road.leaderRiderId;
    const step=pair.steps.find(row=>
      row.sourceKm===km);
    if(!step)
      throw new Error('Third contact lacks exposed source leader.');
    return step.leaderRiderId;
  }
  if(input.soloField.candidates.some(row=>
    row.riderId===roadId))
    return roadId;
  throw new Error('Third contact lacks catching road.');
}

function payThirdContact(input,event){
  const contact={sourceKm:event.sourceKm,
    riderIds:event.riders.map(row=>row.riderId),
    atDistanceM:event.atDistanceM,
    clockSeconds:event.clockSeconds,
    riders:event.riders};
  const preferredLeaderRiderId=leaderAtContact(input,
    event.catchingRoadId,event.sourceKm);
  if(!contact.riderIds.includes(
    preferredLeaderRiderId))
    throw new Error('Third contact leader lacks paid road.');
  return finishVerifiedPairContactRoadV1({
    startInput:input.startInput,
    staggered:input.staggered,contact,
    preferredLeaderRiderId,
    version:PHYSICAL_THIRD_REAR_CONTACT_ROAD_VERSION,
    withinLoss:false,groupKind:'third',
    contactReason:{leader:'paid_third_contact_turn',
      sheltered:'shelter_after_paid_third_contact'}});
}

function runThirdGroup(input,event,road){
  const contact={sourceKm:event.sourceKm,
    riderIds:event.riders.map(row=>row.riderId),
    atDistanceM:event.atDistanceM,
    clockSeconds:event.clockSeconds,
    riders:event.riders};
  return runVerifiedRearPairRoadV1({
    startInput:input.startInput,
    staggered:input.staggered,contact,
    contactRoad:road,throughKm:input.throughKm,
    version:PHYSICAL_THIRD_REAR_GROUP_VERSION});
}

export function advancePhysicalThirdRearGroupV1(input){
  const event=sourceContact(input);
  const road=payThirdContact(input,event);
  const group=runThirdGroup(input,event,road);
  return {version:PHYSICAL_THIRD_REAR_GROUP_VERSION,
    thirdContact:event,thirdContactRoad:road,group,
    movesGuidedRace:false,officialResults:false};
}

export function finishPhysicalThirdRearContactV1(input){
  return payThirdContact(input,sourceContact(input));
}

export function runPhysicalThirdRearGroupV1(input){
  const event=sourceContact(input);
  const road=payThirdContact(input,event);
  if(!isDeepStrictEqual(input.thirdContactRoad,road))
    throw new Error('Third rear group needs paid remainder.');
  return runThirdGroup(input,event,road);
}

export function validatePhysicalThirdRearGroupV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalThirdRearGroupV1(input)))
    throw new Error('Third rear group differs from paid source.');
  return true;
}
