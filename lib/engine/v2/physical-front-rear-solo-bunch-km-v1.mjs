// Resolve a measured rear solo's bunch catch while a paid front rider
// and all other rear roads remain separately sourced.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {measurePhysicalOrderedRearSoloBunchContactV1} from
  './physical-ordered-rear-continuation-bunch-contact-v1.mjs';
import {pricePhysicalOrderedRearSoloBunchJoinV1} from
  './physical-ordered-rear-continuation-bunch-join-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_SOLO_BUNCH_KM_VERSION=
  'v2-physical-front-rear-solo-bunch-km-1';
const EPS=.002;

export function replayPhysicalFrontRearSoloBunchKmV1({
  startInput,prior}){
  const {recording:boundary,tracks,bunch,
    step,frontStep}=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const event=boundary.firstCandidateEvent;
  const km=boundary.sourceKm;
  const soloId=event?.roadIds.find(id=>
    id!=='peloton');
  const solo=tracks.find(track=>
    track.id===soloId);
  const bunchStartClock=prior.riderStates.find(
    row=>row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  const next={sourceKm:km,step,
    bunchStartClock};
  if(!boundary.fieldKilometreIncomplete||
    step.splits.length||
    !event?.involvesBunch||
    !solo||solo.kind!=='solo'||
    !event.roadIds.includes('peloton')||
    event.roadIds.length!==2)
    throw new Error(
      'Front-rear solo bunch km needs measured old solo catch.');
  const contact=
    measurePhysicalOrderedRearSoloBunchContactV1({
      startInput,next,event,solo});
  const paidJoin=
    pricePhysicalOrderedRearSoloBunchJoinV1({
      startInput,next,contact});
  const remaining=tracks.filter(track=>
    track.id!==soloId);
  const laterEvents=
    findPhysicalOrderedBoundaryEventsV1(
      remaining,bunch,km);
  if(laterEvents.length)
    return {version:
      PHYSICAL_FRONT_REAR_SOLO_BUNCH_KM_VERSION,
      sourceKm:km,
      sources:{boundary,contact,paidJoin},
      firstUnresolvedEvent:laterEvents[0],
      fieldKilometreIncomplete:true,
      movesGuidedRace:false,
      officialResults:false};
  const oldStates=new Map(prior.riderStates
    .map(row=>[row.riderId,row]));
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
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
        'Front-rear solo bunch km lacks prior road.');
    for(const row of track.rows){
      if(Math.abs(old.energyByRider[
        row.riderId]-
        row.energyBefore)>EPS)
        throw new Error(
          'Front-rear solo bunch km breaks rear energy.');
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
        'Front-rear solo bunch km lacks one leader.');
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
  const bunchDecisions=new Map(step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=step.physicalGroup
    .riderIds.map(riderId=>({
      riderId,sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:paidJoin.bunchEndClock,
      energyAfter:step.energyByRider[riderId],
      decisions:[bunchDecisions.get(riderId)]}));
  const before=oldStates.get(paidJoin.riderId);
  if(!before||
    Math.abs(before.energyAfter-
      contact.soloEnergyBefore)>EPS||
    Math.abs(contact.energyAtContact-
      paidJoin.decision.energyAtContact)>EPS)
    throw new Error(
      'Front-rear solo bunch km breaks paid approach.');
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
      energySpent:
        contact.soloEnergySpentToContact,
      energyAtContact:
        contact.energyAtContact},
      paidJoin.decision]});
  const frontRiderId=prior.endFrontState.riderId;
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
      'Front-rear solo bunch km lacks full paid field.');
  return {version:
    PHYSICAL_FRONT_REAR_SOLO_BUNCH_KM_VERSION,
    sourceKm:km,
    sources:{boundary,contact,paidJoin},
    riderStates:roster.map(id=>byId.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:bunchStates
      .map(row=>row.riderId),
      energyByRider:{...Object.fromEntries(
        step.physicalGroup.riderIds
          .map(id=>[id,step
            .energyByRider[id]])),
        [paidJoin.riderId]:paidJoin
          .energyAfter},
      quietKmByRider:{...Object.fromEntries(
        step.physicalGroup.riderIds
          .map(id=>[id,step
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

export function validatePhysicalFrontRearSoloBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearSoloBunchKmV1(input)))
    throw new Error(
      'Front-rear solo bunch km differs from paid source.');
  return true;
}
