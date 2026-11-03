// Settle only the first measured contact after a recorded full-field
// kilometre. Later same-km paths must be compared after repricing.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_CONTINUATION_CONTACT_VERSION=
  'v2-physical-ordered-rear-continuation-contact-1';
const EPS=1e-5;

export function resolvePhysicalOrderedRearContinuationContactV1({
  startInput,prior}){
  const {recording:boundary,tracks,bunch,next}=
    sourcePhysicalOrderedRearBoundaryFromStateV1({
      startInput,prior});
  const event=boundary.firstEvent;
  if(!event||event.involvesBunch||
    event.roadIds.length!==2||
    event.metresIntoKm<=0||
    event.metresIntoKm>=1000)
    throw new Error(
      'Rear continuation needs measured rear contact.');
  const roads=event.roadIds.map(id=>
    tracks.find(track=>track.id===id));
  if(roads.some(road=>!road)||
    !event.catchingRoadId||
    !roads.some(road=>
      road.id===event.catchingRoadId))
    throw new Error(
      'Rear continuation lacks catching road.');
  const leaderRiderId=roads.find(road=>
    road.id===event.catchingRoadId)
    .leaderRiderId;
  const choiceInput={startInput,km:next.sourceKm,
    roadIds:event.roadIds,
    riderIdsByRoad:event.riderIdsByRoad,
    catchingRoadId:event.catchingRoadId,
    observedSecondsPerKmByRoad:
      event.observedSecondsPerKmByRoad,
    leaderRiderId};
  const choice=decidePhysicalRearContactV1(
    choiceInput);
  const paidApproaches=roads.flatMap(road=>
    road.rows.map(row=>{
      const atContact=road.energyAt(
        event.metresIntoKm);
      const energyAtContact=Array.isArray(
        atContact)?atContact.find(item=>
          item.riderId===row.riderId)
          ?.energyAtContact:atContact;
      if(!Number.isFinite(energyAtContact)||
        Math.abs(energyAtContact-
          event.riders.find(item=>
            item.riderId===row.riderId)
            .energyAtContact)>EPS||
        Math.abs(road.clockAt(
          event.metresIntoKm)-
          event.clockSeconds)>EPS)
        throw new Error(
          'Rear continuation breaks paid approach.');
      return {riderId:row.riderId,
        roadId:road.id,role:row.role,
        decision:row.decision,
        energyBefore:row.energyBefore,
        energyAtContact,
        clockAtContact:event.clockSeconds};
    }));
  if(choice.outcome!=='join')
    return {version:
      PHYSICAL_ORDERED_REAR_CONTINUATION_CONTACT_VERSION,
    sourceKm:next.sourceKm,
    sources:{boundary},event,
    choice,paidApproaches,
    membershipChanged:false,
    laterRoadUnsettled:true,
    movesGuidedRace:false,
    officialResults:false};
  const riderIds=event.roadIds.flatMap(id=>
    event.riderIdsByRoad[id]);
  const groupId=`rear-event-${
    [...riderIds].sort().join('-')}`;
  const energyByRider=Object.fromEntries(
    event.riders.map(row=>[
      row.riderId,row.energyAtContact]));
  const groupTrack=pricePhysicalRearEventTrackV1({
    startInput,riderIds,energyByRider,
    km:next.sourceKm,
    startM:event.metresIntoKm,
    startClock:event.clockSeconds,
    contactLeaderRiderId:leaderRiderId,
    groupId});
  const joinedChoice=decidePhysicalRearContactV1({
    ...choiceInput,
    leaderRiderId:groupTrack.leaderRiderId});
  if(joinedChoice.outcome!=='join'||
    groupTrack.rows.filter(row=>
      row.role==='leader').length!==1||
    groupTrack.rows.some(row=>
      row.role==='sheltered'&&
        row.draftFraction>=1))
    throw new Error(
      'Rear continuation needs one paid leader.');
  const remaining=tracks.filter(track=>
    !event.roadIds.includes(track.id));
  const candidateGroupRoad={...groupTrack,
    id:groupId,kind:'group',
    domainEndM:1000};
  const laterEvents=findPhysicalOrderedBoundaryEventsV1(
    [...remaining,candidateGroupRoad],bunch,
    next.sourceKm);
  return {version:
    PHYSICAL_ORDERED_REAR_CONTINUATION_CONTACT_VERSION,
  sourceKm:next.sourceKm,
  sources:{boundary},event,
  choice:joinedChoice,
  paidApproaches,
  candidateGroupRoad:{id:groupId,
    riderIds,leaderRiderId:
      groupTrack.leaderRiderId,
    startClock:groupTrack.startClock,
    endClock:groupTrack.endClock,
    riders:groupTrack.rows},
  physicalGroup:{id:groupId,riderIds,
    atDistanceM:event.atDistanceM},
  nextCandidateEvent:laterEvents[0]??null,
  membershipChanged:true,
  laterRoadUnsettled:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearContinuationContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalOrderedRearContinuationContactV1(
      input)))
    throw new Error(
      'Rear continuation contact differs from paid source.');
  return true;
}
