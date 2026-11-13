// Reprice the first paid rear join before resolving the next measured
// contact in that same kilometre. The front and bunch roads remain in
// the source comparison and no field finish is claimed here.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {resolvePhysicalFrontRearContactV1} from
  './physical-front-rear-contact-v1.mjs';
import {resolvePhysicalOrderedRearContinuationContactV1} from
  './physical-ordered-rear-continuation-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_SECOND_CONTACT_VERSION=
  'v2-physical-front-rear-second-contact-1';

export function sourcePhysicalFrontRearSecondBoundaryV1({
  startInput,prior}){
  const first=resolvePhysicalFrontRearContactV1({
    startInput,prior});
  if(first.choice.outcome!=='join'||
    !first.membershipChanged||
    !first.nextCandidateEvent)
    throw new Error(
      'Second front-rear contact needs first paid join.');
  const source=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  if(!isDeepStrictEqual(source.recording
    .firstCandidateEvent,first.event))
    throw new Error(
      'Second front-rear contact breaks first boundary.');
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
      'Second front-rear contact breaks paid group.');
  const tracks=source.tracks.filter(track=>
    !first.event.roadIds.includes(track.id));
  tracks.push({...groupTrack,id:group.id,
    kind:'group',domainEndM:1000});
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,source.bunch,first.sourceKm);
  if(!isDeepStrictEqual(events[0]??null,
    first.nextCandidateEvent))
    throw new Error(
      'Second front-rear contact differs from repricing.');
  const recording={version:
    PHYSICAL_FRONT_REAR_SECOND_CONTACT_VERSION,
    sourceKm:first.sourceKm,
    sources:{firstContact:first},
    firstCandidateEvent:events[0]??null,
    candidateEventCount:events.length,
    fieldKilometreIncomplete:true,
    movesGuidedRace:false,
    officialResults:false};
  return {recording,tracks,
    bunch:source.bunch,next:{sourceKm:first.sourceKm}};
}

export function resolvePhysicalFrontRearSecondContactV1({
  startInput,prior}){
  const {recording:boundary}=
    sourcePhysicalFrontRearSecondBoundaryV1({
      startInput,prior});
  const event=boundary.firstCandidateEvent;
  const first=boundary.sources.firstContact;
  const rearRoadIds=new Set([
    ...prior.endRearEntities.map(entity=>entity.id),
    first.candidateGroupRoad.id]);
  if(!event||event.involvesBunch||
    event.roadIds.length!==2||
    !event.roadIds.every(id=>rearRoadIds.has(id))||
    !event.roadIds.includes(
      first.candidateGroupRoad.id)||
    !event.catchingRoadId)
    throw new Error(
      'Second front-rear contact needs measured rear approach.');
  const contact=
    resolvePhysicalOrderedRearContinuationContactV1({
      startInput,prior,
      boundarySource:
        sourcePhysicalFrontRearSecondBoundaryV1});
  if(!isDeepStrictEqual(contact.event,event)||
    !isDeepStrictEqual(contact.sources.boundary,
      boundary))
    throw new Error(
      'Second front-rear contact breaks paid boundary.');
  return {...contact,version:
    PHYSICAL_FRONT_REAR_SECOND_CONTACT_VERSION,
    firstContact:first,
    frontRiderId:prior.endFrontState.riderId};
}

export function validatePhysicalFrontRearSecondContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalFrontRearSecondContactV1(input)))
    throw new Error(
      'Second front-rear contact differs from paid source.');
  return true;
}
