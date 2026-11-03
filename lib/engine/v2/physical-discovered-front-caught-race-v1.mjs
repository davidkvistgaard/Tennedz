// Opt-in complete race with a catch kilometre found from paid source.
// The explicit-kilometre recording remains available unchanged.
import {isDeepStrictEqual} from 'node:util';
import {discoverPhysicalFrontCatchV1} from
  './physical-front-catch-discovery-v1.mjs';
import {replayPhysicalFrontCaughtAllRearRaceV1} from
  './physical-front-caught-all-rear-race-v1.mjs';

export const PHYSICAL_DISCOVERED_FRONT_CAUGHT_RACE_VERSION=
  'v2-physical-discovered-front-caught-race-1';
export const PHYSICAL_DISCOVERED_FRONT_CAUGHT_CHAIN_RACE_VERSION=
  'v2-physical-discovered-front-caught-chain-race-2';
export const PHYSICAL_DISCOVERED_FRONT_CAUGHT_PRECAUGHT_PAIR_RACE_VERSION=
  'v2-physical-discovered-front-caught-precaught-pair-race-1';
export const PHYSICAL_DISCOVERED_FRONT_CAUGHT_PRECAUGHT_BUNCH_JOIN_RACE_VERSION=
  'v2-physical-discovered-front-caught-precaught-bunch-join-race-1';

export function replayPhysicalDiscoveredFrontCaughtRaceV1(
  input){
  const discovery=discoverPhysicalFrontCatchV1(
    input);
  const race=replayPhysicalFrontCaughtAllRearRaceV1({
    ...input,catchKm:discovery.catchKm});
  if(!isDeepStrictEqual(
    race.sources.caught.contact,
    discovery.contact)||
    race.catchKm!==discovery.catchKm||
    race.riderIds.length!==input.start.riderIds
      .length||
    race.kilometres.length!==race.distanceKm)
    throw new Error(
      'Discovered race differs from paid catch source.');
  return {...race,
    version:race.sources.caught.earlyBunchJoin?
      PHYSICAL_DISCOVERED_FRONT_CAUGHT_PRECAUGHT_BUNCH_JOIN_RACE_VERSION:
      race.sources.caught.earlyContact?
      PHYSICAL_DISCOVERED_FRONT_CAUGHT_PRECAUGHT_PAIR_RACE_VERSION:
      race.sources.caught
      .additionalContacts?.length?
      PHYSICAL_DISCOVERED_FRONT_CAUGHT_CHAIN_RACE_VERSION:
      PHYSICAL_DISCOVERED_FRONT_CAUGHT_RACE_VERSION,
    sourceDiscovery:discovery};
}

export function validatePhysicalDiscoveredFrontCaughtRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalDiscoveredFrontCaughtRaceV1(
      input)))
    throw new Error(
      'Discovered race differs from paid source.');
  return true;
}
