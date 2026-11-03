// Discover a front/rear meeting from a paid full-field refusal, then
// verify that its ordered contact and group membership replay.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {replayPhysicalFrontToRearContactsKmV1} from
  './physical-front-rear-joined-km-v1.mjs';
import {replayPhysicalFrontToRearAllRaceV1} from
  './physical-front-to-rear-all-race-v1.mjs';

export const PHYSICAL_FRONT_TO_REAR_DISCOVERY_VERSION=
  'v2-physical-front-to-rear-discovery-1';
export const PHYSICAL_DISCOVERED_FRONT_TO_REAR_RACE_VERSION=
  'v2-physical-discovered-front-to-rear-race-1';

export function discoverPhysicalFrontToRearContactV1(
  input){
  const distanceKm=input?.startInput
    ?.routeKilometres?.length;
  if(!Number.isInteger(distanceKm)||
    distanceKm<=input.lossKm)
    throw new Error(
      'Front-to-rear discovery needs replayable route.');
  let event=null;
  let contactKm=null;
  try{
    replayPhysicalFrontRearRaceV1({
      ...input,throughKm:distanceKm});
  }catch(error){
    if(!Number.isInteger(error.sourceKm)||
      error.sourceKm<=input.lossKm||
      error.sourceKm>distanceKm||
      !error.frontContactEvent)
      throw error;
    contactKm=error.sourceKm;
    event=error.frontContactEvent;
  }
  if(contactKm===null)
    throw new Error(
      'Front-to-rear discovery found no paid contact.');
  const prefix=replayPhysicalFrontRearRaceV1({
    ...input,throughKm:contactKm-1});
  const chaseTeam=input.chaseObserverTeamId;
  const activeChaseTeamId=chaseTeam&&
    orderAt(input.startInput.teams.find(
      team=>team.id===chaseTeam)
      .orders,contactKm-1)
      .chase!=='ignore'?chaseTeam:null;
  let transition;
  try{
    transition=
      replayPhysicalFrontToRearContactsKmV1({
        startInput:input.startInput,
        prior:prefix.sources.last,
        chaseObserverTeamId:
          activeChaseTeamId});
  }catch(error){
    error.sourceKm=contactKm;
    error.frontContactEvent=event;
    throw error;
  }
  const recorded=transition.sources.contacts
    .find(row=>row.event.roadIds.some(
      id=>id===`front-${prefix.sources
        .last.endFrontState.riderId}`));
  if(!recorded||
    !isDeepStrictEqual(recorded.event,
      event)||
    recorded.choice.outcome!=='join'||
    !transition.endRearEntities.some(
      row=>row.riderIds.includes(prefix
        .sources.last.endFrontState.riderId)))
    throw new Error(
      'Front-to-rear discovery differs from paid source.');
  return {version:
    PHYSICAL_FRONT_TO_REAR_DISCOVERY_VERSION,
    contactKm,event,
    outcome:recorded.choice.outcome,
    groupId:recorded.groupRoad.id,
    leaderRiderId:recorded.groupRoad
      .leaderRiderId,
    movesGuidedRace:false,
    officialResults:false};
}

export function validatePhysicalFrontToRearContactV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    discoverPhysicalFrontToRearContactV1(
      input)))
    throw new Error(
      'Front-to-rear discovery differs from source.');
  return true;
}

export function replayPhysicalDiscoveredFrontToRearRaceV1(
  input){
  const discovery=
    discoverPhysicalFrontToRearContactV1(input);
  const race=
    replayPhysicalFrontToRearAllRaceV1({
      ...input,
      frontContactKm:discovery.contactKm});
  const recorded=race.sources.transition
    .sources.contacts.find(row=>
      row.event.roadIds.some(id=>
        id.startsWith('front-')));
  if(!recorded||
    !isDeepStrictEqual(recorded.event,
      discovery.event))
    throw new Error(
      'Discovered front-to-rear race differs from contact.');
  return {...race,
    version:
      PHYSICAL_DISCOVERED_FRONT_TO_REAR_RACE_VERSION,
    sourceDiscovery:discovery};
}

export function validatePhysicalDiscoveredFrontToRearRaceV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalDiscoveredFrontToRearRaceV1(
      input)))
    throw new Error(
      'Discovered front-to-rear race differs from source.');
  return true;
}
