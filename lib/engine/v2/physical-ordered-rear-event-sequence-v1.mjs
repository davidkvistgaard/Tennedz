// Resolve measured rear and solo-to-bunch contacts in road-clock order.
// A joined road replaces only its paid source roads. Unsupported group
// bunch meetings remain explicit boundaries, never inferred joins.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalOrderedRearBoundaryFromStateV1} from
  './physical-ordered-rear-next-boundary-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {measurePhysicalOrderedRearSoloBunchContactV1} from
  './physical-ordered-rear-continuation-bunch-contact-v1.mjs';
import {pricePhysicalOrderedRearSoloBunchJoinV1} from
  './physical-ordered-rear-continuation-bunch-join-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';

export const PHYSICAL_ORDERED_REAR_EVENT_SEQUENCE_VERSION=
  'v2-physical-ordered-rear-event-sequence-1';
const EPS=1e-5;

function pairKey(event){
  return [...event.roadIds].sort().join('|');
}

function paidApproaches(roads,event){
  return roads.flatMap(road=>road.rows.map(row=>{
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
        'Ordered sequence breaks paid approach.');
    return {riderId:row.riderId,
      roadId:road.id,role:row.role,
      decision:row.decision,
      energyBefore:row.energyBefore,
      energyAtContact,
      clockAtContact:event.clockSeconds};
  }));
}

export function sourcePhysicalOrderedRearEventSequenceV1({
  startInput,prior}){
  if(startInput?.physicalDraftVersion!==4||
    startInput?.physicalRearIntentVersion!==2)
    throw new Error(
      'Ordered sequence needs opt-in physical decisions.');
  const source=sourcePhysicalOrderedRearBoundaryFromStateV1({
    startInput,prior});
  const {bunch,next}=source;
  let tracks=source.tracks;
  const contacts=[];
  const passedPairs=new Set();
  const bunchRiderIds=[...next.step.physicalGroup
    .riderIds];
  let lastClock=-Infinity;
  let firstUnsettledEvent=null;
  while(true){
    const event=findPhysicalOrderedBoundaryEventsV1(
      tracks,bunch,next.sourceKm).find(row=>
        !passedPairs.has(pairKey(row)));
    if(!event)break;
    if(contacts.length>prior.riderCount**2||
      event.clockSeconds<=lastClock+EPS||
      event.metresIntoKm<=0||
      event.metresIntoKm>=1000)
      throw new Error(
        'Ordered sequence breaks measured event order.');
    if(event.involvesBunch){
      const roadId=event.roadIds.find(id=>
        id!=='peloton');
      const solo=tracks.find(track=>
        track.id===roadId);
      if(!solo||solo.kind!=='solo'||
        solo.riderIds.length!==1){
        firstUnsettledEvent=event;
        break;
      }
      const contact=
        measurePhysicalOrderedRearSoloBunchContactV1({
          startInput,next,event,solo});
      const canJoin=contact.canHold&&
        contact.payable&&
        contact.reserveOkay&&
        contact.shelterCheaper;
      if(canJoin){
        const priced=
          pricePhysicalOrderedRearSoloBunchJoinV1({
            startInput,next,contact});
        if(bunchRiderIds.includes(
          priced.riderId)||
          Math.abs(priced.bunchEndClock-
            (next.bunchStartClock+
              next.step.elapsedSeconds))>EPS)
          throw new Error(
            'Ordered sequence repeats bunch rider.');
        bunchRiderIds.push(priced.riderId);
        contacts.push({event,
          kind:'solo_bunch',
          outcome:'join',
          soloDecision:solo.rows[0].decision,
          soloEnergyBefore:solo.rows[0]
            .energyBefore,
          soloEnergyAtContact:
            contact.energyAtContact,
          soloEnergySpentToContact:
            contact.soloEnergySpentToContact,
          joinDecision:priced.decision,
          energyAfter:priced.energyAfter,
          membershipChanged:true});
        tracks=tracks.filter(track=>
          track.id!==roadId);
      }else{
        const reason=!contact.canHold?
          'cannot_hold_measured_bunch_pace':
          !contact.payable?
            'cannot_pay_bunch_shelter':
            !contact.reserveOkay?
              'protect_committed_stage_reserve':
              'bunch_shelter_not_cheaper';
        contacts.push({event,
          kind:'solo_bunch',
          outcome:'stay_solo',
          contactDecision:{
            riderId:contact.riderId,
            goal:contact.intent.action,
            effort:contact.intent.effort,
            teamOrderEffort:
              contact.intent.teamOrderEffort,
            committedTeamStake:
              contact.intent.committedTeamStake,
            intentSource:contact.intent.source,
            choice:'stay_solo_after_bunch_contact',
            reason,
            atDistanceM:event.atDistanceM,
            atClockSeconds:event.clockSeconds,
            energyAtContact:
              contact.energyAtContact,
            holdAbility:contact.holdAbility,
            leaderAbility:
              contact.leaderAbility},
          membershipChanged:false});
        passedPairs.add(pairKey(event));
      }
      lastClock=event.clockSeconds;
      continue;
    }
    const roads=event.roadIds.map(id=>
      tracks.find(track=>track.id===id));
    if(roads.some(road=>!road)||
      !event.catchingRoadId||
      !roads.some(road=>road.id===
        event.catchingRoadId))
      throw new Error(
        'Ordered sequence lacks catching road.');
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
    const approaches=paidApproaches(roads,event);
    if(choice.outcome!=='join'){
      contacts.push({event,
        kind:'rear_rear',
        outcome:'pass_through',
        choice,paidApproaches:approaches,
        membershipChanged:false});
      passedPairs.add(pairKey(event));
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
        'Ordered sequence needs one paid group leader.');
    contacts.push({event,
      kind:'rear_rear',outcome:'join',
      choice:joinedChoice,
      paidApproaches:approaches,
      groupRoad:{id:groupId,riderIds,
        leaderRiderId:
          groupTrack.leaderRiderId,
        startClock:groupTrack.startClock,
        endClock:groupTrack.endClock,
        riders:groupTrack.rows},
      membershipChanged:true});
    tracks=[...tracks.filter(track=>
      !event.roadIds.includes(track.id)),
    {...groupTrack,id:groupId,
      kind:'group',domainEndM:1000}];
    lastClock=event.clockSeconds;
  }
  const recording={version:
    PHYSICAL_ORDERED_REAR_EVENT_SEQUENCE_VERSION,
  sourceKm:next.sourceKm,
  sourceVersion:source.recording.version,
  contacts,
  endBunchRiderIds:bunchRiderIds,
  endRoads:tracks.map(track=>({
    id:track.id,kind:track.kind,
    riderIds:[...track.riderIds],
    startClock:track.startClock,
    endClock:track.endClock,
    leaderRiderId:track.leaderRiderId,
    rows:track.rows})),
  firstUnsettledEvent,
  fullKilometreUnsettled:
    firstUnsettledEvent!==null,
  movesGuidedRace:false,officialResults:false};
  return {recording,tracks,bunch,next};
}

export function inspectPhysicalOrderedRearEventSequenceV1(
  input){
  return sourcePhysicalOrderedRearEventSequenceV1(
    input).recording;
}

export function validatePhysicalOrderedRearEventSequenceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    inspectPhysicalOrderedRearEventSequenceV1(input)))
    throw new Error(
      'Ordered event sequence differs from paid source.');
  return true;
}
