// Diagnose a paid front/bunch meeting after rear roads have formed.
// This leaves contact order and the remaining kilometre unsettled.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {advancePhysicalBunchAfterFrontRearKmV1} from
  './physical-start-bunch-v1.mjs';
import {advancePhysicalFrontSoloFromBunchStepV1} from
  './physical-front-solo-run-v1.mjs';

export const PHYSICAL_FRONT_REAR_FRONT_CATCH_BOUNDARY_VERSION=
  'v2-physical-front-rear-front-catch-boundary-1';

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
  return {version:
    PHYSICAL_FRONT_REAR_FRONT_CATCH_BOUNDARY_VERSION,
    sourceKm:catchKm,
    contact:front.contact,
    frontPartial:front.frontPartial,
    bunchPartial:front.bunchPartial,
    rearRiderCount:rearRiderIds.length,
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
