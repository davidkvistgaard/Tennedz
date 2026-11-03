// Continue the first front/rear split on separately paid roads. A new
// split or measured contact needs an ordered in-kilometre transition.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontFirstRearLossKmV1} from
  './physical-front-first-rear-loss-v1.mjs';
import {advancePhysicalBunchAfterFrontRearKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalFrontSoloFromBunchStepV1} from
  './physical-front-solo-run-v1.mjs';
import {pricePhysicalRearSoloTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {completePhysicalFrontBunchLossFromStepV1} from
  './physical-pace-loss-completion-v1.mjs';
import {staggeredSoloTrajectoryV1} from
  './physical-staggered-solo-field-contact-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_NEXT_KM_VERSION=
  'v2-physical-front-rear-next-km-1';

export function advancePhysicalFrontRearClearKmV1({
  startInput,prior}){
  const roster=startInput?.teams?.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const rearEntities=prior?.endRearEntities;
  if(prior?.fieldKilometreIncomplete||
    !Array.isArray(roster)||
    !Array.isArray(prior?.riderStates)||
    prior.riderStates.length!==roster.length||
    !Array.isArray(rearEntities)||
    rearEntities.some(row=>row.kind!=='solo'||
      row.riderIds.length!==1)||
    prior.endBunchState.riderIds.length+
      rearEntities.length+1!==roster.length||
    prior.sourceKm>=
      startInput.routeKilometres.length)
    throw new Error(
      'Front-rear next kilometre needs settled prior road.');
  const km=prior.sourceKm+1;
  const frontRiderId=prior.endFrontState.riderId;
  const rearRiderIds=rearEntities.map(row=>
    row.riderIds[0]);
  const step=advancePhysicalBunchAfterFrontRearKmV1({
    startInput,prior:prior.endBunchState,
    segment:startInput.routeKilometres[km-1],
    frontRiderId,rearRiderIds});
  if(step.attack)
    throw new Error(
      'Front-rear next kilometre needs named attack source.');
  const bunchBefore=prior.riderStates.find(row=>
    row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  if(!Number.isFinite(bunchBefore))
    throw new Error(
      'Front-rear next kilometre lacks bunch clock.');
  const frontStep=advancePhysicalFrontSoloFromBunchStepV1({
    startInput,prior:{sourceKm:prior.sourceKm,
      riderId:frontRiderId,
      energyAfter:prior.endFrontState.energyAfter,
      elapsedSeconds:prior.endFrontState
        .elapsedSeconds,
      bunchElapsedSeconds:bunchBefore,
      gapSecondsToBunch:prior.endFrontState
        .gapSecondsToBunch},
    bunchStep:step});
  const oldRearTracks=rearEntities.map(entity=>
    pricePhysicalRearSoloTrackV1({
      startInput,riderId:entity.riderIds[0],
      energyBefore:entity.energyByRider[
        entity.riderIds[0]],km,
      startClock:entity.clock,
      groupId:entity.id}))
    .map(track=>({...track,id:track.groupId,
      domainEndM:1000}));
  const bunchClock=bunchBefore+step.elapsedSeconds;
  const newCompletions=step.splits.map(split=>
    completePhysicalFrontBunchLossFromStepV1({
      startInput,lossKm:km,step,
      bunchElapsedSeconds:bunchClock,
      riderId:split.riderId}));
  const newRearTracks=newCompletions.map(
    completion=>{
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
  const rearTracks=[...oldRearTracks,
    ...newRearTracks];
  const frontBefore=prior.endFrontState;
  const frontTrack={id:`front-${frontRiderId}`,
    riderId:frontRiderId,
    riderIds:[frontRiderId],breaks:[],
    domainStartM:0,domainEndM:1000,
    clockAt:metres=>frontBefore.elapsedSeconds+
      frontStep.seconds*metres/1000,
    energyAt:metres=>frontStep.energyBefore-
      frontStep.energySpent*metres/1000};
  const bunchTrack={id:'peloton',
    riderId:'peloton',riderIds:[],
    breaks:[],domainStartM:0,
    domainEndM:1000,
    clockAt:metres=>bunchBefore+
      step.elapsedSeconds*metres/1000};
  const events=findPhysicalOrderedBoundaryEventsV1([
    frontTrack,...rearTracks],bunchTrack,km);
  const decisions=new Map(step.riderDecisions.map(row=>
    [row.riderId,row]));
  const riderStates=!events.length?[
    ...step.physicalGroup.riderIds.map(riderId=>({
      riderId,sourceKm:km,
      physicalGroupId:'peloton',
      atDistanceM:km*1000,
      elapsedSeconds:bunchClock,
      energyAfter:step.riders.find(row=>
        row.riderId===riderId).energyAfter,
      decisions:[decisions.get(riderId)]})),
    {riderId:frontRiderId,sourceKm:km,
      physicalGroupId:frontStep.physicalGroup.id,
      atDistanceM:km*1000,
      elapsedSeconds:frontStep.elapsedSeconds,
      energyAfter:frontStep.energyAfter,
      decisions:[frontStep.decision]},
    ...rearTracks.map(track=>({
      riderId:track.riderId,sourceKm:km,
      physicalGroupId:track.groupId,
      atDistanceM:km*1000,
      elapsedSeconds:track.endClock,
      energyAfter:track.rows[0].energyAfter,
      decisions:[track.rows[0].decision]}))]
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
        row.elapsedSeconds<=before.elapsedSeconds||
        !Number.isFinite(row.energyAfter)||
        row.energyAfter<0||
        !row.decisions.length;
    })))
    throw new Error(
      'Front-rear next kilometre lacks paid field.');
  const endRearEntities=rearTracks.map(track=>({
    id:track.groupId,kind:'solo',
    riderIds:[track.riderId],
    atDistanceM:km*1000,
    clock:track.endClock,
    energyByRider:{[track.riderId]:
      track.rows[0].energyAfter}}));
  return {version:PHYSICAL_FRONT_REAR_NEXT_KM_VERSION,
    sourceKm:km,
    sources:{prior,step,frontStep,
      rearRoads:rearTracks.map(track=>({
        riderId:track.riderId,
        startClock:track.startClock,
        endClock:track.endClock,
        row:track.rows[0]}))},
    firstCandidateEvent:events[0]??null,
    candidateEventCount:events.length,
    ...(riderStates?{
      riderStates,riderCount:riderStates.length,
      endBunchState:{
      riderIds:[...step.physicalGroup.riderIds],
      energyByRider:Object.fromEntries(
        step.physicalGroup.riderIds.map(id=>
          [id,step.energyByRider[id]])),
      quietKmByRider:Object.fromEntries(
        step.physicalGroup.riderIds.map(id=>
          [id,step.quietKmByRider[id]]))},
      endFrontState:{riderId:frontRiderId,
      elapsedSeconds:frontStep.elapsedSeconds,
      energyAfter:frontStep.energyAfter,
      gapSecondsToBunch:frontStep
        .gapSecondsToBunch},
      endRearEntities}:{}),
    fieldKilometreIncomplete:Boolean(events.length),
    movesGuidedRace:false,
    officialResults:false};
}

export function replayPhysicalFrontRearNextKmV1({
  startInput,start,attackKm,lossKm}){
  const prior=replayPhysicalFrontFirstRearLossKmV1({
    startInput,start,attackKm,lossKm});
  return advancePhysicalFrontRearClearKmV1({
    startInput,prior});
}

export function validatePhysicalFrontRearNextKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearNextKmV1(input)))
    throw new Error(
      'Front-rear next kilometre differs from paid source.');
  return true;
}
