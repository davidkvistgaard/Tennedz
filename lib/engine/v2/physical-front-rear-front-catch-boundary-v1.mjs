// Diagnose a paid front/bunch meeting after rear roads have formed.
// This leaves contact order and the remaining kilometre unsettled.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {advancePhysicalBunchAfterFrontRearKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalFrontSoloFromBunchStepV1} from
  './physical-front-solo-run-v1.mjs';
import {pricePhysicalRearSoloTrackV1,
  pricePhysicalRearEventTrackV1} from
  './physical-rear-event-track-v1.mjs';
import {findPhysicalOrderedBoundaryEventsV1} from
  './physical-ordered-rear-boundary-v1.mjs';

export const PHYSICAL_FRONT_REAR_FRONT_CATCH_BOUNDARY_VERSION=
  'v2-physical-front-rear-front-catch-boundary-2';

export function probePhysicalFrontRearFrontCatchBoundaryV1({
  startInput,start,attackKm,lossKm,catchKm,
  chaseObserverTeamId=null}){
  if(!Number.isInteger(catchKm)||catchKm<=lossKm||
    catchKm>startInput?.routeKilometres?.length)
    throw new Error('Front-rear catch needs later route.');
  const prefix=replayPhysicalFrontRearRaceV1({
    startInput,start,attackKm,lossKm,
    throughKm:catchKm-1,
    chaseObserverTeamId});
  const prior=prefix.sources.last;
  const rearRiderIds=prior.endRearEntities
    .flatMap(row=>row.riderIds);
  if(!rearRiderIds.length)
    throw new Error(
      'Front-rear catch needs paid rear roads.');
  const frontRiderId=prior.endFrontState.riderId;
  const bunchStep=advancePhysicalBunchAfterFrontRearKmV1({
    startInput,prior:prior.endBunchState,
    segment:startInput.routeKilometres[catchKm-1],
    frontRiderId,rearRiderIds});
  const priorBunchClock=prior.riderStates.find(row=>
    row.physicalGroupId==='peloton')
    ?.elapsedSeconds;
  if(!Number.isFinite(priorBunchClock))
    throw new Error(
      'Front-rear catch lacks paid bunch clock.');
  const front=advancePhysicalFrontSoloFromBunchStepV1({
    startInput,prior:{sourceKm:prior.sourceKm,
      riderId:frontRiderId,
      energyAfter:prior.endFrontState.energyAfter,
      elapsedSeconds:prior.endFrontState
        .elapsedSeconds,
      bunchElapsedSeconds:priorBunchClock,
      gapSecondsToBunch:prior.endFrontState
        .gapSecondsToBunch},
    bunchStep,allowCatchBoundary:true});
  if(!front.fieldKilometreIncomplete||
    !front.contact||
    front.contact.atDistanceM<=(catchKm-1)*1000||
    front.contact.atDistanceM>=catchKm*1000)
    throw new Error(
      'Front-rear catch has no paid contact here.');
  const contactM=front.contact.atDistanceM-
    (catchKm-1)*1000;
  const rearTracks=prior.endRearEntities.map(entity=>
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
      domainStartM:0,domainEndM:1000}));
  const frontTrack={id:`front-${frontRiderId}`,
    riderId:frontRiderId,
    riderIds:[frontRiderId],breaks:[],
    domainStartM:0,domainEndM:contactM,
    clockAt:metres=>prior.endFrontState
      .elapsedSeconds+front.frontPartial
        .secondsPerKm*metres/1000,
    energyAt:metres=>front.frontPartial
      .energyBefore-front.frontPartial
        .energySpent*metres/contactM};
  const bunchTrack={id:'peloton',
    riderId:'peloton',riderIds:[],breaks:[],
    domainStartM:0,domainEndM:1000,
    clockAt:metres=>priorBunchClock+
      bunchStep.elapsedSeconds*metres/1000};
  const orderedContactCandidates=
    findPhysicalOrderedBoundaryEventsV1([
      frontTrack,...rearTracks],
    bunchTrack,catchKm);
  if(!orderedContactCandidates.some(event=>
    event.roadIds.includes(frontTrack.id)&&
    event.roadIds.includes('peloton')&&
    Math.abs(event.atDistanceM-
      front.contact.atDistanceM)<.002&&
    Math.abs(event.clockSeconds-
      front.contact.clockSeconds)<.002))
    throw new Error(
      'Front-rear catch lacks ordered road contact.');
  return {version:
    PHYSICAL_FRONT_REAR_FRONT_CATCH_BOUNDARY_VERSION,
    sourceKm:catchKm,
    contact:front.contact,
    frontPartial:front.frontPartial,
    bunchPartial:front.bunchPartial,
    rearRiderCount:rearRiderIds.length,
    orderedContactCandidates,
    sources:{prefix,bunchStep,front},
    fieldKilometreIncomplete:true,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalFrontRearFrontCatchBoundaryV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    probePhysicalFrontRearFrontCatchBoundaryV1(input)))
    throw new Error(
      'Front-rear catch boundary differs from paid source.');
  return true;
}
