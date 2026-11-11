// Complete a front/rear kilometre after one solo enters bunch shelter
// and two later, measured rear joins form a separate paid group.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {sourcePhysicalFrontRearBunchSecondBoundaryV1,
  resolvePhysicalFrontRearBunchSecondContactV1} from
  './physical-front-rear-bunch-then-second-rear-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_BUNCH_TWO_REAR_KM_VERSION=
  'v2-physical-front-rear-bunch-two-rear-km-1';
const EPS=.002;

export function replayPhysicalFrontRearBunchTwoRearKmV1({
  startInput,prior}){
  const firstSource=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const secondSource=
    sourcePhysicalFrontRearBunchSecondBoundaryV1({
      startInput,prior});
  const second=
    resolvePhysicalFrontRearBunchSecondContactV1({
      startInput,prior});
  const first=second.firstContact;
  const joined=secondSource.recording.sources
    .firstContact.sources.boundary.sources
    .joined;
  const km=second.sourceKm;
  if(firstSource.step.splits.length||
    first.choice.outcome!=='join'||
    second.choice.outcome!=='join'||
    second.nextCandidateEvent||
    !isDeepStrictEqual(first.event,
      first.sources.boundary
        .firstCandidateEvent)||
    !isDeepStrictEqual(second.event,
      secondSource.recording
        .firstCandidateEvent)||
    !joined.sources.paidJoin)
    throw new Error(
      'Post-bunch two-rear km needs settled paid events.');
  const finalGroup=second.candidateGroupRoad;
  const finalTrack=pricePhysicalRearEventTrackV1({
    startInput,riderIds:finalGroup.riderIds,
    energyByRider:Object.fromEntries(
      second.event.riders.map(row=>[
        row.riderId,row.energyAtContact])),
    km,startM:second.event.metresIntoKm,
    startClock:second.event.clockSeconds,
    contactLeaderRiderId:
      finalGroup.leaderRiderId,
    groupId:finalGroup.id});
  if(!isDeepStrictEqual(finalTrack.rows,
    finalGroup.riders))
    throw new Error(
      'Post-bunch two-rear km breaks final group.');
  const remaining=secondSource.tracks.filter(
    track=>!second.event.roadIds
      .includes(track.id));
  if(findPhysicalOrderedBoundaryEventsV1([
    ...remaining,{...finalTrack,
      id:finalGroup.id,kind:'group',
      domainEndM:1000}],
    secondSource.bunch,km).length)
    throw new Error(
      'Post-bunch two-rear km has later contact.');
  const oldStates=new Map(prior.riderStates
    .map(row=>[row.riderId,row]));
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const firstApproaches=new Map(first
    .paidApproaches.map(row=>[
      row.riderId,row]));
  const firstChoices=new Map(first.choice
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const secondApproaches=new Map(second
    .paidApproaches.map(row=>[
      row.riderId,row]));
  const secondChoices=new Map(second.choice
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const firstGroup=secondSource.tracks.find(
    track=>track.id===first
      .candidateGroupRoad.id);
  if(!firstGroup||
    firstGroup.kind!=='group')
    throw new Error(
      'Post-bunch two-rear km lacks middle road.');
  const rearStates=[];
  const endRearEntities=[];
  for(const track of remaining){
    if(track.id===`front-${prior.endFrontState
      .riderId}`)
      continue;
    const old=oldEntities.get(track.id);
    if(!old||
      !isDeepStrictEqual(old.riderIds,
        track.riderIds)||
      Math.abs(old.clock-
        track.startClock)>EPS)
      throw new Error(
        'Post-bunch two-rear km lacks prior road.');
    for(const row of track.rows){
      if(Math.abs(old.energyByRider[
        row.riderId]-
        row.energyBefore)>EPS)
        throw new Error(
          'Post-bunch two-rear km breaks energy.');
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
        'Post-bunch two-rear km lacks one leader.');
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
  for(const row of finalTrack.rows){
    const old=oldStates.get(row.riderId);
    const approach=secondApproaches.get(
      row.riderId);
    const choice=secondChoices.get(
      row.riderId);
    if(!old||!approach||!choice||
      Math.abs(approach.energyAtContact-
        row.energyBefore)>EPS)
      throw new Error(
        'Post-bunch two-rear km lacks second approach.');
    let decisions;
    if(firstApproaches.has(row.riderId)){
      const firstApproach=firstApproaches.get(
        row.riderId);
      const firstChoice=firstChoices.get(
        row.riderId);
      const middle=firstGroup.rows.find(item=>
        item.riderId===row.riderId);
      const atSecond=firstGroup.energyAt(
        second.event.metresIntoKm)
        .find(item=>item.riderId===
          row.riderId)?.energyAtContact;
      if(!firstChoice||!middle||
        Math.abs(firstApproach.energyBefore-
          old.energyAfter)>EPS||
        Math.abs(firstApproach.energyAtContact-
          middle.energyBefore)>EPS||
        Math.abs(middle.energyBefore-
          approach.energyBefore)>EPS||
        Math.abs(atSecond-
          approach.energyAtContact)>EPS)
        throw new Error(
          'Post-bunch two-rear km breaks first group.');
      decisions=[firstApproach.decision,
        firstChoice,middle.decision,
        choice,row.decision];
    }else{
      if(Math.abs(approach.energyBefore-
        old.energyAfter)>EPS)
        throw new Error(
          'Post-bunch two-rear km breaks solo approach.');
      decisions=[approach.decision,
        choice,row.decision];
    }
    rearStates.push({riderId:row.riderId,
      sourceKm:km,
      physicalGroupId:finalGroup.id,
      atDistanceM:km*1000,
      elapsedSeconds:finalTrack.endClock,
      energyAfter:row.energyAfter,
      decisions});
  }
  endRearEntities.push({id:finalGroup.id,
    kind:'group',riderIds:[
      ...finalGroup.riderIds],
    atDistanceM:km*1000,
    clock:finalTrack.endClock,
    energyByRider:Object.fromEntries(
      finalTrack.rows.map(row=>[
        row.riderId,row.energyAfter])),
    rotationIndex:0,formedKm:km});
  const paidJoin=joined.sources.paidJoin;
  const contact=joined.sources.contact;
  const bunchDecisions=new Map(firstSource.step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=firstSource.step
    .physicalGroup.riderIds.map(riderId=>({
      riderId,sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:paidJoin.bunchEndClock,
      energyAfter:firstSource.step
        .energyByRider[riderId],
      decisions:[bunchDecisions.get(riderId)]}));
  const joinedOld=oldStates.get(paidJoin.riderId);
  if(!joinedOld||
    Math.abs(joinedOld.energyAfter-
      contact.soloEnergyBefore)>EPS||
    Math.abs(contact.energyAtContact-
      paidJoin.decision.energyAtContact)>EPS)
    throw new Error(
      'Post-bunch two-rear km breaks bunch join.');
  bunchStates.push({riderId:paidJoin.riderId,
    sourceKm:km,
    physicalGroupId:'peloton',
    atDistanceM:km*1000,
    elapsedSeconds:paidJoin.bunchEndClock,
    energyAfter:paidJoin.energyAfter,
    decisions:[{...contact.soloDecision,
      choice:'ride_to_paid_bunch_contact',
      distanceM:contact.metresIntoKm,
      energyBefore:contact.soloEnergyBefore,
      energySpent:contact
        .soloEnergySpentToContact,
      energyAtContact:contact
        .energyAtContact},
      paidJoin.decision]});
  const frontRiderId=prior.endFrontState.riderId;
  const frontStep=firstSource.frontStep;
  const frontState={riderId:frontRiderId,
    sourceKm:km,
    physicalGroupId:frontStep
      .physicalGroup.id,
    atDistanceM:km*1000,
    elapsedSeconds:frontStep
      .elapsedSeconds,
    energyAfter:frontStep.energyAfter,
    decisions:[frontStep.decision]};
  const byId=new Map([...bunchStates,
    frontState,...rearStates].map(row=>[
      row.riderId,row]));
  const roster=startInput.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  if(byId.size!==roster.length||
    byId.size!==bunchStates.length+
      1+rearStates.length||
    roster.some(riderId=>{
      const before=oldStates.get(riderId);
      const after=byId.get(riderId);
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
      'Post-bunch two-rear km lacks full paid field.');
  return {version:
    PHYSICAL_FRONT_REAR_BUNCH_TWO_REAR_KM_VERSION,
    sourceKm:km,
    sources:{firstBoundary:firstSource.recording,
      secondBoundary:secondSource.recording,
      secondContact:second},
    riderStates:roster.map(id=>byId.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:bunchStates
      .map(row=>row.riderId),
      energyByRider:{...Object.fromEntries(
        firstSource.step.physicalGroup
          .riderIds.map(id=>[id,
            firstSource.step
              .energyByRider[id]])),
        [paidJoin.riderId]:paidJoin
          .energyAfter},
      quietKmByRider:{...Object.fromEntries(
        firstSource.step.physicalGroup
          .riderIds.map(id=>[id,
            firstSource.step
              .quietKmByRider[id]])),
        [paidJoin.riderId]:0}},
    endFrontState:{riderId:frontRiderId,
      elapsedSeconds:frontStep
        .elapsedSeconds,
      energyAfter:frontStep
        .energyAfter,
      gapSecondsToBunch:frontStep
        .gapSecondsToBunch},
    endRearEntities,
    physicalGroups:[{id:'peloton',
      riderIds:bunchStates.map(row=>
        row.riderId),
      atDistanceM:km*1000},
    frontStep.physicalGroup,
    ...endRearEntities.map(entity=>({
      id:entity.id,
      riderIds:entity.riderIds,
      atDistanceM:km*1000}))],
    fieldKilometreIncomplete:false,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontRearBunchTwoRearKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearBunchTwoRearKmV1(input)))
    throw new Error(
      'Post-bunch two-rear km differs from paid source.');
  return true;
}
