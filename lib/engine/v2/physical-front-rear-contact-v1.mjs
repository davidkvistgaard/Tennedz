// Resolve a measured rear-to-rear contact while the front rider remains
// on a separately paid road. This only prices the first contact; a
// later same-kilometre event still requires an ordered continuation.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {resolvePhysicalOrderedRearContinuationContactV1} from
  './physical-ordered-rear-continuation-contact-v1.mjs';

export const PHYSICAL_FRONT_REAR_CONTACT_VERSION=
  'v2-physical-front-rear-contact-1';

export function resolvePhysicalFrontRearContactV1({
  startInput,prior}){
  const {recording:boundary}=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const event=boundary.firstCandidateEvent;
  const rearRoadIds=new Set(prior.endRearEntities
    .map(entity=>entity.id));
  if(!boundary.fieldKilometreIncomplete||
    !event||event.involvesBunch||
    event.roadIds.length!==2||
    !event.roadIds.every(id=>rearRoadIds.has(id))||
    !event.catchingRoadId||
    !rearRoadIds.has(event.catchingRoadId))
    throw new Error(
      'Front-rear contact needs measured rear approach.');
  const contact=
    resolvePhysicalOrderedRearContinuationContactV1({
      startInput,prior,
      boundarySource:
        sourcePhysicalFrontRearBoundaryFromStateV1});
  if(!isDeepStrictEqual(contact.event,event)||
    !isDeepStrictEqual(contact.sources.boundary,
      boundary))
    throw new Error(
      'Front-rear contact differs from source boundary.');
  return {...contact,
    version:PHYSICAL_FRONT_REAR_CONTACT_VERSION,
    frontRiderId:prior.endFrontState.riderId};
}

export function validatePhysicalFrontRearContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalFrontRearContactV1(input)))
    throw new Error(
      'Front-rear contact differs from paid source.');
  return true;
}
