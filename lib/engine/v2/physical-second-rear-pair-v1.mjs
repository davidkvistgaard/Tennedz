// The second rear pair exists only after a replayed meeting of two
// previously separate solos. Later encounters remain unsettled.
import {isDeepStrictEqual} from 'node:util';
import {inspectNextRearPairFieldContactV1} from
  './physical-rear-pair-field-contact-v1.mjs';
import {finishVerifiedPairContactRoadV1} from
  './physical-loss-km-contact-road-v1.mjs';
import {runVerifiedRearPairRoadV1} from
  './physical-loss-km-rear-pair-v1.mjs';

export const PHYSICAL_SECOND_REAR_PAIR_VERSION=
  'v2-physical-second-rear-pair-1';
export const PHYSICAL_SECOND_REAR_PAIR_ROAD_VERSION=
  'v2-physical-second-rear-pair-road-1';

function replaySecondContact(input){
  const source=inspectNextRearPairFieldContactV1(input);
  const contact=input.secondContact;
  if(source.nextContacts.length!==1||
    !isDeepStrictEqual(contact,source.nextContacts[0])||
    contact.kind!=='two_other_solos_meet'||
    !contact.catchingRiderId||
    !contact.riderIds.includes(contact.catchingRiderId)||
    contact.riders.length!==2)
    throw new Error('Second rear pair needs exact paid solo contact.');
  return contact;
}

export function finishPhysicalSecondRearPairContactV1(input){
  const contact=replaySecondContact(input);
  return finishVerifiedPairContactRoadV1({
    startInput:input.startInput,
    staggered:input.staggered,contact,
    preferredLeaderRiderId:contact.catchingRiderId,
    version:PHYSICAL_SECOND_REAR_PAIR_ROAD_VERSION,
    withinLoss:false});
}

export function runPhysicalSecondRearPairV1(input){
  const contact=replaySecondContact(input);
  const expectedRoad=finishPhysicalSecondRearPairContactV1(input);
  if(!isDeepStrictEqual(input.secondContactRoad,expectedRoad))
    throw new Error('Second rear pair needs paid contact remainder.');
  return runVerifiedRearPairRoadV1({
    startInput:input.startInput,
    staggered:input.staggered,contact,
    contactRoad:input.secondContactRoad,
    throughKm:input.throughKm,
    version:PHYSICAL_SECOND_REAR_PAIR_VERSION});
}

export function validatePhysicalSecondRearPairV1(input,
  recording){
  if(!isDeepStrictEqual(recording,
    runPhysicalSecondRearPairV1(input)))
    throw new Error('Second rear pair differs from paid source.');
  return true;
}
