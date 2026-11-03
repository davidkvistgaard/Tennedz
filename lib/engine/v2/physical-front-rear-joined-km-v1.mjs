// Settle sequential rear-to-rear joins within one front/rear kilometre.
// Every road segment is priced from its measured start clock and energy;
// front, bunch, pass-through and simultaneous contacts remain guarded.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {decidePhysicalRearContactV1} from
  './physical-rear-contact-choice-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_JOINED_KM_VERSION=
  'v2-physical-front-rear-joined-km-1';
const EPS=.002;

function energyAt(track,riderId,metres){
  const raw=track.energyAt(metres);
  return Array.isArray(raw)?raw.find(row=>
    row.riderId===riderId)
    ?.energyAtContact:raw;
}

export function replayPhysicalFrontRearJoinedKmV1({
  startInput,prior}){
  const source=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const km=source.recording.sourceKm;
  if(!source.recording.fieldKilometreIncomplete||
    source.step.splits.length)
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
  if(ledger.size!==prior.endRearEntities
    .reduce((count,entity)=>count+
      entity.riderIds.length,0)||
    [...ledger.values()].some(row=>
      !Number.isFinite(row.energy)))
    throw new Error(
      'Joined front-rear km lacks prior rear ledger.');
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  let tracks=[...source.tracks];
  let events=findPhysicalOrderedBoundaryEventsV1(
    tracks,source.bunch,km);
  if(!isDeepStrictEqual(events[0]??null,
    source.recording.firstCandidateEvent))
    throw new Error(
      'Joined front-rear km breaks first boundary.');
  const contacts=[];
  let lastMetres=0;
  while(events.length){
    const event=events[0];
    const roads=event.roadIds.map(id=>
      id==='peloton'?source.bunch:
        tracks.find(track=>track.id===id));
    if(contacts.length>=roster.length||
      event.roadIds.some(id=>
        id===`front-${prior.endFrontState
          .riderId}`)||
      roads.some(track=>!track)||
      !event.catchingRoadId||
      event.metresIntoKm<=lastMetres+1e-6||
      event.metresIntoKm>=1000)
      throw new Error(
        'Joined front-rear km needs ordered rear catch: '+
        JSON.stringify({event,lastMetres,
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
    }
    const catching=roads.find(road=>
      road.id===event.catchingRoadId);
    const choiceInput={startInput,km,
      roadIds:event.roadIds,
      riderIdsByRoad:event.riderIdsByRoad,
      catchingRoadId:event.catchingRoadId,
      observedSecondsPerKmByRoad:
        event.observedSecondsPerKmByRoad,
      leaderRiderId:catching.leaderRiderId};
    const firstChoice=decidePhysicalRearContactV1(
      choiceInput);
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
        entry.segments.push(segment);
        entry.decisions.push(row.decision);
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
        catching.leaderRiderId,
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
      paidApproaches,
      groupRoad:{id:groupId,
        riderIds:[...riderIds],
        leaderRiderId:groupTrack
          .leaderRiderId,
        endClock:groupTrack.endClock,
        rows:groupTrack.rows}});
    lastMetres=event.metresIntoKm;
    events=findPhysicalOrderedBoundaryEventsV1(
      tracks,source.bunch,km);
  }
  const rearStates=[];
  const endRearEntities=[];
  for(const track of tracks){
    if(track.id===`front-${prior.endFrontState
      .riderId}`)
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
  const frontRiderId=prior.endFrontState.riderId;
  const frontState={riderId:frontRiderId,
    sourceKm:km,
    physicalGroupId:source.frontStep
      .physicalGroup.id,
    atDistanceM:km*1000,
    elapsedSeconds:source.frontStep
      .elapsedSeconds,
    energyAfter:source.frontStep
      .energyAfter,
    decisions:[source.frontStep.decision]};
  const states=new Map([...bunchStates,
    frontState,...rearStates].map(row=>[
      row.riderId,row]));
  if(states.size!==roster.length||
    states.size!==bunchStates.length+
      1+rearStates.length||
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
  return {version:PHYSICAL_FRONT_REAR_JOINED_KM_VERSION,
    sourceKm:km,
    sources:{boundary:source.recording,
      contacts,
      rearSegments:[...ledger].flatMap(
        ([,entry])=>entry.segments)},
    riderStates:roster.map(id=>states.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:[
      ...source.step.physicalGroup.riderIds],
      energyByRider:Object.fromEntries(
        source.step.physicalGroup.riderIds
          .map(id=>[id,source.step
            .energyByRider[id]])),
      quietKmByRider:Object.fromEntries(
        source.step.physicalGroup.riderIds
          .map(id=>[id,source.step
            .quietKmByRider[id]]))},
    endFrontState:{riderId:frontRiderId,
      elapsedSeconds:source.frontStep
        .elapsedSeconds,
      energyAfter:source.frontStep
        .energyAfter,
      gapSecondsToBunch:source.frontStep
        .gapSecondsToBunch},
    endRearEntities,
    physicalGroups:[source.step.physicalGroup,
      source.frontStep.physicalGroup,
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
