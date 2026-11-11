// Measure the rear group's bunch crossing from its paid formation road.
// Membership and the remaining field kilometre stay unsettled here.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {replayPhysicalFrontRearJoinedKmV1} from
  './physical-front-rear-joined-km-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {measurePhysicalOrderedRearGroupBunchV1} from
  './physical-ordered-rear-group-bunch-v1.mjs';

export const PHYSICAL_FRONT_REAR_GROUP_BUNCH_CONTACT_VERSION=
  'v2-physical-front-rear-group-bunch-contact-1';

export function probePhysicalFrontRearGroupBunchContactV1({
  startInput,prior}){
  const joined=replayPhysicalFrontRearJoinedKmV1({
    startInput,prior});
  const event=joined.firstUnresolvedEvent;
  const formation=joined.sources.contacts.at(-1);
  if(!joined.fieldKilometreIncomplete||
    !event?.involvesBunch||
    !formation||formation.choice.outcome!==
      'join'||
    !event.roadIds.includes(
      formation.groupRoad.id))
    throw new Error(
      'Front-rear group probe needs paid formation.');
  const source=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const group=formation.groupRoad;
  const groupTrack=pricePhysicalRearEventTrackV1({
    startInput,riderIds:group.riderIds,
    energyByRider:Object.fromEntries(
      formation.event.riders.map(row=>[
        row.riderId,row.energyAtContact])),
    km:joined.sourceKm,
    startM:formation.event.metresIntoKm,
    startClock:formation.event.clockSeconds,
    contactLeaderRiderId:
      group.leaderRiderId,
    groupId:group.id});
  if(!isDeepStrictEqual(groupTrack.rows,
    group.rows))
    throw new Error(
      'Front-rear group probe breaks paid group.');
  const bunchStartClock=prior.riderStates.find(
    row=>row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  const next={sourceKm:joined.sourceKm,
    step:source.step,bunchStartClock};
  const contact=
    measurePhysicalOrderedRearGroupBunchV1({
      startInput,next,event,
      group:{...groupTrack,
        id:group.id,kind:'group'}});
  return {version:
    PHYSICAL_FRONT_REAR_GROUP_BUNCH_CONTACT_VERSION,
    sourceKm:joined.sourceKm,
    sources:{joined},contact,
    fieldKilometreIncomplete:true,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontRearGroupBunchContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalFrontRearGroupBunchContactV1(input)))
    throw new Error(
      'Front-rear group probe differs from paid source.');
  return true;
}
