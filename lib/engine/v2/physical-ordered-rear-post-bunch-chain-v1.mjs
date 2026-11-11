// Reprice every rear-road meeting after a paid bunch join, in clock
// order. Each joined road replaces its source roads before searching
// again. A bunch meeting remains an explicit unsettled boundary.
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

export const PHYSICAL_ORDERED_REAR_POST_BUNCH_CHAIN_VERSION=
  'v2-physical-ordered-rear-post-bunch-chain-1';
const EPS=1e-5;

export function sourcePhysicalOrderedRearPostBunchChainV1({
  startInput,prior}){
  const joined=
    finishPhysicalOrderedRearContinuationBunchJoinV1({
      startInput,prior});
  const source=sourcePhysicalOrderedRearBoundaryFromStateV1({
    startInput,prior});
  const {bunch,next}=source;
  const joinedSoloId=`solo-${joined.joinDecision.riderId}`;
  let tracks=source.tracks.filter(track=>
    track.id!==joinedSoloId);
  if(tracks.length!==source.tracks.length-1)
    throw new Error(
      'Post-bunch chain lacks removed solo road.');
  const contacts=[];
  const passedPairs=new Set();
  let lastClock=joined.contactClockSeconds;
  let firstUnsettledEvent=null;
  for(let index=0;index<prior.riderCount;index++){
    const event=findPhysicalOrderedBoundaryEventsV1(
      tracks,bunch,next.sourceKm).find(row=>
        !passedPairs.has(row.roadIds.join('|')));
    if(!event)break;
    if(event.clockSeconds<=lastClock+EPS||
      event.metresIntoKm<=0||
      event.metresIntoKm>=1000)
      throw new Error(
        'Post-bunch chain breaks event order.');
    if(event.involvesBunch){
      firstUnsettledEvent=event;
      break;
    }
    const roads=event.roadIds.map(id=>
      tracks.find(track=>track.id===id));
    if(roads.some(road=>!road)||
      !event.catchingRoadId||
      !roads.some(road=>road.id===
        event.catchingRoadId))
      throw new Error(
        'Post-bunch chain lacks paid catching road.');
    const leaderRiderId=roads.find(road=>
      road.id===event.catchingRoadId)
      .leaderRiderId;
    const choiceInput={startInput,
      km:next.sourceKm,
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
            'Post-bunch chain breaks paid approach.');
        return {riderId:row.riderId,
          roadId:road.id,role:row.role,
          decision:row.decision,
          energyBefore:row.energyBefore,
          energyAtContact,
          clockAtContact:event.clockSeconds};
      }));
    if(choice.outcome!=='join'){
      contacts.push({event,choice,
        paidApproaches,
        membershipChanged:false});
      passedPairs.add(event.roadIds.join('|'));
      lastClock=event.clockSeconds;
      continue;
    }
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
        'Post-bunch chain needs one paid leader.');
    contacts.push({event,choice:joinedChoice,
      paidApproaches,
      groupRoad:{id:groupId,riderIds,
        leaderRiderId:
          groupTrack.leaderRiderId,
        startClock:groupTrack.startClock,
        endClock:groupTrack.endClock,
        riders:groupTrack.rows},
      membershipChanged:true});
    tracks=[...tracks.filter(track=>
      !event.roadIds.includes(track.id)),
    {...groupTrack,id:groupId,kind:'group',
      domainEndM:1000}];
    lastClock=event.clockSeconds;
  }
  const lastEvent=findPhysicalOrderedBoundaryEventsV1(
    tracks,bunch,next.sourceKm).find(row=>
      !passedPairs.has(row.roadIds.join('|')));
  if(contacts.length>=prior.riderCount&&lastEvent)
    throw new Error(
      'Post-bunch chain exceeds field contacts.');
  const recording={version:
    PHYSICAL_ORDERED_REAR_POST_BUNCH_CHAIN_VERSION,
  sourceKm:next.sourceKm,
  sources:{joined},contacts,
  firstUnsettledEvent,
  endRoads:tracks.map(track=>({
    id:track.id,kind:track.kind,
    riderIds:[...track.riderIds],
    startClock:track.startClock,
    endClock:track.endClock,
    leaderRiderId:track.leaderRiderId,
    rows:track.rows})),
  fullKilometreUnsettled:
    firstUnsettledEvent!==null,
  movesGuidedRace:false,
  officialResults:false};
  if(contacts.some((row,index)=>index>0&&
      row.event.clockSeconds<=
        contacts[index-1].event.clockSeconds+EPS))
    throw new Error(
      'Post-bunch chain repeats event clock.');
  return {recording,tracks,bunch,next,joined};
}

export function inspectPhysicalOrderedRearPostBunchChainV1(
  input){
  return sourcePhysicalOrderedRearPostBunchChainV1(
    input).recording;
}

export function validatePhysicalOrderedRearPostBunchChainV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectPhysicalOrderedRearPostBunchChainV1(
      input)))
    throw new Error(
      'Post-bunch chain differs from paid source.');
  return true;
}
