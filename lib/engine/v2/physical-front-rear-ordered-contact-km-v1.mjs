// Finish a front/rear kilometre only after both measured rear joins
// have been paid in chronological order and no later road meets.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {sourcePhysicalFrontRearSecondBoundaryV1,
  resolvePhysicalFrontRearSecondContactV1} from
  './physical-front-rear-second-contact-v1.mjs';
import {pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_ORDERED_CONTACT_KM_VERSION=
  'v2-physical-front-rear-ordered-contact-km-1';
const EPS=.002;

export function replayPhysicalFrontRearOrderedContactKmV1({
  startInput,prior}){
  const firstSource=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const secondSource=
    sourcePhysicalFrontRearSecondBoundaryV1({
      startInput,prior});
  const second=
    resolvePhysicalFrontRearSecondContactV1({
      startInput,prior});
  const first=second.firstContact;
  const km=second.sourceKm;
  const step=firstSource.step;
  const frontStep=firstSource.frontStep;
  if(step.splits.length||
    first.choice.outcome!=='join'||
    second.choice.outcome!=='join'||
    second.nextCandidateEvent||
    !isDeepStrictEqual(first.event,
      firstSource.recording.firstCandidateEvent)||
    !isDeepStrictEqual(second.event,
      secondSource.recording.firstCandidateEvent))
    throw new Error(
      'Front-rear contact km needs settled ordered joins.');
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
      'Front-rear contact km breaks final group road.');
  const remaining=secondSource.tracks.filter(track=>
    !second.event.roadIds.includes(track.id));
  if(findPhysicalOrderedBoundaryEventsV1([
    ...remaining,{...finalTrack,
      id:finalGroup.id,kind:'group',
      domainEndM:1000}],
    secondSource.bunch,km).length)
    throw new Error(
      'Front-rear contact km has later meeting.');
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const oldStates=new Map(prior.riderStates.map(row=>
    [row.riderId,row]));
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
  const firstGroup=secondSource.tracks.find(track=>
    track.id===first.candidateGroupRoad.id);
  if(!firstGroup||
    firstGroup.kind!=='group')
    throw new Error(
      'Front-rear contact km lacks intermediate group.');
  const rearStates=[];
  const endRearEntities=[];
  for(const track of remaining){
    if(track.id===`front-${
      prior.endFrontState.riderId}`)
      continue;
    const old=oldEntities.get(track.id);
    if(!old||old.kind!=='solo'||
      track.kind!=='solo'||
      track.rows.length!==1||
      Math.abs(old.clock-track.startClock)>EPS||
      Math.abs(old.energyByRider[
        track.riderId]-
        track.rows[0].energyBefore)>EPS)
      throw new Error(
        'Front-rear contact km lacks prior solo.');
    const row=track.rows[0];
    rearStates.push({riderId:row.riderId,
      sourceKm:km,physicalGroupId:track.id,
      atDistanceM:km*1000,
      elapsedSeconds:track.endClock,
      energyAfter:row.energyAfter,
      decisions:[row.decision]});
    endRearEntities.push({id:track.id,
      kind:'solo',riderIds:[row.riderId],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider:{[row.riderId]:
        row.energyAfter}});
  }
  for(const row of finalTrack.rows){
    const old=oldStates.get(row.riderId);
    const secondApproach=secondApproaches.get(
      row.riderId);
    const secondChoice=secondChoices.get(
      row.riderId);
    if(!old||!secondApproach||
      !secondChoice||
      Math.abs(secondApproach
        .energyAtContact-
        row.energyBefore)>EPS)
      throw new Error(
        'Front-rear contact km lacks second approach.');
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
        Math.abs(middle.energyBefore-
          firstApproach.energyAtContact)>EPS||
        Math.abs(atSecond-
          secondApproach.energyAtContact)>EPS||
        Math.abs(middle.energyBefore-
          secondApproach.energyBefore)>EPS)
        throw new Error(
          'Front-rear contact km breaks first paid join.');
      decisions=[firstApproach.decision,
        firstChoice,middle.decision,
        secondChoice,row.decision];
    }else{
      if(Math.abs(secondApproach.energyBefore-
        old.energyAfter)>EPS)
        throw new Error(
          'Front-rear contact km breaks solo approach.');
      decisions=[secondApproach.decision,
        secondChoice,row.decision];
    }
    rearStates.push({riderId:row.riderId,
      sourceKm:km,
      physicalGroupId:finalGroup.id,
      atDistanceM:km*1000,
      elapsedSeconds:finalTrack.endClock,
      energyAfter:row.energyAfter,decisions});
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
  const bunchBefore=oldStates.get(step
    .physicalGroup.riderIds[0])
    ?.elapsedSeconds;
  const bunchClock=bunchBefore+
    step.elapsedSeconds;
  const bunchDecisions=new Map(step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=step.physicalGroup.riderIds
    .map(riderId=>({riderId,
      sourceKm:km,physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:bunchClock,
      energyAfter:step.energyByRider[riderId],
      decisions:[bunchDecisions.get(riderId)]}));
  const frontRiderId=prior.endFrontState.riderId;
  const frontState={riderId:frontRiderId,
    sourceKm:km,
    physicalGroupId:frontStep.physicalGroup.id,
    atDistanceM:km*1000,
    elapsedSeconds:frontStep.elapsedSeconds,
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
      'Front-rear contact km lacks full paid field.');
  return {version:
    PHYSICAL_FRONT_REAR_ORDERED_CONTACT_KM_VERSION,
    sourceKm:km,
    sources:{firstBoundary:firstSource.recording,
      secondBoundary:secondSource.recording,
      secondContact:second},
    riderStates:roster.map(id=>byId.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:[
      ...step.physicalGroup.riderIds],
      energyByRider:Object.fromEntries(
        step.physicalGroup.riderIds.map(id=>[
          id,step.energyByRider[id]])),
      quietKmByRider:Object.fromEntries(
        step.physicalGroup.riderIds.map(id=>[
          id,step.quietKmByRider[id]]))},
    endFrontState:{riderId:frontRiderId,
      elapsedSeconds:frontStep.elapsedSeconds,
      energyAfter:frontStep.energyAfter,
      gapSecondsToBunch:frontStep
        .gapSecondsToBunch},
    endRearEntities,
    physicalGroups:[step.physicalGroup,
      frontStep.physicalGroup,
      ...endRearEntities.map(entity=>({
        id:entity.id,
        riderIds:entity.riderIds,
        atDistanceM:km*1000}))],
    fieldKilometreIncomplete:false,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontRearOrderedContactKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearOrderedContactKmV1(input)))
    throw new Error(
      'Front-rear contact km differs from paid source.');
  return true;
}
