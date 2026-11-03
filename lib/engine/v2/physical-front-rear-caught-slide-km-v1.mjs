// Settle a rear-aware front catch only when its source has one ordered
// contact and the former break rider cannot hold the measured bunch.
import {isDeepStrictEqual} from 'node:util';
import {probePhysicalFrontRearFrontCatchBoundaryV1} from
  './physical-front-rear-front-catch-boundary-v1.mjs';
import {pricePhysicalRearSoloTrackV1,
  pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';
import {completePhysicalFrontBunchLossFromStepV1} from
  './physical-pace-loss-completion-v1.mjs';
import {staggeredSoloTrajectoryV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {orderAt} from './orders.mjs';
import {riderKilometreEffect} from './physiology.mjs';
import {priceRearEnergyDemandV1} from
  './rear-energy-demand-v1.mjs';
import {replayRearEnergyCapV1} from
  './rear-energy-cap-source-v1.mjs';
import {recoveryForKilometre} from './recovery.mjs';
import {segmentBaseSeconds} from './road-clock.mjs';
import {TUNING,MOTOR_RACE_DYNAMICS} from
  './tuning.mjs';

export const PHYSICAL_FRONT_REAR_CAUGHT_SLIDE_KM_VERSION=
  'v2-physical-front-rear-caught-slide-km-1';
export const PHYSICAL_FRONT_REAR_CAUGHT_SLIDE_CHAIN_KM_VERSION=
  'v2-physical-front-rear-caught-slide-chain-km-2';

function catcherTrackDecision(riderId,tracks){
  const row=tracks.flatMap(track=>track.rows)
    .find(item=>item.riderId===riderId);
  if(!row)
    throw new Error(
      'Caught front lacks rear approach decision.');
  return row.decision;
}

function trackEnergyAt(track,riderId,metres){
  const priced=track.energyAt(metres);
  return Array.isArray(priced)?priced.find(row=>
    row.riderId===riderId)?.energyAtContact:
    priced;
}

function settleLaterFrontRearContacts({startInput,km,
  rearTracks,bunchTrack,firstContact,
  firstCatcherDecision,frontId,
  frontDecision,slideDecision}){
  let tracks=[...rearTracks];
  let frontGroupId=firstContact.group.id;
  const history=new Map();
  for(const riderId of firstContact.group.riderIds){
    const decision=firstContact.choice
      .riderDecisions.find(row=>
        row.riderId===riderId);
    history.set(riderId,riderId===frontId?[
      frontDecision,slideDecision,decision]:[
      firstCatcherDecision,decision]);
  }
  const contacts=[];
  let lastClock=firstContact.event.clockSeconds;
  let lastEvent=firstContact.event;
  for(let count=0;count<startInput.teams
    .reduce((total,team)=>total+
      team.riders.length,0);count++){
    const candidates=
      findPhysicalOrderedBoundaryEventsV1(
        tracks,bunchTrack,km);
    if(candidates.some(row=>
      Math.abs(row.clockSeconds-lastClock)<=.002&&
      (Math.abs(row.atDistanceM-
        lastEvent.atDistanceM)>.002||
        row.roadIds.join('|')!==
          lastEvent.roadIds.join('|'))))
      throw new Error(
        'Caught front needs simultaneous contact source.');
    const events=candidates.filter(row=>
      row.clockSeconds>lastClock+.002);
    if(!events.length)
      return {tracks,contacts,history,
        frontGroupId};
    const event=events[0];
    const frontGroup=tracks.find(row=>
      row.id===frontGroupId);
    const catcher=tracks.find(row=>
      row.id===event.catchingRoadId);
    if(event.involvesBunch||
      !event.roadIds.includes(frontGroupId)||
      event.roadIds.length!==2||
      catcher?.kind!=='solo'||
      !frontGroup||
      event.clockSeconds<=lastClock+.002)
      throw new Error(
        'Caught front needs paid later contact order: '+
        JSON.stringify({event,
          frontGroupId}));
    for(const track of [frontGroup,catcher])
      for(const row of track.rows){
        const paid=trackEnergyAt(track,
          row.riderId,event.metresIntoKm);
        const recorded=event.riders.find(item=>
          item.riderId===row.riderId)
          ?.energyAtContact;
        if(!Number.isFinite(paid)||
          Math.abs(paid-recorded)>.002)
          throw new Error(
            'Caught front breaks later paid approach.');
      }
    const choice=decidePhysicalRearContactV1({
      startInput,km,roadIds:event.roadIds,
      riderIdsByRoad:event.riderIdsByRoad,
      catchingRoadId:event.catchingRoadId,
      observedSecondsPerKmByRoad:event
        .observedSecondsPerKmByRoad,
      leaderRiderId:catcher.riderId});
    if(choice.outcome==='pass_through'){
      for(const track of [frontGroup,catcher])
        for(const row of track.rows){
          const decisions=history.get(
            row.riderId)??[];
          const decision=choice.riderDecisions
            .find(item=>item.riderId===
              row.riderId);
          if(!decision)
            throw new Error(
              'Caught front lacks passage choice.');
          decisions.push(decision);
          history.set(row.riderId,decisions);
        }
      contacts.push({event,choice});
      lastClock=event.clockSeconds;
      lastEvent=event;
      continue;
    }
    if(choice.outcome!=='join')
      throw new Error(
        'Caught front lacks paid later choice.');
    for(const track of [frontGroup,catcher])
      for(const row of track.rows){
        const decisions=history.get(row.riderId)??[];
        decisions.push(row.decision,
          choice.riderDecisions.find(item=>
            item.riderId===row.riderId));
        if(decisions.some(item=>!item))
          throw new Error(
            'Caught front lacks later rider choice.');
        history.set(row.riderId,decisions);
      }
    const riderIds=event.roadIds.flatMap(id=>
      event.riderIdsByRoad[id]);
    const groupId=`rear-event-${
      [...riderIds].sort().join('-')}`;
    const group=pricePhysicalRearEventTrackV1({
      startInput,riderIds,
      energyByRider:Object.fromEntries(
        event.riders.map(row=>[
          row.riderId,row.energyAtContact])),
      km,startM:event.metresIntoKm,
      startClock:event.clockSeconds,
      contactLeaderRiderId:catcher.riderId,
      groupId});
    if(group.rows.filter(row=>
      row.role==='leader').length!==1||
      group.rows.some(row=>
        row.role==='sheltered'&&
          row.draftFraction>=1))
      throw new Error(
        'Caught front needs one paid later leader.');
    tracks=tracks.filter(row=>
      !event.roadIds.includes(row.id));
    tracks.push({...group,id:groupId,
      kind:'group',domainEndM:1000});
    contacts.push({event,choice,
      group:{id:groupId,
        riderIds:[...riderIds],
        leaderRiderId:group.leaderRiderId,
        endClock:group.endClock,
        rows:group.rows}});
    frontGroupId=groupId;
    lastClock=event.clockSeconds;
    lastEvent=event;
  }
  throw new Error(
    'Caught front exceeds paid contact bound.');
}

export function replayPhysicalFrontRearCaughtSlideKmV1(
  input){
  const boundary=
    probePhysicalFrontRearFrontCatchBoundaryV1(
      input);
  const {startInput,catchKm}=input;
  const {contact}=boundary;
  const prior=boundary.sources.prefix.sources.last;
  const bunchStep=boundary.sources.bunchStep;
  const frontId=contact.riderId;
  const event=boundary.orderedContactCandidates[0];
  if(boundary.orderedContactCandidates.length!==1||
    !event.roadIds.includes('peloton')||
    !event.roadIds.includes(`front-${frontId}`)||
    bunchStep.splits.some(split=>
      split.atDistanceM<=contact.atDistanceM))
    throw new Error(
      'Caught front needs first and sole ordered contact: '+
      JSON.stringify({candidates:boundary
        .orderedContactCandidates.map(row=>({
          roadIds:row.roadIds,
          atDistanceM:row.atDistanceM})),
      earlierSplits:bunchStep.splits.filter(split=>
        split.atDistanceM<=contact.atDistanceM)
        .map(split=>({riderId:split.riderId,
          atDistanceM:split.atDistanceM}))}));
  const team=startInput.teams.find(row=>
    row.riders.some(rider=>rider.id===frontId));
  const rider=team.riders.find(row=>
    row.id===frontId);
  const segment=startInput.routeKilometres[
    catchKm-1];
  const order=orderAt(team.orders,catchKm-1);
  const leader=bunchStep.riders.find(row=>
    row.riderId===bunchStep.leaderRiderId);
  const energyAtContact=boundary.frontPartial
    .energyAtContact;
  const holdEffect=riderKilometreEffect(
    rider,segment,{phase:'cruise',
      energy:energyAtContact,
      exposed:segment.exposed});
  const holdAbility=holdEffect.ability+
    (TUNING.effortPressure[order.effort]-1)*20+
    TUNING.breakaway.bunchDraftAdvantage;
  if(holdAbility+1e-9>=leader.holdAbility)
    throw new Error(
      'Caught front can hold; slide needs paid loss.');
  const effort='conserve';
  const soloEffect=riderKilometreEffect(
    rider,segment,{phase:'solo',
      energy:energyAtContact,
      exposed:segment.exposed});
  const soloAbility=soloEffect.ability+
    (TUNING.effortPressure[effort]-1)*20;
  const soloSecondsPerKm=
    segmentBaseSeconds(segment)+
    (50-soloAbility)*
      MOTOR_RACE_DYNAMICS.secondsPerAbilityPoint;
  const contactM=contact.atDistanceM-
    (catchKm-1)*1000;
  const remainingM=1000-contactM;
  const endClock=contact.clockSeconds+
    soloSecondsPerKm*remainingM/1000;
  const bunchPriorClock=prior.riderStates.find(row=>
    row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  const bunchEndClock=bunchPriorClock+
    bunchStep.elapsedSeconds;
  if(!Number.isFinite(soloSecondsPerKm)||
    soloSecondsPerKm<=0||
    !Number.isFinite(bunchEndClock)||
    endClock<=bunchEndClock)
    throw new Error(
      'Caught front lacks paid slide behind bunch.');
  const paid=priceRearEnergyDemandV1({
    rider,segment,energyBefore:energyAtContact,
    effort,role:'solo',distanceM:remainingM});
  const recovery=recoveryForKilometre({
    rider,segment,effort,group:'dropped',
    working:false,quietKm:0});
  if(recovery.recovery!==0)
    throw new Error(
      'Caught front cannot claim bunch recovery.');
  const cap=replayRearEnergyCapV1({rider,
    kilometres:startInput.routeKilometres,
    throughKm:catchKm}).cap;
  const energyAfter=+Math.min(cap,
    paid.energyAfter).toFixed(3);
  const frontTrack={id:`solo-${frontId}`,
    kind:'solo',riderId:frontId,
    riderIds:[frontId],breaks:[],
    domainStartM:contactM,domainEndM:1000,
    clockAt:metres=>contact.clockSeconds+
      soloSecondsPerKm*(metres-contactM)/1000,
    energyAt:metres=>energyAtContact-
      paid.energyDemand*(metres-contactM)/
        remainingM};
  const oldRearTracks=prior.endRearEntities.map(entity=>
    entity.kind==='solo'?
      pricePhysicalRearSoloTrackV1({
        startInput,riderId:entity.riderIds[0],
        energyBefore:entity.energyByRider[
          entity.riderIds[0]],km:catchKm,
        startClock:entity.clock,
        groupId:entity.id}):
      pricePhysicalRearEventTrackV1({
        startInput,riderIds:entity.riderIds,
        energyByRider:entity.energyByRider,
        km:catchKm,startM:0,
        startClock:entity.clock,
        rotationIndex:entity.rotationIndex,
        groupId:entity.id}))
    .map(track=>({...track,id:track.groupId,
      kind:track.kind??'group',
      domainStartM:0,domainEndM:1000}));
  const splitCompletions=bunchStep.splits.map(split=>
    completePhysicalFrontBunchLossFromStepV1({
      startInput,lossKm:catchKm,step:bunchStep,
      bunchElapsedSeconds:bunchEndClock,
      riderId:split.riderId}));
  const splitTracks=splitCompletions.map(completion=>{
    const split=bunchStep.splits.find(row=>
      row.riderId===completion.riderId);
    const track=staggeredSoloTrajectoryV1({
      riderId:completion.riderId,
      lossKm:catchKm,completion},catchKm,
    bunchPriorClock,bunchStep);
    const id=`solo-${completion.riderId}`;
    return {...track,id,groupId:id,
      riderId:completion.riderId,
      riderIds:[completion.riderId],
      kind:'solo',
      domainStartM:split.atDistanceM-
        (catchKm-1)*1000,
      domainEndM:1000,
      endClock:completion.elapsedSeconds,
      rows:[{riderId:completion.riderId,
        decision:completion.decision,
        energyBefore:completion.energyBefore,
        energySpent:completion.energySpent,
        energyAfter:completion.energyAfter}]};
  });
  const rearTracks=[...oldRearTracks,
    ...splitTracks];
  const bunchTrack={id:'peloton',
    riderId:'peloton',riderIds:[],breaks:[],
    domainStartM:contactM,
    domainEndM:1000,
    clockAt:metres=>bunchPriorClock+
      bunchStep.elapsedSeconds*metres/1000};
  const slideDecision={riderId:frontId,
    sourceGoal:boundary.sources.front
      .frontDecision.goal,
    goal:'finish_safely',
    teamOrderEffort:order.effort,effort,
    choice:'slide_through',
    reason:'cannot_hold_paid_bunch_pace'};
  const laterEvents=
    findPhysicalOrderedBoundaryEventsV1([
      frontTrack,...rearTracks],bunchTrack,
    catchKm).filter(row=>
      row.clockSeconds>
        contact.clockSeconds+.002);
  let nextContact=null;
  let endRearTracks=rearTracks;
  let contactChain=null;
  if(laterEvents.length){
    const next=laterEvents[0];
    if(next.involvesBunch||
      !next.roadIds.includes(frontTrack.id)||
      next.roadIds.length!==2||
      next.catchingRoadId===frontTrack.id)
      throw new Error(
        'Caught front needs ordered rear contact source: '+
        JSON.stringify(laterEvents.map(row=>({
          roadIds:row.roadIds,
          atDistanceM:row.atDistanceM,
          catchingRoadId:row.catchingRoadId}))));
    const catcher=[frontTrack,...rearTracks].find(
      row=>row.id===next.catchingRoadId);
    if(catcher?.kind!=='solo')
      throw new Error(
        'Caught front needs paid rear solo approach.');
    const choice=decidePhysicalRearContactV1({
      startInput,km:catchKm,
      roadIds:next.roadIds,
      riderIdsByRoad:next.riderIdsByRoad,
      catchingRoadId:next.catchingRoadId,
      observedSecondsPerKmByRoad:next
        .observedSecondsPerKmByRoad,
      leaderRiderId:catcher.leaderRiderId??
        catcher.riderId});
    if(choice.outcome!=='join')
      throw new Error(
        'Caught front needs paid pass-through source.');
    const frontEnergyAtRear=next.riders.find(row=>
      row.riderId===frontId)
      ?.energyAtContact;
    const catcherEnergyAtRear=next.riders.find(
      row=>row.riderId===catcher.riderId)
      ?.energyAtContact;
    if(Math.abs(frontTrack.energyAt(
      next.metresIntoKm)-
      frontEnergyAtRear)>.002||
      Math.abs(catcher.energyAt(
        next.metresIntoKm)-
        catcherEnergyAtRear)>.002)
      throw new Error(
        'Caught front breaks paid rear approach.');
    const slidePartial=priceRearEnergyDemandV1({
      rider,segment,
      energyBefore:energyAtContact,
      effort,role:'solo',
      distanceM:next.metresIntoKm-
        contactM});
    if(Math.abs(slidePartial.energyAfter-
      frontEnergyAtRear)>.002)
      throw new Error(
        'Caught front lacks paid slide to rear contact.');
    const riderIds=next.roadIds.flatMap(id=>
      next.riderIdsByRoad[id]);
    const groupId=`rear-event-${
      [...riderIds].sort().join('-')}`;
    const group=pricePhysicalRearEventTrackV1({
      startInput,riderIds,
      energyByRider:Object.fromEntries(
        next.riders.map(row=>[
          row.riderId,row.energyAtContact])),
      km:catchKm,startM:next.metresIntoKm,
      startClock:next.clockSeconds,
      contactLeaderRiderId:catcher.leaderRiderId??
        catcher.riderId,groupId});
    const afterTracks=rearTracks.filter(row=>
      !next.roadIds.includes(row.id));
    afterTracks.push({...group,id:groupId,
      kind:'group',
      domainEndM:1000});
    const after=findPhysicalOrderedBoundaryEventsV1(
      afterTracks,bunchTrack,catchKm)
      .filter(row=>row.clockSeconds>
        next.clockSeconds+.002);
    if(group.rows.filter(row=>
        row.role==='leader').length!==1||
      group.rows.some(row=>row.role==='sheltered'&&
        row.draftFraction>=1))
      throw new Error(
        'Caught front needs one paid contact leader.');
    nextContact={event:next,choice,
      group:{id:groupId,
        riderIds:[...riderIds],
        leaderRiderId:group.leaderRiderId,
        endClock:group.endClock,
        rows:group.rows},
      frontEnergyAtRear,
      catcherEnergyAtRear};
    endRearTracks=afterTracks;
    if(after.length){
      contactChain=settleLaterFrontRearContacts({
        startInput,km:catchKm,
        rearTracks:afterTracks,bunchTrack,
        firstContact:nextContact,
        firstCatcherDecision:
          catcherTrackDecision(catcher.riderId,
            rearTracks),
        frontId,
        frontDecision:boundary.sources.front
          .frontDecision,
        slideDecision});
      endRearTracks=contactChain.tracks;
    }
  }
  const decisions=new Map(bunchStep
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=bunchStep.physicalGroup
    .riderIds.map(riderId=>({
      riderId,sourceKm:catchKm,
      physicalGroupId:'peloton',
      atDistanceM:catchKm*1000,
      elapsedSeconds:bunchEndClock,
      energyAfter:bunchStep.energyByRider[
        riderId],
      decisions:[decisions.get(riderId)]}));
  const frontState=nextContact?null:{riderId:frontId,
    sourceKm:catchKm,
    physicalGroupId:frontTrack.id,
    atDistanceM:catchKm*1000,
    elapsedSeconds:endClock,energyAfter,
    decisions:[boundary.sources.front
      .frontDecision,slideDecision]};
  const rearStates=endRearTracks.flatMap(track=>
    track.rows.map(row=>({
      riderId:row.riderId,
      sourceKm:catchKm,
      physicalGroupId:track.id,
      atDistanceM:catchKm*1000,
      elapsedSeconds:track.endClock,
      energyAfter:row.energyAfter,
      decisions:contactChain?.history.has(
        row.riderId)?[
          ...contactChain.history.get(
            row.riderId),row.decision]:
        nextContact&&track.id===
        nextContact.group.id?
        row.riderId===frontId?[
          boundary.sources.front.frontDecision,
          slideDecision,
          nextContact.choice.riderDecisions.find(
            item=>item.riderId===row.riderId),
          row.decision]:[
          catcherTrackDecision(row.riderId,
            rearTracks),
          nextContact.choice.riderDecisions.find(
            item=>item.riderId===row.riderId),
          row.decision]:[row.decision]})));
  const roster=[...input.start.riderIds];
  const states=new Map([...bunchStates,
    ...(frontState?[frontState]:[]),
    ...rearStates].map(row=>[
      row.riderId,row]));
  if(states.size!==roster.length||
    roster.some(id=>{
      const before=prior.riderStates.find(row=>
        row.riderId===id);
      const after=states.get(id);
      return !before||!after||
        after.elapsedSeconds<=
          before.elapsedSeconds||
        !Number.isFinite(after.energyAfter)||
        after.energyAfter<0||
        !after.decisions.length||
        after.decisions.some(row=>!row);
    }))
    throw new Error(
      'Caught front kilometre lacks full field.');
  const oldEntities=new Map(prior.endRearEntities
    .map(row=>[row.id,row]));
  const endRearEntities=endRearTracks.map(track=>{
    const old=oldEntities.get(track.id);
    if(track.kind!=='solo'&&
      track.kind!=='group')
      throw new Error(
        'Caught front lacks sourced rear group.');
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:catchKm*1000,
      clock:track.endClock,
      energyByRider:Object.fromEntries(
        track.rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:old?
          (old.rotationIndex+1)%
            track.riderIds.length:0,
        formedKm:old?.formedKm??catchKm}:{})};
  });
  if(frontState)
    endRearEntities.push({id:frontTrack.id,
      kind:'solo',riderIds:[frontId],
      atDistanceM:catchKm*1000,
      clock:endClock,
      energyByRider:{[frontId]:energyAfter}});
  const frontAfter=states.get(frontId);
  const totalFrontEnergySpent=
    prior.endFrontState.energyAfter-
      frontAfter.energyAfter;
  const finalFrontGroup=contactChain?
    endRearTracks.find(row=>row.id===
      contactChain.frontGroupId):
    nextContact?.group;
  const frontGroupRow=finalFrontGroup?.rows.find(
    row=>row.riderId===frontId);
  const expectedFrontSpent=boundary.frontPartial
    .energySpent+(nextContact?
      energyAtContact-
        frontGroupRow.energyBefore+
        frontGroupRow.energySpent:
      paid.energyDemand);
  if(totalFrontEnergySpent<=0||
    !Number.isFinite(totalFrontEnergySpent)||
    Math.abs(totalFrontEnergySpent-
      expectedFrontSpent)>.003)
    throw new Error(
      'Caught front lacks paid end energy.');
  return {version:contactChain?
    PHYSICAL_FRONT_REAR_CAUGHT_SLIDE_CHAIN_KM_VERSION:
    PHYSICAL_FRONT_REAR_CAUGHT_SLIDE_KM_VERSION,
    sourceKm:catchKm,contact,
    ...(nextContact?{nextContact}:{}),
    ...(contactChain?{
      additionalContacts:
        contactChain.contacts}:{}),
    holdAbility,
    bunchLeaderAbility:leader.holdAbility,
    gapSecondsToBunch:(nextContact?
      finalFrontGroup.endClock:endClock)-
      bunchEndClock,
    frontRemainingEnergySpent:
      contactChain?
        energyAtContact-frontAfter.energyAfter:
      nextContact?
        energyAtContact-
        nextContact.frontEnergyAtRear:
        paid.energyDemand,
    frontRecoveryAward:0,
    totalFrontEnergySpent,
    riderStates:roster.map(id=>states.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:bunchStates
      .map(row=>row.riderId),
      energyByRider:Object.fromEntries(
        bunchStates.map(row=>[
          row.riderId,row.energyAfter])),
      quietKmByRider:Object.fromEntries(
        bunchStates.map(row=>[
          row.riderId,bunchStep
            .quietKmByRider[row.riderId]??0]))},
    endRearEntities,
    fieldKilometreIncomplete:false,
    sources:{boundary,slideDecision,
      laterEvents,splitCompletions,
      ...(contactChain?{
        additionalContacts:
          contactChain.contacts}:{})},
    remainingRaceUnsettled:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalFrontRearCaughtSlideKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearCaughtSlideKmV1(input)))
    throw new Error(
      'Caught front kilometre differs from paid source.');
  return true;
}
