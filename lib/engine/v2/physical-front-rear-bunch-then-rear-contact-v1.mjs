// After one paid solo joins the bunch, measure the next rear-to-rear
// contact without moving the front rider or completing the kilometre.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {replayPhysicalFrontRearSoloBunchKmV1} from
  './physical-front-rear-solo-bunch-km-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {resolvePhysicalOrderedRearContinuationContactV1} from
  './physical-ordered-rear-continuation-contact-v1.mjs';

export const PHYSICAL_FRONT_REAR_BUNCH_THEN_REAR_CONTACT_VERSION=
  'v2-physical-front-rear-bunch-then-rear-contact-1';

export function sourcePhysicalFrontRearBunchThenRearBoundaryV1({
  startInput,prior}){
  const joined=replayPhysicalFrontRearSoloBunchKmV1({
    startInput,prior});
  if(!joined.fieldKilometreIncomplete||
    !joined.firstUnresolvedEvent||
    !joined.sources.paidJoin)
    throw new Error(
      'Post-bunch rear boundary needs paid solo join.');
  const source=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const joinedSoloId=`solo-${joined.sources
    .paidJoin.riderId}`;
  const tracks=source.tracks.filter(track=>
    track.id!==joinedSoloId);
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,source.bunch,joined.sourceKm);
  if(!isDeepStrictEqual(events[0]??null,
    joined.firstUnresolvedEvent))
    throw new Error(
      'Post-bunch rear boundary differs from paid paths.');
  return {recording:{version:
    PHYSICAL_FRONT_REAR_BUNCH_THEN_REAR_CONTACT_VERSION,
    sourceKm:joined.sourceKm,
    sources:{joined},
    firstCandidateEvent:events[0]??null,
    candidateEventCount:events.length,
    fieldKilometreIncomplete:true,
    movesGuidedRace:false,
    officialResults:false},
  tracks,bunch:source.bunch,
  next:{sourceKm:joined.sourceKm}};
}

export function resolvePhysicalFrontRearBunchThenRearContactV1({
  startInput,prior}){
  const {recording:boundary}=
    sourcePhysicalFrontRearBunchThenRearBoundaryV1({
      startInput,prior});
  const event=boundary.firstCandidateEvent;
  const rearIds=new Set(prior.endRearEntities
    .map(entity=>entity.id));
  if(!event||event.involvesBunch||
    event.roadIds.length!==2||
    !event.roadIds.every(id=>rearIds.has(id))||
    !event.catchingRoadId||
    event.clockSeconds<=boundary.sources
      .joined.sources.contact
      .clockSeconds)
    throw new Error(
      'Post-bunch rear contact needs later measured catch.');
  const contact=
    resolvePhysicalOrderedRearContinuationContactV1({
      startInput,prior,
      boundarySource:
        sourcePhysicalFrontRearBunchThenRearBoundaryV1});
  if(!isDeepStrictEqual(contact.sources.boundary,
    boundary)||
    !isDeepStrictEqual(contact.event,event))
    throw new Error(
      'Post-bunch rear contact breaks paid boundary.');
  return {...contact,version:
    PHYSICAL_FRONT_REAR_BUNCH_THEN_REAR_CONTACT_VERSION,
    joinedSoloRiderId:boundary.sources
      .joined.sources.paidJoin.riderId,
    frontRiderId:prior.endFrontState.riderId};
}

export function validatePhysicalFrontRearBunchThenRearContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalFrontRearBunchThenRearContactV1(
      input)))
    throw new Error(
      'Post-bunch rear contact differs from paid source.');
  return true;
}
