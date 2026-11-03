// Settle ordered rear contacts, bunch joins and paid solo passages
// within one front/rear kilometre. Front contact requires the opt-in
// path; ambiguous simultaneous contacts remain guarded.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {sourcePhysicalAllRearBoundaryFromStateV1} from
  './physical-all-rear-next-km-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {physicalRearIntentAtKmV2} from
  './physical-rear-intent-v2.mjs';
import {pricePhysicalRearEventTrackV1,
  pricePhysicalRearSoloFromContactV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {measurePhysicalOrderedRearSoloBunchContactV1} from
  './physical-ordered-rear-continuation-bunch-contact-v1.mjs';
import {pricePhysicalOrderedRearSoloBunchJoinV1} from
  './physical-ordered-rear-continuation-bunch-join-v1.mjs';
import {measurePhysicalOrderedRearGroupBunchV1,
  pricePhysicalOrderedRearGroupBunchJoinV1,
  pricePhysicalOrderedRearGroupBunchPartialJoinV1} from
  './physical-ordered-rear-group-bunch-v1.mjs';

export const PHYSICAL_FRONT_REAR_JOINED_KM_VERSION=
  'v2-physical-front-rear-joined-km-1';
export const PHYSICAL_INDEPENDENT_SIMULTANEOUS_KM_VERSION=
  'v2-physical-independent-simultaneous-km-1';
export const PHYSICAL_FRONT_TO_REAR_CATCH_BOUNDARY_KM_VERSION=
  'v2-physical-front-to-rear-catch-boundary-km-1';
export const PHYSICAL_FRONT_REAR_ALL_CONTACTS_KM_VERSION=
  'v2-physical-front-rear-all-contacts-km-1';
export const PHYSICAL_FRONT_REAR_CHASE_CONTACTS_KM_VERSION=
  'v2-physical-front-rear-chase-contacts-km-1';
export const PHYSICAL_ALL_REAR_CONTACTS_KM_VERSION=
  'v2-physical-all-rear-contacts-km-1';
export const PHYSICAL_FRONT_TO_REAR_CONTACTS_KM_VERSION=
  'v2-physical-front-to-rear-contacts-km-1';
export const PHYSICAL_ALL_REAR_PARTIAL_BUNCH_KM_VERSION=
  'v2-physical-all-rear-partial-bunch-km-1';
export const PHYSICAL_GROUP_BUNCH_PASS_KM_VERSION=
  'v2-physical-group-bunch-pass-km-1';
const EPS=.002;
const EFFORT_RANK={conserve:0,steady:1,hard:2};

function energyAt(track,riderId,metres){
  const raw=track.energyAt(metres);
  return Array.isArray(raw)?raw.find(row=>
    row.riderId===riderId)
    ?.energyAtContact:raw;
}

function independentSameClockContacts(event,last){
  return !event.involvesBunch&&
    !last.involvesBunch&&
    Math.abs(event.clockSeconds-
      last.clockSeconds)<=EPS&&
    Math.abs(event.metresIntoKm-
      last.metresIntoKm)>EPS&&
    event.roadIds.every(id=>
      !last.roadIds.includes(id))&&
    event.riders.every(rider=>
      !last.riders.some(row=>
        row.riderId===rider.riderId));
}

function laterOrderedEvents(tracks,bunch,km,
  processed=[]){
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,bunch,km);
  const last=processed.at(-1);
  if(!last)return events;
  return events.filter(event=>{
    if(processed.some(row=>
      isDeepStrictEqual(event.roadIds,
        row.roadIds)&&
      Math.abs(event.metresIntoKm-
        row.metresIntoKm)<=EPS&&
      Math.abs(event.clockSeconds-
        row.clockSeconds)<=EPS))
      return false;
    if(event.involvesBunch&&
      last.involvesBunch&&
      Math.abs(event.metresIntoKm-
        last.metresIntoKm)<=EPS&&
      Math.abs(event.clockSeconds-
        last.clockSeconds)<=EPS&&
      event.riders.length>0&&
      event.riders.every(rider=>
        last.riders.some(row=>row.riderId===
          rider.riderId)))
      return false;
    if(event.clockSeconds<last.clockSeconds-EPS)
      throw new Error(
        'Joined front-rear km creates earlier contact: '+
        JSON.stringify({km,last,event}));
    if(Math.abs(event.clockSeconds-
      last.clockSeconds)<=EPS){
      if(independentSameClockContacts(
        event,last))return true;
      throw new Error(
        'Joined front-rear km needs simultaneous contact source: '+
        JSON.stringify({km,last,event}));
    }
    return true;
  });
}

