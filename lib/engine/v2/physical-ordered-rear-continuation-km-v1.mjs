// Complete one rear-contact kilometre from a verified full-field
// source, with every approach and the new group road paid in order.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {resolvePhysicalOrderedRearContinuationContactV1} from
  './physical-ordered-rear-continuation-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ORDERED_REAR_CONTINUATION_KM_VERSION=
  'v2-physical-ordered-rear-continuation-km-1';
const EPS=.002;

export function replayPhysicalOrderedRearContinuationKmV1({
  startInput,prior}){
  const {recording:boundary,tracks,bunch,next}=
    sourcePhysicalOrderedRearBoundaryFromStateV1({
      startInput,prior});
  const contact=
    resolvePhysicalOrderedRearContinuationContactV1({
      startInput,prior});
  if(contact.choice.outcome!=='join'||
    !contact.membershipChanged||
    contact.nextCandidateEvent||
    !isDeepStrictEqual(contact.event,
      boundary.firstEvent))
    throw new Error(
      'Rear continuation km needs settled first join.');
  const km=next.sourceKm;
  const event=contact.event;
  const removed=new Set(event.roadIds);
  const remaining=tracks.filter(track=>
    !removed.has(track.id));
  const group=contact.candidateGroupRoad;
  const groupTrack=pricePhysicalRearEventTrackV1({
    startInput,riderIds:group.riderIds,
    energyByRider:Object.fromEntries(
      event.riders.map(row=>[
        row.riderId,row.energyAtContact])),
    km,startM:event.metresIntoKm,
    startClock:event.clockSeconds,
    contactLeaderRiderId:
      group.leaderRiderId,
    groupId:group.id});
  if(!isDeepStrictEqual(groupTrack.rows,
    group.riders)||
    findPhysicalOrderedBoundaryEventsV1(
      [...remaining,{...groupTrack,
        id:group.id,kind:'group',
        domainEndM:1000}],bunch,km).length)
    throw new Error(
      'Rear continuation km has later contact.');
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const contactDecisions=new Map(contact.choice
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const paidApproaches=new Map(contact
    .paidApproaches.map(row=>[
      row.riderId,row]));
  const rearStates=[];
  const endRearEntities=[];
  for(const track of remaining){
    const old=oldEntities.get(track.id);
    if(!old||!isDeepStrictEqual(
      old.riderIds,track.riderIds)||
      Math.abs(old.clock-track.startClock)>EPS)
      throw new Error(
        'Rear continuation km lacks prior road.');
    for(const row of track.rows){
      if(Math.abs(row.energyBefore-
        old.energyByRider[row.riderId])>EPS)
        throw new Error(
          'Rear continuation km breaks energy.');
      rearStates.push({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:row.energyAfter,
        decisions:[row.decision]});
    }
    if(track.kind==='group'&&(
      track.rows.filter(row=>
        row.role==='leader').length!==1||
      track.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1)))
      throw new Error(
        'Rear continuation km lacks one leader.');
    endRearEntities.push({id:track.id,
      kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider:Object.fromEntries(
        track.rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:(old.rotationIndex+1)%
          track.riderIds.length,
        formedKm:old.formedKm}:{})});
  }
  for(const row of groupTrack.rows){
    const approach=paidApproaches.get(row.riderId);
    const choice=contactDecisions.get(row.riderId);
    const old=prior.riderStates.find(state=>
      state.riderId===row.riderId);
    if(!approach||!choice||!old||
      Math.abs(approach.energyBefore-
        old.energyAfter)>EPS||
      Math.abs(approach.energyAtContact-
        row.energyBefore)>EPS)
      throw new Error(
        'Rear continuation km lacks paid approach.');
    rearStates.push({riderId:row.riderId,
      sourceKm:km,
      physicalGroupId:group.id,
      atDistanceM:km*1000,
      elapsedSeconds:groupTrack.endClock,
      energyAfter:row.energyAfter,
      decisions:[approach.decision,
        choice,row.decision]});
  }
  endRearEntities.push({id:group.id,
    kind:'group',
    riderIds:[...group.riderIds],
    atDistanceM:km*1000,
    clock:groupTrack.endClock,
    energyByRider:Object.fromEntries(
      groupTrack.rows.map(row=>[
        row.riderId,row.energyAfter])),
    rotationIndex:0,formedKm:km});
  const bunchClock=next.bunchStartClock+
    next.step.elapsedSeconds;
  const bunchDecisions=new Map(next.step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=next.step.physicalGroup
    .riderIds.map(riderId=>{
      const decision=bunchDecisions.get(riderId);
      const energyAfter=next.step
        .energyByRider[riderId];
      if(!decision||
        !Number.isFinite(energyAfter))
        throw new Error(
          'Rear continuation km lacks bunch rider.');
      return {riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchClock,
        energyAfter,
        decisions:[decision]};
    });
  const byId=new Map([...bunchStates,
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(byId.size!==prior.riderCount||
    bunchStates.length+rearStates.length!==
      prior.riderCount||
    prior.riderStates.some(row=>
      !byId.has(row.riderId)))
    throw new Error(
      'Rear continuation km lacks full field.');
  return {version:
    PHYSICAL_ORDERED_REAR_CONTINUATION_KM_VERSION,
  sourceKm:km,
  sources:{boundary,contact,
    bunchStep:next.step},
  riderStates:prior.riderStates.map(row=>
    byId.get(row.riderId)),
  endBunchState:{
    riderIds:[...next.step.physicalGroup
      .riderIds],
    energyByRider:next.step.energyByRider,
    quietKmByRider:next.step.quietKmByRider},
  endRearEntities,
  riderCount:byId.size,
  physicalGroups:[next.step.physicalGroup,
    ...endRearEntities.map(entity=>({
      id:entity.id,
      riderIds:entity.riderIds,
      atDistanceM:km*1000}))],
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearContinuationKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalOrderedRearContinuationKmV1(
      input)))
    throw new Error(
      'Rear continuation km differs from paid source.');
  return true;
}
