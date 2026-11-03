// Reprice the first rear join after a solo bunch catch, then settle
// the next measured rear meeting in the same kilometre.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBunchThenRearBoundaryV1,
  resolvePhysicalFrontRearBunchThenRearContactV1} from
  './physical-front-rear-bunch-then-rear-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {resolvePhysicalOrderedRearContinuationContactV1} from
  './physical-ordered-rear-continuation-contact-v1.mjs';

export const PHYSICAL_FRONT_REAR_BUNCH_SECOND_CONTACT_VERSION=
  'v2-physical-front-rear-bunch-second-contact-1';

export function sourcePhysicalFrontRearBunchSecondBoundaryV1({
  startInput,prior}){
  const first=
    resolvePhysicalFrontRearBunchThenRearContactV1({
      startInput,prior});
  if(first.choice.outcome!=='join'||
    !first.membershipChanged||
    !first.nextCandidateEvent)
    throw new Error(
      'Post-bunch second contact needs first rear join.');
  const source=
    sourcePhysicalFrontRearBunchThenRearBoundaryV1({
      startInput,prior});
  const group=first.candidateGroupRoad;
  const groupTrack=pricePhysicalRearEventTrackV1({
    startInput,riderIds:group.riderIds,
    energyByRider:Object.fromEntries(
      first.event.riders.map(row=>[
        row.riderId,row.energyAtContact])),
    km:first.sourceKm,
    startM:first.event.metresIntoKm,
    startClock:first.event.clockSeconds,
    contactLeaderRiderId:group.leaderRiderId,
    groupId:group.id});
  if(!isDeepStrictEqual(groupTrack.rows,
    group.riders))
    throw new Error(
      'Post-bunch second contact breaks group price.');
  const tracks=source.tracks.filter(track=>
    !first.event.roadIds.includes(track.id));
  tracks.push({...groupTrack,id:group.id,
    kind:'group',domainEndM:1000});
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,source.bunch,first.sourceKm);
  if(!isDeepStrictEqual(events[0]??null,
    first.nextCandidateEvent))
    throw new Error(
      'Post-bunch second contact breaks road order.');
  return {recording:{version:
    PHYSICAL_FRONT_REAR_BUNCH_SECOND_CONTACT_VERSION,
    sourceKm:first.sourceKm,
    sources:{firstContact:first},
    firstCandidateEvent:events[0]??null,
    candidateEventCount:events.length,
    fieldKilometreIncomplete:true,
    movesGuidedRace:false,
    officialResults:false},
  tracks,bunch:source.bunch,
  next:{sourceKm:first.sourceKm}};
}

export function resolvePhysicalFrontRearBunchSecondContactV1({
  startInput,prior}){
  const {recording:boundary}=
    sourcePhysicalFrontRearBunchSecondBoundaryV1({
      startInput,prior});
  const event=boundary.firstCandidateEvent;
  const first=boundary.sources.firstContact;
  if(!event||event.involvesBunch||
    event.roadIds.length!==2||
    !event.roadIds.includes(first
      .candidateGroupRoad.id)||
    !event.catchingRoadId||
    event.clockSeconds<=first.event
      .clockSeconds)
    throw new Error(
      'Post-bunch second contact needs later rear catch.');
  const contact=
    resolvePhysicalOrderedRearContinuationContactV1({
      startInput,prior,
      boundarySource:
        sourcePhysicalFrontRearBunchSecondBoundaryV1});
  if(!isDeepStrictEqual(contact.sources.boundary,
    boundary)||
    !isDeepStrictEqual(contact.event,event))
    throw new Error(
      'Post-bunch second contact breaks paid boundary.');
  return {...contact,version:
    PHYSICAL_FRONT_REAR_BUNCH_SECOND_CONTACT_VERSION,
    firstContact:first,
    joinedSoloRiderId:first.joinedSoloRiderId,
    frontRiderId:prior.endFrontState.riderId};
}

export function validatePhysicalFrontRearBunchSecondContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalFrontRearBunchSecondContactV1(
      input)))
    throw new Error(
      'Post-bunch second contact differs from paid source.');
  return true;
}