function simultaneousSplitLeader({startInput,step,
  event,roads,km}){
  if(event.catchingRoadId!==null||
    event.involvesBunch||
    roads.length!==2||
    roads.some(road=>road.kind!=='solo'||
      road.riderIds.length!==1||
      Math.abs(road.domainStartM-
        event.metresIntoKm)>EPS)||
    event.roadIds.some(id=>{
      const riderId=id.slice('solo-'.length);
      const split=step.splits.find(row=>
        row.riderId===riderId);
      return !id.startsWith('solo-')||
        !split||Math.abs(split.atDistanceM-
          event.atDistanceM)>EPS;
    })||
    Math.abs(event.observedSecondsPerKmByRoad[
      event.roadIds[0]]-
      event.observedSecondsPerKmByRoad[
        event.roadIds[1]])>EPS)
    return null;
  const candidates=event.riders.map(row=>({
    riderId:row.riderId,
    intent:physicalRearIntentAtKmV2({
      startInput,riderId:row.riderId,km})}));
  const willing=candidates.filter(row=>
    row.intent.action!=='save_for_stage');
  if(willing.length!==2)
    throw new Error(
      'Simultaneous split needs two willing riders.');
  willing.sort((a,b)=>
    EFFORT_RANK[b.intent.effort]-
      EFFORT_RANK[a.intent.effort]||
    a.riderId.localeCompare(b.riderId));
  return {leaderRiderId:willing[0].riderId,
    basis:'committed_effort_then_stable_volunteer',
    candidateIntents:candidates};
}

