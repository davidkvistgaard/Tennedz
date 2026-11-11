// Resolve only the first source-ordered rear contact. The following
// road stays a candidate until every remaining meeting is settled.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearBoundaryRoadsV1,
  findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';

export const PHYSICAL_ORDERED_REAR_FIRST_CONTACT_VERSION=
  'v2-physical-ordered-rear-first-contact-1';

export function resolvePhysicalOrderedRearFirstContactV1(
  input){
  const {recording:boundary,tracks,bunch}=
    sourcePhysicalOrderedRearBoundaryRoadsV1(input);
  const event=boundary.firstEvent;
  if(!event||event.involvesBunch||
    event.roadIds.length!==2||
    event.roadIds.some(id=>
      !boundary.activeRoads.some(row=>
        row.id===id&&row.kind==='solo'&&
        row.domainStartM===0))||
    event.riders.length!==2)
    throw new Error(
      'Ordered first contact needs two paid rear solos.');
  const {startInput,throughKm:km}=input;
  const priorById=new Map(boundary.prior
    .endEntities.map(row=>[row.id,row]));
  const riderIds=event.roadIds.map(id=>{
    const entity=priorById.get(id);
    if(!entity||entity.kind!=='solo'||
      entity.riderIds.length!==1)
      throw new Error(
        'Ordered contact needs prior paid solo state.');
    return entity.riderIds[0];
  });
  const leaderRiderId=priorById.get(
    event.catchingRoadId)?.riderIds[0];
  if(!leaderRiderId||
    !riderIds.includes(leaderRiderId))
    throw new Error('Ordered contact needs catching road.');
  const choice=decidePhysicalRearContactV1({
    startInput,km,
    roadIds:event.roadIds,
    riderIdsByRoad:event.riderIdsByRoad,
    catchingRoadId:event.catchingRoadId,
    observedSecondsPerKmByRoad:
      event.observedSecondsPerKmByRoad,
    leaderRiderId});
  const paidApproaches=riderIds.map((riderId,
    index)=>{
    const roadId=event.roadIds[index];
    const prior=priorById.get(roadId);
    const contact=event.riders.find(row=>
      row.riderId===riderId);
    const team=startInput.teams.find(row=>
      row.riders.some(rider=>
        rider.id===riderId));
    const rider=team.riders.find(row=>
      row.id===riderId);
    const intent=physicalRearIntentAtKmV2({
      startInput,riderId,km});
    const energyBefore=prior
      .energyByRider[riderId];
    const paid=priceRearEnergyDemandV1({
      rider,
      segment:startInput.routeKilometres[km-1],
      energyBefore,effort:intent.effort,
      role:'solo',
      distanceM:event.metresIntoKm});
    if(!contact||
      event.clockSeconds<=prior.clock||
      Math.abs(paid.energyAfter-
        contact.energyAtContact)>.002)
      throw new Error(
        'Ordered contact approach differs from paid road.');
    return {riderId,roadId,
      startDistanceM:(km-1)*1000,
      endDistanceM:event.atDistanceM,
      startClock:prior.clock,
      endClock:event.clockSeconds,
      energyBefore,
      energySpent:paid.energyDemand,
      energyAtContact:
        contact.energyAtContact,
      decision:{riderId,goal:intent.action,
        effort:intent.effort,
        teamOrderEffort:
          intent.teamOrderEffort,
        committedTeamStake:
          intent.committedTeamStake,
        choice:'ride_to_rear_contact'}};
  });
  if(choice.outcome==='pass_through')
    return {version:
      PHYSICAL_ORDERED_REAR_FIRST_CONTACT_VERSION,
    sourceKm:km,sources:{boundary},
    contact:{...event,outcome:'pass_through',
      riderDecisions:choice.riderDecisions,
      physicalGroupsRemaining:[
        ...event.roadIds]},
    paidApproaches,
    eventChangesMembership:false,
    laterRoadUnsettled:true,
    movesGuidedRace:false,
    officialResults:false};
  const groupId=`rear-event-${[
    ...riderIds].sort().join('-')}`;
  const energyByRider=Object.fromEntries(
    event.riders.map(row=>[
      row.riderId,row.energyAtContact]));
  const candidate=pricePhysicalRearEventTrackV1({
    startInput,riderIds,energyByRider,km,
    startM:event.metresIntoKm,
    startClock:event.clockSeconds,
    contactLeaderRiderId:leaderRiderId,
    groupId});
  const joinedChoice=decidePhysicalRearContactV1({
    startInput,km,
    roadIds:event.roadIds,
    riderIdsByRoad:event.riderIdsByRoad,
    catchingRoadId:event.catchingRoadId,
    observedSecondsPerKmByRoad:
      event.observedSecondsPerKmByRoad,
    leaderRiderId:candidate.leaderRiderId});
  if(joinedChoice.outcome!=='join'||
    candidate.rows.filter(row=>
      row.role==='leader').length!==1||
    candidate.rows.some(row=>
      row.role==='sheltered'&&
      row.draftFraction>=1))
    throw new Error(
      'Ordered contact lacks paid group leader.');
  const nextTracks=tracks.filter(track=>
    !event.roadIds.includes(track.id));
  nextTracks.push({...candidate,id:groupId,
    kind:'group',domainEndM:1000});
  const nextCandidates=
    findPhysicalOrderedBoundaryEventsV1(
      nextTracks,bunch,km);
  if(nextCandidates.some(row=>
    row.clockSeconds<event.clockSeconds-1e-6))
    throw new Error(
      'Ordered contact changed an earlier paid event.');
  return {version:
    PHYSICAL_ORDERED_REAR_FIRST_CONTACT_VERSION,
  sourceKm:km,sources:{boundary},
  contact:{...event,outcome:'join',
    leaderRiderId:candidate.leaderRiderId,
    physicalGroup:{id:groupId,
      riderIds:[...riderIds],
      atDistanceM:event.atDistanceM},
    riderDecisions:
      joinedChoice.riderDecisions},
  paidApproaches,
  candidateGroupRoad:{
    groupId,riderIds:[...riderIds],
    leaderRiderId:candidate.leaderRiderId,
    startDistanceM:event.atDistanceM,
    candidateEndDistanceM:km*1000,
    startClock:event.clockSeconds,
    candidateEndClock:candidate.endClock,
    secondsPerKm:candidate.secondsPerKm,
    rows:candidate.rows},
  nextCandidateEvent:nextCandidates[0]??null,
  nextCandidateEventCount:
    nextCandidates.length,
  eventChangesMembership:true,
  laterRoadUnsettled:true,
  movesGuidedRace:false,
  officialResults:false};
}

export function validatePhysicalOrderedRearFirstContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    resolvePhysicalOrderedRearFirstContactV1(input)))
    throw new Error(
      'Ordered first contact differs from paid source.');
  return true;
}
