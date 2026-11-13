// Continue a paid field after the front rider has been caught and
// resolved onto a rear road. Contacts still require ordered replay.
import {isDeepStrictEqual} from 'node:util';
import {advancePhysicalBunchAfterAllRearKmV1} from
  './physical-start-bunch-v1.mjs';
import {pricePhysicalRearSoloTrackV1,
  pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {completePhysicalFrontBunchLossFromStepV1} from
  './physical-pace-loss-completion-v1.mjs';
import {staggeredSoloTrajectoryV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_ALL_REAR_NEXT_KM_VERSION=
  'v2-physical-all-rear-next-km-1';

export function sourcePhysicalAllRearBoundaryFromStateV1({
  startInput,prior}){
  const roster=startInput?.teams?.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const rearEntities=prior?.endRearEntities;
  if(prior?.fieldKilometreIncomplete||
    !Array.isArray(roster)||
    !Array.isArray(prior?.riderStates)||
    prior.riderStates.length!==roster.length||
    !Array.isArray(rearEntities)||
    rearEntities.some(row=>
      row.kind==='solo'?
        row.riderIds.length!==1:
        row.kind!=='group'||
          row.riderIds.length<2)||
    prior.endBunchState.riderIds.length+
      rearEntities.reduce((count,entity)=>
        count+entity.riderIds.length,0)!==
        roster.length||
    prior.sourceKm>=
      startInput.routeKilometres.length)
    throw new Error(
      'All-rear next kilometre needs settled paid field.');
  const km=prior.sourceKm+1;
  const rearRiderIds=rearEntities.flatMap(row=>
    row.riderIds);
  const step=advancePhysicalBunchAfterAllRearKmV1({
    startInput,prior:prior.endBunchState,
    segment:startInput.routeKilometres[km-1],
    rearRiderIds});
  if(step.attack)
    throw new Error(
      'All-rear next kilometre needs named attack source.');
  const bunchBefore=prior.riderStates.find(row=>
    row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  if(!Number.isFinite(bunchBefore))
    throw new Error(
      'All-rear next kilometre lacks bunch clock.');
  const oldTracks=rearEntities.map(entity=>
    entity.kind==='solo'?
      pricePhysicalRearSoloTrackV1({
        startInput,riderId:entity.riderIds[0],
        energyBefore:entity.energyByRider[
          entity.riderIds[0]],km,
        startClock:entity.clock,
        groupId:entity.id}):
      pricePhysicalRearEventTrackV1({
        startInput,riderIds:entity.riderIds,
        energyByRider:entity.energyByRider,
        km,startM:0,
        startClock:entity.clock,
        rotationIndex:entity.rotationIndex,
        groupId:entity.id}))
    .map(track=>({...track,id:track.groupId,
      kind:track.kind??'group',
      domainStartM:0,domainEndM:1000}));
  const bunchClock=bunchBefore+step.elapsedSeconds;
  const newCompletions=step.splits.map(split=>
    completePhysicalFrontBunchLossFromStepV1({
      startInput,lossKm:km,step,
      bunchElapsedSeconds:bunchClock,
      riderId:split.riderId}));
  const newTracks=newCompletions.map(completion=>{
    const split=step.splits.find(row=>
      row.riderId===completion.riderId);
    const trajectory=staggeredSoloTrajectoryV1({
      riderId:completion.riderId,
      lossKm:km,completion},km,
    bunchBefore,step);
    const id=`solo-${completion.riderId}`;
    return {...trajectory,id,groupId:id,
      riderId:completion.riderId,
      riderIds:[completion.riderId],
      kind:'solo',
      domainStartM:split.atDistanceM-
        (km-1)*1000,
      domainEndM:1000,
      endClock:completion.elapsedSeconds,
      rows:[{riderId:completion.riderId,
        decision:completion.decision,
        energyBefore:completion.energyBefore,
        energySpent:completion.energySpent,
        energyAfter:completion.energyAfter}]};
  });
  const tracks=[...oldTracks,...newTracks];
  const bunch={id:'peloton',
    riderId:'peloton',riderIds:[],
    breaks:[],domainStartM:0,
    domainEndM:1000,
    clockAt:metres=>bunchBefore+
      step.elapsedSeconds*metres/1000};
  const events=findPhysicalOrderedBoundaryEventsV1(
    tracks,bunch,km);
  const decisions=new Map(step.riderDecisions
    .map(row=>[row.riderId,row]));
  const riderStates=!events.length?[
    ...step.physicalGroup.riderIds.map(
      riderId=>({riderId,sourceKm:km,
        physicalGroupId:'peloton',
        atDistanceM:km*1000,
        elapsedSeconds:bunchClock,
        energyAfter:step.energyByRider[
          riderId],
        decisions:[decisions.get(riderId)]})),
    ...tracks.flatMap(track=>track.rows
      .map(row=>({riderId:row.riderId,
        sourceKm:km,
        physicalGroupId:track.id,
        atDistanceM:km*1000,
        elapsedSeconds:track.endClock,
        energyAfter:row.energyAfter,
        decisions:[row.decision]})))]
    .sort((a,b)=>roster.indexOf(a.riderId)-
      roster.indexOf(b.riderId)):null;
  if(riderStates&&(
    riderStates.length!==roster.length||
    new Set(riderStates.map(row=>row.riderId))
      .size!==roster.length||
    riderStates.some(row=>{
      const before=prior.riderStates.find(item=>
        item.riderId===row.riderId);
      return !before||
        row.elapsedSeconds<=
          before.elapsedSeconds||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0||
        !row.decisions.length;
    })))
    throw new Error(
      'All-rear next kilometre lacks paid field.');
  const endRearEntities=tracks.map(track=>{
    const old=rearEntities.find(row=>
      row.id===track.id);
    return {id:track.id,kind:track.kind,
      riderIds:[...track.riderIds],
      atDistanceM:km*1000,
      clock:track.endClock,
      energyByRider:Object.fromEntries(
        track.rows.map(row=>[
          row.riderId,row.energyAfter])),
      ...(track.kind==='group'?{
        rotationIndex:(old.rotationIndex+1)%
          track.riderIds.length,
        formedKm:old.formedKm}:{})};
  });
  const recording={version:
    PHYSICAL_ALL_REAR_NEXT_KM_VERSION,
    sourceKm:km,
    sources:{prior,step,
      rearRoads:tracks.map(track=>({
        id:track.id,kind:track.kind,
        riderIds:[...track.riderIds],
        endClock:track.endClock}))},
    firstCandidateEvent:events[0]??null,
    candidateEventCount:events.length,
    ...(riderStates?{riderStates,
      riderCount:riderStates.length,
      endBunchState:{
        riderIds:[...step.physicalGroup
          .riderIds],
        energyByRider:Object.fromEntries(
          step.physicalGroup.riderIds
            .map(id=>[id,step.energyByRider[id]])),
        quietKmByRider:Object.fromEntries(
          step.physicalGroup.riderIds
            .map(id=>[id,
              step.quietKmByRider[id]]))},
      endRearEntities}:{}),
    fieldKilometreIncomplete:Boolean(events.length),
    movesGuidedRace:false,
    officialResults:false};
  return {recording,tracks,bunch,step};
}

export function advancePhysicalAllRearClearKmV1(input){
  return sourcePhysicalAllRearBoundaryFromStateV1(
    input).recording;
}

export function validatePhysicalAllRearClearKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    advancePhysicalAllRearClearKmV1(input)))
    throw new Error(
      'All-rear clear km differs from paid source.');
  return true;
}
