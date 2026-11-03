// Complete the front/rear kilometre only after a paid rear pair meets
// the bunch, both members can hold its pace, and no later road meets.
import {isDeepStrictEqual} from 'node:util';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {probePhysicalFrontRearGroupBunchContactV1} from
  './physical-front-rear-group-bunch-contact-v1.mjs';
import {pricePhysicalOrderedRearGroupBunchJoinV1} from
  './physical-ordered-rear-group-bunch-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_GROUP_BUNCH_KM_VERSION=
  'v2-physical-front-rear-group-bunch-km-1';
const EPS=.002;

export function replayPhysicalFrontRearGroupBunchKmV1({
  startInput,prior}){
  const source=
    sourcePhysicalFrontRearBoundaryFromStateV1({
      startInput,prior});
  const probe=probePhysicalFrontRearGroupBunchContactV1({
    startInput,prior});
  const joined=probe.sources.joined;
  const formation=joined.sources.contacts.at(-1);
  const km=joined.sourceKm;
  const bunchStartClock=prior.riderStates.find(
    row=>row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  const next={sourceKm:km,
    step:source.step,bunchStartClock};
  const paidJoin=
    pricePhysicalOrderedRearGroupBunchJoinV1({
      startInput,next,contact:probe.contact});
  const joinedIds=new Set(paidJoin.decisions
    .map(row=>row.riderId));
  if(joinedIds.size!==2||
    !isDeepStrictEqual([...joinedIds],
      formation.groupRoad.riderIds)||
    !isDeepStrictEqual(formation.event,
      source.recording.firstCandidateEvent)||
    !isDeepStrictEqual(probe.contact
      .roadIds,[formation.groupRoad.id,
        'peloton']))
    throw new Error(
      'Front-rear group bunch km lacks paid contact chain.');
  const remaining=source.tracks.filter(track=>
    !formation.event.roadIds.includes(
      track.id));
  if(findPhysicalOrderedBoundaryEventsV1(
    remaining,source.bunch,km).length)
    throw new Error(
      'Front-rear group bunch km has later contact.');
  const oldStates=new Map(prior.riderStates
    .map(row=>[row.riderId,row]));
  const oldEntities=new Map(prior.endRearEntities
    .map(entity=>[entity.id,entity]));
  const formationApproaches=new Map(
    formation.paidApproaches.map(row=>[
      row.riderId,row]));
  const formationChoices=new Map(
    formation.choice.riderDecisions
      .map(row=>[row.riderId,row]));
  const groupApproaches=new Map(joined.sources
    .paidRearApproach.map(row=>[
      row.riderId,row]));
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
        'Front-rear group bunch km lacks prior road.');
    for(const row of track.rows){
      if(Math.abs(old.energyByRider[
        row.riderId]-
        row.energyBefore)>EPS)
        throw new Error(
          'Front-rear group bunch km breaks energy.');
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
        'Front-rear group bunch km lacks one leader.');
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
  const bunchDecisions=new Map(source.step
    .riderDecisions.map(row=>[
      row.riderId,row]));
  const bunchStates=source.step.physicalGroup
    .riderIds.map(riderId=>({
      riderId,sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:paidJoin.bunchEndClock,
      energyAfter:source.step
        .energyByRider[riderId],
      decisions:[bunchDecisions.get(riderId)]}));
  for(const decision of paidJoin.decisions){
    const first=formationApproaches.get(
      decision.riderId);
    const choice=formationChoices.get(
      decision.riderId);
    const middle=groupApproaches.get(
      decision.riderId);
    const before=oldStates.get(decision.riderId);
    if(!first||!choice||!middle||!before||
      Math.abs(first.energyBefore-
        before.energyAfter)>EPS||
      Math.abs(first.energyAfter-
        middle.energyBefore)>EPS||
      Math.abs(middle.energyAtContact-
        decision.energyAtContact)>EPS||
      decision.energyAfter<0)
      throw new Error(
        'Front-rear group bunch km breaks join energy.');
    bunchStates.push({riderId:decision.riderId,
      sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:paidJoin.bunchEndClock,
      energyAfter:decision.energyAfter,
      decisions:[first.decision,choice,
        middle.decision,decision]});
  }
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
      'Front-rear group bunch km lacks full paid field.');
  return {version:
    PHYSICAL_FRONT_REAR_GROUP_BUNCH_KM_VERSION,
    sourceKm:km,
    sources:{boundary:source.recording,
      probe,paidJoin},
    riderStates:roster.map(id=>byId.get(id)),
    riderCount:roster.length,
    endBunchState:{riderIds:bunchStates
      .map(row=>row.riderId),
      energyByRider:{...Object.fromEntries(
        source.step.physicalGroup.riderIds
          .map(id=>[id,source.step
            .energyByRider[id]])),
        ...Object.fromEntries(
          paidJoin.decisions.map(row=>[
            row.riderId,row.energyAfter]))},
      quietKmByRider:{...Object.fromEntries(
        source.step.physicalGroup.riderIds
          .map(id=>[id,source.step
            .quietKmByRider[id]])),
        ...Object.fromEntries(
          paidJoin.decisions.map(row=>[
            row.riderId,0]))}},
    endFrontState:{riderId:frontRiderId,
      elapsedSeconds:source.frontStep
        .elapsedSeconds,
      energyAfter:source.frontStep
        .energyAfter,
      gapSecondsToBunch:source.frontStep
        .gapSecondsToBunch},
    endRearEntities,
    physicalGroups:[{id:'peloton',
      riderIds:bunchStates.map(row=>
        row.riderId),
      atDistanceM:km*1000},
    source.frontStep.physicalGroup,
    ...endRearEntities.map(entity=>({
      id:entity.id,
      riderIds:entity.riderIds,
      atDistanceM:km*1000}))],
    fieldKilometreIncomplete:false,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontRearGroupBunchKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearGroupBunchKmV1(input)))
    throw new Error(
      'Front-rear group bunch km differs from paid source.');
  return true;
}
