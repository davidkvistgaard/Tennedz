// After one paid solo joins the bunch, settle the first remaining
// rear-road meeting from its measured clock and per-rider energy.
import {isDeepStrictEqual} from 'node:util';
import {finishPhysicalOrderedRearContinuationBunchJoinV1} from
  './physical-ordered-rear-continuation-bunch-join-v1.mjs';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';

export const PHYSICAL_ORDERED_REAR_BUNCH_THEN_REAR_CONTACT_VERSION=
  'v2-physical-ordered-rear-bunch-then-rear-contact-1';
const EPS=1e-5;

export function resolvePhysicalOrderedRearBunchThenRearContactV1({
  startInput,prior}){
  const joined=
    finishPhysicalOrderedRearContinuationBunchJoinV1({
      startInput,prior});
  const {tracks,bunch,next}=sourcePhysicalOrderedRearBoundaryFromStateV1({
    startInput,prior});
  const joinedSoloId=`solo-${joined.joinDecision.riderId}`;
  const remaining=tracks.filter(track=>
    track.id!==joinedSoloId);
  const events=findPhysicalOrderedBoundaryEventsV1(
    remaining,bunch,next.sourceKm);
  const event=events[0];
  if(!event||event.involvesBunch||
    event.roadIds.length!==2||
    event.metresIntoKm<=0||
    event.metresIntoKm>=1000||
    event.clockSeconds<=
      joined.contactClockSeconds+EPS)
    throw new Error(
      'Post-join rear contact needs later paid roads.');
  const roads=event.roadIds.map(id=>
    remaining.find(track=>track.id===id));
  if(roads.some(road=>!road)||
    !event.catchingRoadId||
    !roads.some(road=>road.id===
      event.catchingRoadId))
    throw new Error(
      'Post-join rear contact lacks catching road.');
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
          'Post-join rear contact breaks paid approach.');
      return {riderId:row.riderId,
        roadId:road.id,role:row.role,
        decision:row.decision,
        energyBefore:row.energyBefore,
        energyAtContact,
        clockAtContact:event.clockSeconds};
    }));
  if(choice.outcome!=='join')
    return {version:
      PHYSICAL_ORDERED_REAR_BUNCH_THEN_REAR_CONTACT_VERSION,
    sourceKm:next.sourceKm,
    sources:{joined},event,choice,
    paidApproaches,membershipChanged:false,
    laterRoadUnsettled:true,
    movesGuidedRace:false,officialResults:false};
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
      'Post-join rear contact needs one paid leader.');
  const otherRoads=remaining.filter(track=>
    !event.roadIds.includes(track.id));
  const laterEvents=findPhysicalOrderedBoundaryEventsV1(
    [...otherRoads,{...groupTrack,id:groupId,
      kind:'group',domainEndM:1000}],
    bunch,next.sourceKm);
  return {version:
    PHYSICAL_ORDERED_REAR_BUNCH_THEN_REAR_CONTACT_VERSION,
  sourceKm:next.sourceKm,
  sources:{joined},event,
  choice:joinedChoice,paidApproaches,
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
  movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalOrderedRearBunchThenRearContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalOrderedRearBunchThenRearContactV1(
      input)))
    throw new Error(
      'Post-join rear contact differs from paid source.');
  return true;
}