export function replayPhysicalFrontRearJoinedKmV1({
  startInput,prior,resolveBunch=false,
  chaseObserverTeamId=null,allRear=false,
  resolveFront=false,
  allowFrontCatchBoundary=false}){
  if(resolveFront&&(allRear||!resolveBunch)||
    allowFrontCatchBoundary&&!resolveFront)
    throw new Error(
      'Front contact needs ordered full field.');
  const source=allRear?
    sourcePhysicalAllRearBoundaryFromStateV1({
      startInput,prior}):
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior,chaseObserverTeamId,
      allowFrontCatchBoundary});
  const km=source.recording.sourceKm;
  if(!source.recording.fieldKilometreIncomplete||
    !resolveBunch&&source.step.splits.length)
    throw new Error(
      'Joined front-rear km needs old rear contact without new split.');
  const roster=startInput.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const previous=new Map(prior.riderStates
    .map(row=>[row.riderId,row]));
  const ledger=new Map(prior.endRearEntities
    .flatMap(entity=>entity.riderIds)
    .map(riderId=>[riderId,{
      energy:previous.get(riderId)?.energyAfter,
      decisions:[],segments:[]}]));
  const frontRiderId=allRear?null:
    prior.endFrontState.riderId;
  const frontRoadId=`front-${frontRiderId}`;
  if(resolveFront)
    ledger.set(frontRiderId,{
      energy:previous.get(frontRiderId)
        ?.energyAfter,
      decisions:[],segments:[]});
  if(resolveBunch){
    for(const split of source.step.splits){
      const riderId=split.riderId;
      const before=previous.get(riderId);
      const partial=source.step.riders.find(row=>
        row.riderId===riderId);
      const decision=source.step.riderDecisions
        .find(row=>row.riderId===riderId);
      const metres=split.atDistanceM-
        (source.recording.sourceKm-1)*1000;
      if(ledger.has(riderId)||
        before?.physicalGroupId!=='peloton'||
        !partial||!decision||
        !Number.isFinite(partial.energyAfter)||
        metres<=0||metres>=1000)
        throw new Error(
          'Joined front-rear km lacks paid new split.');
      ledger.set(riderId,{
        energy:partial.energyAfter,
        decisions:[decision],
        segments:[{riderId,roadId:'peloton',
          role:partial.role,
          fromMetres:0,toMetres:metres,
          energyBefore:before.energyAfter,
          energyAfter:partial.energyAfter,
          decision}]});
    }
  }
  if(ledger.size!==prior.endRearEntities
    .reduce((count,entity)=>count+
      entity.riderIds.length,0)+
      (resolveBunch?source.step.splits.length:0)+
      (resolveFront?1:0)||
    [...ledger.values()].some(row=>
      !Number.isFinite(row.energy)))
    throw new Error(
      'Joined front-rear km lacks prior rear ledger.');
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  let tracks=source.tracks.map(track=>
    resolveFront&&track.id===frontRoadId?{
      ...track,groupId:track.id,
      kind:'solo',
      endClock:source.frontStep.elapsedSeconds??
        source.frontStep.contact.clockSeconds,
      rows:[{riderId:frontRiderId,
        role:'leader',
        decision:source.frontStep.decision??
          source.frontStep.frontDecision,
        energyBefore:prior.endFrontState
          .energyAfter,
        energySpent:source.frontStep
          .frontPartial?.energySpent??
          source.frontStep.energySpent,
        energyAfter:source.frontStep
          .frontPartial?.energyAtContact??
          source.frontStep.energyAfter}]}:track);
  let events=laterOrderedEvents(
    tracks,source.bunch,km);
  if(!isDeepStrictEqual(events[0]??null,
    source.recording.firstCandidateEvent))
    throw new Error(
      'Joined front-rear km breaks first boundary.');
  const contacts=[];
  const bunchJoins=[];
  const bunchPassages=[];
  const groupSeparations=[];
  const groupPassages=[];
  const rearPassages=[];
  const processedEvents=[];
  while(events.length){
    const event=events[0];
    const roads=event.roadIds.map(id=>
      id==='peloton'?source.bunch:
        tracks.find(track=>track.id===id));
    const splitLeader=resolveBunch&&
      !event.catchingRoadId?
      simultaneousSplitLeader({startInput,
        step:source.step,event,roads,km}):null;
    if(!allRear&&!resolveFront&&
      event.roadIds.includes(frontRoadId)){
      const refusal=new Error(
        'Joined front-rear km needs ordered rear catch: '+
        JSON.stringify({event,
          lastEvent:processedEvents.at(-1),
          contactCount:contacts.length}));
      refusal.sourceKm=km;
      refusal.frontContactEvent=event;
      throw refusal;
    }
    if(contacts.length+bunchJoins.length+
      bunchPassages.length+
      groupPassages.length+
      rearPassages.length>=
      roster.length||
      roads.some(track=>!track)||
      !event.catchingRoadId&&!splitLeader||
      event.metresIntoKm<=0||
      event.metresIntoKm>=1000||
      processedEvents.length&&
        event.clockSeconds<=
          processedEvents.at(-1)
            .clockSeconds+EPS&&
        !independentSameClockContacts(
          event,processedEvents.at(-1)))
      throw new Error(
        'Joined front-rear km needs ordered rear catch: '+
        JSON.stringify({event,
          lastEvent:processedEvents.at(-1),
          contactCount:contacts.length}));
    if(event.involvesBunch){
      const rear=roads.find(road=>
        road.id!=='peloton');
      if(!rear||rear.kind!=='group'&&
        rear.kind!=='solo')
        throw new Error(
          'Joined front-rear km lacks paid bunch approach.');
      const paidRearApproach=rear.rows.map(row=>{
        const entry=ledger.get(row.riderId);
        const paidEnergy=energyAt(rear,
          row.riderId,event.metresIntoKm);
        const recorded=event.riders.find(item=>
          item.riderId===row.riderId)
          ?.energyAtContact;
        if(!entry||
          Math.abs(entry.energy-
            row.energyBefore)>EPS||
          Math.abs(paidEnergy-
            recorded)>EPS||
          Math.abs(rear.clockAt(
            event.metresIntoKm)-
            event.clockSeconds)>EPS)
          throw new Error(
            'Joined front-rear km breaks bunch approach.');
        return {riderId:row.riderId,
          roadId:rear.id,role:row.role,
          fromMetres:rear.domainStartM,
          toMetres:event.metresIntoKm,
          energyBefore:entry.energy,
          energyAtContact:recorded,
          decision:row.decision};
      });
      if(!resolveBunch)
        return {version:
          PHYSICAL_FRONT_REAR_JOINED_KM_VERSION,
        sourceKm:km,
        sources:{boundary:source.recording,
          contacts,
          rearSegments:[...ledger].flatMap(
            ([,entry])=>entry.segments),
          paidRearApproach},
        firstUnresolvedEvent:event,
        fieldKilometreIncomplete:true,
        movesGuidedRace:false,
        officialResults:false};
      const bunchStartClock=prior.riderStates.find(
        row=>row.physicalGroupId==='peloton')
        ?.elapsedSeconds;
      const next={sourceKm:km,
        step:source.step,bunchStartClock};
      const contact=rear.kind==='group'?
        measurePhysicalOrderedRearGroupBunchV1({
          startInput,next,event,group:rear}):
        measurePhysicalOrderedRearSoloBunchContactV1({
          startInput,next,event,solo:rear});
      if(rear.kind==='solo'&&(!contact.canHold||
        !contact.payable||!contact.reserveOkay||
        !contact.shelterCheaper)){
        const approach=paidRearApproach[0];
        const entry=ledger.get(approach.riderId);
        const reason=!contact.canHold?
          'cannot_hold_measured_bunch_pace':
          !contact.payable?
            'cannot_pay_bunch_shelter':
            !contact.reserveOkay?
              'protect_committed_stage_reserve':
              'bunch_shelter_not_cheaper';
        const decision={riderId:approach.riderId,
          goal:contact.intent.action,
          effort:contact.intent.effort,
          teamOrderEffort:
            contact.intent.teamOrderEffort,
          committedTeamStake:
            contact.intent.committedTeamStake,
          intentSource:contact.intent.source,
          choice:'stay_solo_after_bunch_contact',
          reason,atDistanceM:event.atDistanceM,
          atClockSeconds:event.clockSeconds,
          energyAtContact:
            contact.energyAtContact,
          holdAbility:contact.holdAbility,
          leaderAbility:contact.leaderAbility};
        entry.segments.push({...approach,
          energyAfter:approach.energyAtContact});
        entry.decisions.push(approach.decision,
          decision);
        entry.energy=approach.energyAtContact;
        const oldRow=rear.rows[0];
        const continued={...rear,
          domainStartM:event.metresIntoKm,
          rows:[{...oldRow,
            energyBefore:entry.energy,
            energySpent:entry.energy-
              oldRow.energyAfter}]};
        tracks=tracks.map(track=>track.id===
          rear.id?continued:track);
        bunchPassages.push({event,decision,
          paidRearApproach});
        processedEvents.push(event);
        events=laterOrderedEvents(
          tracks,source.bunch,km,
          processedEvents);
        continue;
      }
      if(rear.kind==='group'&&
        contact.groupRiders.some(row=>
          !row.canHold||!row.payable||
          !row.reserveOkay||
          !row.shelterCheaper)){
        const canJoin=contact.groupRiders
          .filter(row=>row.canHold&&
            row.payable&&row.reserveOkay&&
            row.shelterCheaper);
        const sliding=contact.groupRiders
          .filter(row=>!canJoin.includes(row));
        if(!canJoin.length){
          const decisions=[];
          for(const member of sliding){
            const approach=paidRearApproach.find(
              row=>row.riderId===
                member.riderId);
            const entry=ledger.get(
              member.riderId);
            if(!approach||!entry||
              Math.abs(approach
                .energyAtContact-
                member.energyAtContact)>EPS)
              throw new Error(
                'Group passage breaks paid approach.');
            const decision={
              riderId:member.riderId,
              goal:member.intent.action,
              effort:member.intent.effort,
              teamOrderEffort:member.intent
                .teamOrderEffort,
              committedTeamStake:
                member.intent
                  .committedTeamStake,
              intentSource:member.intent.source,
              choice:'stay_group_after_bunch_contact',
              reason:!member.canHold?
                'cannot_hold_measured_bunch_pace':
                !member.payable?
                  'cannot_pay_bunch_shelter':
                  !member.reserveOkay?
                    'protect_committed_stage_reserve':
                    'bunch_shelter_not_cheaper',
              atDistanceM:event.atDistanceM,
              atClockSeconds:event.clockSeconds,
              energyAtContact:
                member.energyAtContact,
              holdAbility:member.holdAbility,
              leaderAbility:
                member.leaderAbility};
            entry.segments.push({
              ...approach,
              energyAfter:member
                .energyAtContact});
            entry.decisions.push(
              approach.decision,decision);
            entry.energy=member
              .energyAtContact;
            decisions.push(decision);
          }
          const continuation=
            pricePhysicalRearEventTrackV1({
              startInput,
              riderIds:rear.riderIds,
              energyByRider:
                Object.fromEntries(
                  contact.groupRiders.map(
                    row=>[row.riderId,
                      row.energyAtContact])),
              km,startM:event.metresIntoKm,
              startClock:event.clockSeconds,
              contactLeaderRiderId:
                rear.leaderRiderId,
              groupId:rear.id});
          tracks=tracks.map(track=>
            track.id===rear.id?{
              ...continuation,id:rear.id,
              kind:'group',domainEndM:1000}:
              track);
          groupPassages.push({event,
            decisions,
            groupRoad:{id:rear.id,
              riderIds:[...rear.riderIds],
              leaderRiderId:continuation
                .leaderRiderId,
              endClock:continuation.endClock,
              rows:continuation.rows}});
          processedEvents.push(event);
          events=laterOrderedEvents(
            tracks,source.bunch,km,
            processedEvents);
          continue;
        }
        if(sliding.length!==1){
          const refusal=new Error(
            'Group bunch contact needs individual paid separation.');
          refusal.groupBunchContact={
            event,
            members:contact.groupRiders.map(row=>({
              riderId:row.riderId,
              canHold:row.canHold,
              payable:row.payable,
              reserveOkay:row.reserveOkay,
              shelterCheaper:
                row.shelterCheaper}))};
          throw refusal;
        }
        const paidJoin=
          pricePhysicalOrderedRearGroupBunchPartialJoinV1({
            startInput,next,contact,
            joiningRiderIds:canJoin
              .map(row=>row.riderId)});
        for(const decision of paidJoin.decisions){
          const approach=paidRearApproach.find(
            row=>row.riderId===decision.riderId);
          const entry=ledger.get(decision.riderId);
          if(!approach||!entry||
            Math.abs(approach.energyAtContact-
              decision.energyAtContact)>EPS)
            throw new Error(
              'Partial bunch join breaks paid approach.');
          entry.segments.push({...approach,
            energyAfter:decision.energyAtContact},
          {riderId:decision.riderId,
            roadId:'peloton',role:'sheltered',
            fromMetres:event.metresIntoKm,
            toMetres:1000,
            energyBefore:decision.energyAtContact,
            energyAfter:decision.energyAfter,
            decision});
          entry.decisions.push(approach.decision,
            decision);
          entry.energy=decision.energyAfter;
        }
        const slidingMember=sliding[0];
        const slideApproach=paidRearApproach.find(
          row=>row.riderId===
            slidingMember.riderId);
        const slideEntry=ledger.get(
          slidingMember.riderId);
        if(!slideApproach||!slideEntry||
          Math.abs(slideApproach
            .energyAtContact-
            slidingMember.energyAtContact)>EPS)
          throw new Error(
            'Group separation breaks paid approach.');
        const slideDecision={
          riderId:slidingMember.riderId,
          goal:slidingMember.intent.action,
          effort:slidingMember.intent.effort,
          teamOrderEffort:slidingMember.intent
            .teamOrderEffort,
          committedTeamStake:
            slidingMember.intent
              .committedTeamStake,
          intentSource:slidingMember.intent
            .source,
          choice:'slide_from_group',
          reason:!slidingMember.canHold?
            'cannot_hold_measured_bunch_pace':
            !slidingMember.payable?
              'cannot_pay_bunch_shelter':
              !slidingMember.reserveOkay?
                'protect_committed_stage_reserve':
                'bunch_shelter_not_cheaper',
          atDistanceM:event.atDistanceM,
          atClockSeconds:event.clockSeconds,
          energyAtContact:
            slidingMember.energyAtContact,
          holdAbility:slidingMember.holdAbility,
          leaderAbility:
            slidingMember.leaderAbility};
        slideEntry.segments.push({
          ...slideApproach,
          energyAfter:slidingMember
            .energyAtContact});
        slideEntry.decisions.push(
          slideApproach.decision,
          slideDecision);
        slideEntry.energy=slidingMember
          .energyAtContact;
        const soloId=`solo-${
          slidingMember.riderId}`;
        const solo=
          pricePhysicalRearSoloFromContactV1({
            startInput,
            riderId:slidingMember.riderId,
            energyBefore:slideEntry.energy,
            km,startM:event.metresIntoKm,
            startClock:event.clockSeconds,
            groupId:soloId});
        tracks=tracks.filter(track=>
          track.id!==rear.id);
        tracks.push({...solo,id:soloId});
        bunchJoins.push({event,
          roadId:rear.id,
          paidRearApproach:paidRearApproach
            .filter(row=>canJoin.some(
              member=>member.riderId===
                row.riderId)),
          decisions:paidJoin.decisions});
        groupSeparations.push({event,
          paidJoin,slideDecision,
          slideRoad:{id:soloId,
            riderId:slidingMember.riderId,
            endClock:solo.endClock,
            energyAfter:solo.rows[0]
              .energyAfter}});
        processedEvents.push(event);
        events=laterOrderedEvents(
          tracks,source.bunch,km,
          processedEvents);
        continue;
      }
      const priced=rear.kind==='group'?
        pricePhysicalOrderedRearGroupBunchJoinV1({
          startInput,next,contact}):
        pricePhysicalOrderedRearSoloBunchJoinV1({
          startInput,next,contact});
      const joinDecisions=rear.kind==='group'?
        priced.decisions:[priced.decision];
      if(joinDecisions.length!==rear.rows.length||
        new Set(joinDecisions.map(row=>
          row.riderId)).size!==rear.rows.length)
        throw new Error(
          'Joined front-rear km lacks individual bunch choice.');
      for(const approach of paidRearApproach){
        const entry=ledger.get(approach.riderId);
        const decision=joinDecisions.find(row=>
          row.riderId===approach.riderId);
        if(!entry||!decision||
          Math.abs(approach.energyAtContact-
            decision.energyAtContact)>EPS||
          !Number.isFinite(decision.energyAfter)||
          decision.energyAfter<0)
          throw new Error(
            'Joined front-rear km breaks bunch join energy.');
        entry.segments.push({...approach,
          energyAfter:approach
            .energyAtContact});
        entry.decisions.push(approach.decision);
        entry.segments.push({
          riderId:approach.riderId,
          roadId:'peloton',
          role:'sheltered',
          fromMetres:event.metresIntoKm,
          toMetres:1000,
          energyBefore:approach
            .energyAtContact,
          energyAfter:decision.energyAfter,
          decision});
        entry.decisions.push(decision);
        entry.energy=decision.energyAfter;
      }
      bunchJoins.push({event,
        roadId:rear.id,
        paidRearApproach,
        decisions:joinDecisions});
      tracks=tracks.filter(track=>
        track.id!==rear.id);
      processedEvents.push(event);
      events=laterOrderedEvents(
        tracks,source.bunch,km,
        processedEvents);
      continue;
    }
    const catching=roads.find(road=>
      road.id===event.catchingRoadId);
    const choiceInput={startInput,km,
      roadIds:event.roadIds,
      riderIdsByRoad:event.riderIdsByRoad,
      catchingRoadId:event.catchingRoadId,
      observedSecondsPerKmByRoad:
        event.observedSecondsPerKmByRoad,
      leaderRiderId:catching?.leaderRiderId??
        splitLeader.leaderRiderId};
    const firstChoice=decidePhysicalRearContactV1(
      choiceInput);
    if(firstChoice.outcome==='pass_through'&&
      resolveBunch){
      const paidApproaches=[];
      const continued=[];
      for(const road of roads){
        const rows=[];
        for(const row of road.rows){
          const entry=ledger.get(row.riderId);
          const atContact=energyAt(road,
            row.riderId,event.metresIntoKm);
          const recorded=event.riders.find(item=>
            item.riderId===row.riderId)
            ?.energyAtContact;
          const choice=firstChoice
            .riderDecisions.find(item=>
              item.riderId===row.riderId);
          if(!entry||!choice||
            Math.abs(entry.energy-
              row.energyBefore)>EPS||
            Math.abs(atContact-recorded)>EPS||
            !Number.isFinite(row.energyAfter))
            throw new Error(
              'Rear passage breaks paid approach.');
          const approach={riderId:row.riderId,
            roadId:road.id,role:row.role,
            fromMetres:road.domainStartM,
            toMetres:event.metresIntoKm,
            energyBefore:entry.energy,
            energyAfter:recorded,
            decision:row.decision};
          if(approach.toMetres-
            approach.fromMetres>EPS){
            entry.segments.push(approach);
            entry.decisions.push(row.decision);
          }
          entry.decisions.push(choice);
          entry.energy=recorded;
          paidApproaches.push(approach);
          rows.push({...row,
            energyBefore:recorded,
            energySpent:recorded-
              row.energyAfter});
        }
        continued.push({...road,rows,
          domainStartM:event.metresIntoKm});
      }
      tracks=tracks.map(track=>continued.find(
        row=>row.id===track.id)??track);
      rearPassages.push({event,
        choice:firstChoice,paidApproaches});
      processedEvents.push(event);
      events=laterOrderedEvents(
        tracks,source.bunch,km,
        processedEvents);
      continue;
    }
    if(firstChoice.outcome!=='join')
      throw new Error(
        'Joined front-rear km needs paid pass-through.');
    const paidApproaches=[];
    for(const road of roads){
      for(const row of road.rows){
        const entry=ledger.get(row.riderId);
        const paidEnergy=energyAt(road,
          row.riderId,event.metresIntoKm);
        const recordedEnergy=event.riders.find(
          item=>item.riderId===row.riderId)
          ?.energyAtContact;
        if(!entry||!Number.isFinite(paidEnergy)||
          Math.abs(entry.energy-
            row.energyBefore)>EPS||
          Math.abs(paidEnergy-
            recordedEnergy)>EPS||
          Math.abs(road.clockAt(
            event.metresIntoKm)-
            event.clockSeconds)>EPS)
          throw new Error(
            'Joined front-rear km breaks paid approach.');
        const segment={riderId:row.riderId,
          roadId:road.id,role:row.role,
          fromMetres:road.domainStartM,
          toMetres:event.metresIntoKm,
          energyBefore:entry.energy,
          energyAfter:recordedEnergy,
          decision:row.decision};
        if(segment.toMetres-
          segment.fromMetres>EPS){
          entry.segments.push(segment);
          entry.decisions.push(row.decision);
        }
        entry.energy=recordedEnergy;
        paidApproaches.push(segment);
      }
    }
    const riderIds=event.roadIds.flatMap(id=>
      event.riderIdsByRoad[id]);
    const groupId=`rear-event-${
      [...riderIds].sort().join('-')}`;
    const groupTrack=pricePhysicalRearEventTrackV1({
      startInput,riderIds,
      energyByRider:Object.fromEntries(
        event.riders.map(row=>[
          row.riderId,row.energyAtContact])),
      km,startM:event.metresIntoKm,
      startClock:event.clockSeconds,
      contactLeaderRiderId:
        catching?.leaderRiderId??
          splitLeader.leaderRiderId,
      groupId});
    const choice=decidePhysicalRearContactV1({
      ...choiceInput,
      leaderRiderId:groupTrack.leaderRiderId});
    if(choice.outcome!=='join'||
      groupTrack.rows.filter(row=>
        row.role==='leader').length!==1||
      groupTrack.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1))
      throw new Error(
        'Joined front-rear km needs one paid leader.');
    for(const decision of choice.riderDecisions)
      ledger.get(decision.riderId)
        .decisions.push(decision);
    const newRoad={...groupTrack,id:groupId,
      kind:'group',domainEndM:1000};
    tracks=tracks.filter(track=>
      !event.roadIds.includes(track.id));
    tracks.push(newRoad);
    contacts.push({event,choice,
      ...(splitLeader?{splitLeader}:{}),
      paidApproaches,
      groupRoad:{id:groupId,
        riderIds:[...riderIds],
        leaderRiderId:groupTrack
          .leaderRiderId,
        endClock:groupTrack.endClock,
        rows:groupTrack.rows}});
    processedEvents.push(event);
    events=laterOrderedEvents(
      tracks,source.bunch,km,
      processedEvents);
  }
  if(resolveFront&&!contacts.some(row=>
    row.event.roadIds.includes(frontRoadId)))
    throw new Error(
      'Front-to-rear km lacks paid joined contact.');
  const rearStates=[];
  const endRearEntities=[];
  const frontStillSolo=resolveFront&&
    tracks.some(track=>track.id===frontRoadId);
  for(const track of tracks){
    if(!allRear&&track.id===frontRoadId)
      continue;
    const old=oldEntities.get(track.id);
    if(track.kind!=='solo'&&
      track.kind!=='group'||
      track.kind==='solo'&&
        track.rows.length!==1||
      track.kind==='group'&&
        track.rows.filter(row=>
          row.role==='leader').length!==1)
      throw new Error(
        'Joined front-rear km lacks paid rear road.');
    for(const row of track.rows){
      const entry=ledger.get(row.riderId);
      if(!entry||Math.abs(entry.energy-
        row.energyBefore)>EPS||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0)
        throw new Error(
          'Joined front-rear km breaks end energy.');
      entry.segments.push({riderId:row.riderId,
        roadId:track.id,role:row.role,
        fromMetres:track.domainStartM,
        toMetres:1000,
        energyBefore:entry.energy,
        energyAfter:row.energyAfter,
        decision:row.decision});
      entry.decisions.push(row.decision);
      entry.energy=row.energyAfter;
      rearStates.push({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:row.energyAfter,
        decisions:entry.decisions});
    }
    endRearEntities.push({id:track.id,
      kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider:Object.fromEntries(
        track.rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:old?
          (old.rotationIndex+1)%
            track.riderIds.length:0,
        formedKm:old?.formedKm??km}:{})});
  }
  const priorBunch=prior.riderStates.find(row=>
    row.physicalGroupId==='peloton');
  const bunchClock=priorBunch?.elapsedSeconds+
    source.step.elapsedSeconds;
  const bunchDecisions=new Map(source.step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=source.step.physicalGroup
    .riderIds.map(riderId=>({
      riderId,sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:bunchClock,
      energyAfter:source.step
        .energyByRider[riderId],
      decisions:[bunchDecisions.get(riderId)]}));
  for(const join of bunchJoins){
    for(const decision of join.decisions){
      const entry=ledger.get(decision.riderId);
      bunchStates.push({
        riderId:decision.riderId,
        sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchClock,
        energyAfter:entry.energy,
        decisions:entry.decisions});
    }
  }
  const frontEntry=resolveFront?
    ledger.get(frontRiderId):null;
  const finalFrontTrack=frontStillSolo?
    tracks.find(track=>track.id===frontRoadId):null;
  if(finalFrontTrack){
    const row=finalFrontTrack.rows[0];
    if(Math.abs(frontEntry.energy-
      row.energyBefore)>EPS)
      throw new Error(
        'Front contact breaks final solo energy.');
    frontEntry.segments.push({
      riderId:frontRiderId,
      roadId:frontRoadId,role:'leader',
      fromMetres:finalFrontTrack.domainStartM,
      toMetres:1000,
      energyBefore:frontEntry.energy,
      energyAfter:row.energyAfter,
      decision:row.decision});
    frontEntry.decisions.push(row.decision);
    frontEntry.energy=row.energyAfter;
  }
  const frontState=allRear||resolveFront&&
    !frontStillSolo?null:{riderId:frontRiderId,
    sourceKm:km,
    physicalGroupId:source.frontStep
      .physicalGroup.id,
    atDistanceM:km*1000,
    elapsedSeconds:finalFrontTrack?
      finalFrontTrack.endClock:
      source.frontStep.elapsedSeconds,
    energyAfter:frontEntry?
      frontEntry.energy:
      source.frontStep.energyAfter,
    decisions:frontEntry?
      frontEntry.decisions:
      [source.frontStep.decision]};
  const states=new Map([...bunchStates,
    ...(frontState?[frontState]:[]),
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(states.size!==roster.length||
    states.size!==bunchStates.length+
      (frontState?1:0)+rearStates.length||
    roster.some(riderId=>{
      const before=previous.get(riderId);
      const after=states.get(riderId);
      return !before||!after||
        !Number.isFinite(after.elapsedSeconds)||
        after.elapsedSeconds<=
          before.elapsedSeconds||
        !Number.isFinite(after.energyAfter)||
        after.energyAfter<0||
        !after.decisions.length||
        after.decisions.some(decision=>
          !decision);
    }))
    throw new Error(
      'Joined front-rear km lacks full paid field.');
  const independentSameClockCount=
    processedEvents.filter((row,index)=>
      index>0&&independentSameClockContacts(
        row,processedEvents[index-1])).length;
  return {version:allowFrontCatchBoundary?
    PHYSICAL_FRONT_TO_REAR_CATCH_BOUNDARY_KM_VERSION:
    independentSameClockCount?
    PHYSICAL_INDEPENDENT_SIMULTANEOUS_KM_VERSION:
    groupSeparations.length?
    PHYSICAL_ALL_REAR_PARTIAL_BUNCH_KM_VERSION:
    groupPassages.length?
      PHYSICAL_GROUP_BUNCH_PASS_KM_VERSION:
    resolveFront?
    PHYSICAL_FRONT_TO_REAR_CONTACTS_KM_VERSION:
    allRear?
    PHYSICAL_ALL_REAR_CONTACTS_KM_VERSION:
    chaseObserverTeamId!==null?
    PHYSICAL_FRONT_REAR_CHASE_CONTACTS_KM_VERSION:
    resolveBunch?
      PHYSICAL_FRONT_REAR_ALL_CONTACTS_KM_VERSION:
      PHYSICAL_FRONT_REAR_JOINED_KM_VERSION,
    sourceKm:km,
    sources:{boundary:source.recording,
      contacts,
      ...(independentSameClockCount?{
        independentSameClockCount}:{}),
      ...(resolveBunch?{bunchJoins,
        bunchPassages,rearPassages}:{}),
      ...(groupSeparations.length?{
        groupSeparations}:{}),
      ...(groupPassages.length?{
        groupPassages}:{}),
      rearSegments:[...ledger].filter(
        ([id])=>id!==frontRiderId)
        .flatMap(([,entry])=>entry.segments),
      ...(resolveFront?{frontSegments:
        frontEntry.segments}:{})},
    riderStates:roster.map(id=>states.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:bunchStates
      .map(row=>row.riderId),
      energyByRider:Object.fromEntries(
        bunchStates.map(row=>[
          row.riderId,row.energyAfter])),
      quietKmByRider:Object.fromEntries(
        bunchStates.map(row=>[
          row.riderId,source.step
            .quietKmByRider[row.riderId]??0]))},
    ...(frontState?{endFrontState:{
      riderId:frontRiderId,
      elapsedSeconds:frontState.elapsedSeconds,
      energyAfter:frontState.energyAfter,
      gapSecondsToBunch:resolveFront?
        frontState.elapsedSeconds-bunchClock:
        source.frontStep
          .gapSecondsToBunch}}:{}),
    endRearEntities,
    physicalGroups:[{id:'peloton',
      riderIds:bunchStates.map(row=>
        row.riderId),
      atDistanceM:km*1000},
      ...(frontState?[
        source.frontStep.physicalGroup]:[]),
      ...endRearEntities.map(entity=>({
        id:entity.id,
        riderIds:entity.riderIds,
        atDistanceM:km*1000}))],
    fieldKilometreIncomplete:false,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontRearJoinedKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearJoinedKmV1(input)))
    throw new Error(
      'Joined front-rear km differs from paid source.');
  return true;
}

export function replayPhysicalFrontRearAllContactsKmV1({
  startInput,prior,chaseObserverTeamId=null}){
  return replayPhysicalFrontRearJoinedKmV1({
    startInput,prior,resolveBunch:true,
    chaseObserverTeamId});
}

export function replayPhysicalFrontToRearContactsKmV1({
  startInput,prior,chaseObserverTeamId=null,
  allowFrontCatchBoundary=false}){
  return replayPhysicalFrontRearJoinedKmV1({
    startInput,prior,resolveBunch:true,
    resolveFront:true,chaseObserverTeamId,
    allowFrontCatchBoundary});
}

export function validatePhysicalFrontToRearContactsKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontToRearContactsKmV1(
      input)))
    throw new Error(
      'Front-to-rear contact km differs from paid source.');
  return true;
}

export function replayPhysicalAllRearAllContactsKmV1({
  startInput,prior}){
  return replayPhysicalFrontRearJoinedKmV1({
    startInput,prior,resolveBunch:true,
    allRear:true});
}

export function validatePhysicalAllRearAllContactsKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalAllRearAllContactsKmV1(input)))
    throw new Error(
      'All-rear contacts km differs from paid source.');
  return true;
}

export function validatePhysicalFrontRearAllContactsKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearAllContactsKmV1(input)))
    throw new Error(
      'Front-rear all-contact km differs from paid source.');
  return true;
}
