// Finish the paid rear pair formed after an early caught break and a
// later follower loss. This path remains opt-in and non-official.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalEarlyCaughtFollowerLossV1} from
  './physical-early-caught-follower-loss-v1.mjs';
import {continuePhysicalPostcatchGroupV1} from
  './physical-manager-postcatch-group-v1.mjs';

export const PHYSICAL_EARLY_CAUGHT_GROUP_VERSION=
  'v2-physical-early-caught-group-1';

export function replayPhysicalEarlyCaughtGroupV1({
  startInput,start,attackKm,catchKm,lossKm,
  throughKm}){
  const contact=replayPhysicalEarlyCaughtFollowerLossV1({
    startInput,start,attackKm,catchKm,lossKm});
  if(!contact.sources.contact||
    !contact.sources.groupRoad)
    throw new Error('Early caught group needs paid rear meeting.');
  return continuePhysicalPostcatchGroupV1({
    contact,startInput,throughKm,
    loss:contact.sources.loss,
    groupRoad:contact.sources.groupRoad,
    caughtRiderId:contact.sources.contact.frontRiderId,
    version:PHYSICAL_EARLY_CAUGHT_GROUP_VERSION});
}

export function validatePhysicalEarlyCaughtGroupV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalEarlyCaughtGroupV1(input)))
    throw new Error('Early caught group differs from paid source.');
  return true;
}
