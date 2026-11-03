// Discover the first paid front/bunch meeting from the full field.
// A different refusal cannot be interpreted as a catch.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {probePhysicalFrontRearFrontCatchBoundaryV1} from
  './physical-front-rear-front-catch-boundary-v1.mjs';

export const PHYSICAL_FRONT_CATCH_DISCOVERY_VERSION=
  'v2-physical-front-catch-discovery-1';

export function discoverPhysicalFrontCatchV1(input){
  const distanceKm=input?.startInput
    ?.routeKilometres?.length;
  if(!Number.isInteger(distanceKm)||
    distanceKm<=input.lossKm)
    throw new Error(
      'Front catch discovery needs replayable route.');
  let catchKm=null;
  try{
    replayPhysicalFrontRearRaceV1({
      ...input,throughKm:distanceKm});
  }catch(error){
    if(error.cause?.message!==
      'Front solo needs separate physical catch road.'||
      !Number.isInteger(error.sourceKm)||
      error.sourceKm<=input.lossKm||
      error.sourceKm>distanceKm)
      throw error;
    catchKm=error.sourceKm;
  }
  if(catchKm===null)
    throw new Error(
      'Front catch discovery found no paid contact.');
  const boundary=
    probePhysicalFrontRearFrontCatchBoundaryV1({
      ...input,catchKm});
  return {version:
    PHYSICAL_FRONT_CATCH_DISCOVERY_VERSION,
    catchKm,contact:boundary.contact,
    rearRiderCount:boundary.rearRiderCount,
    orderedContactCandidateCount:boundary
      .orderedContactCandidates.length,
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalFrontCatchV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    discoverPhysicalFrontCatchV1(input)))
    throw new Error(
      'Discovered front catch differs from paid source.');
  return true;
}
