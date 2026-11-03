// Observe a paid front gap after rear riders have physically left the
// bunch. Tactical estimates use perceived rival attributes and the
// observer's own orders; this read-only source moves no rider.
import {isDeepStrictEqual} from 'node:util';
import {replayPhysicalFrontRearRaceV1} from
  './physical-front-rear-race-replay-v1.mjs';
import {decideCommittedTeamChaseV1} from
  './team-chase-stake-v1.mjs';
import {estimatePhysicalObserverPaceV1} from
  './physical-observer-pace-estimate-v1.mjs';
import {orderAt} from './orders.mjs';

export const PHYSICAL_FRONT_REAR_THREAT_FROM_STATE_VERSION=
  'v2-physical-front-rear-threat-from-state-1';

export function decidePhysicalFrontRearThreatFromStateV1({
  startInput,start,attackKm,lossKm,choiceKm,
  observerTeamId,nominatedChaseTeamIds,
  conditionalChaseTeamIds=[]}){
  if(!Number.isInteger(choiceKm)||
    choiceKm<=lossKm||
    choiceKm>startInput?.routeKilometres?.length)
    throw new Error(
      'Front-rear threat needs later paid state.');
  const prefix=replayPhysicalFrontRearRaceV1({
    startInput,start,attackKm,lossKm,
    throughKm:choiceKm-1});
  const prior=prefix.sources.last;
  const frontRiderId=prior.endFrontState.riderId;
  const gapSeconds=prior.endFrontState
    .gapSecondsToBunch;
  const roster=startInput.teams.flatMap(team=>
    team.riders.map(rider=>rider.id));
  const energyById=new Map(prior.riderStates
    .map(row=>[row.riderId,row.energyAfter]));
  if(energyById.size!==roster.length||
    roster.some(id=>!Number.isFinite(
      energyById.get(id)))||
    !Number.isFinite(gapSeconds)||
    gapSeconds<=0)
    throw new Error(
      'Front-rear threat lacks full paid energy and gap.');
  const teams=structuredClone(startInput.teams);
  for(const team of teams)for(const rider of team.riders)
    team.energy[rider.id]=energyById.get(rider.id);
  const frontTeam=teams.find(team=>
    team.riders.some(row=>row.id===
      frontRiderId));
  const unavailableRiderIds=prior.endRearEntities
    .flatMap(row=>row.riderIds);
  const choice=decideCommittedTeamChaseV1({
    commitment:startInput.commitment,
    teams,roadGroups:[{id:'road-1',
      riderIds:[frontRiderId],
      teamIds:[frontTeam.id],gapSeconds}],
    observerTeamId,
    raceSeed:startInput.raceSeed,
    nominatedChaseTeamIds,
    conditionalChaseTeamIds,
    unavailableRiderIds,
    remainingSegments:startInput
      .routeKilometres.slice(choiceKm-1)});
  const observer=teams.find(team=>
    team.id===observerTeamId);
  const order=orderAt(observer.orders,
    choiceKm-1);
  const frontNow=prefix.kilometres.at(-1)
    .riderStates.find(row=>row.riderId===
      frontRiderId);
  const frontBefore=prefix.kilometres.at(-2)
    .riderStates.find(row=>row.riderId===
      frontRiderId);
  const paceEstimate=order.frontWork==='rotate'?
    estimatePhysicalObserverPaceV1({
      teams,observerTeamId,
      raceSeed:startInput.raceSeed,
      frontRiderId,
      priorFrontSeconds:frontNow.elapsedSeconds-
        frontBefore.elapsedSeconds,
      priorSegment:startInput.routeKilometres[
        choiceKm-2],
      nextSegment:startInput.routeKilometres[
        choiceKm-1]}):null;
  return {version:
    PHYSICAL_FRONT_REAR_THREAT_FROM_STATE_VERSION,
    sourceKm:choiceKm,observerTeamId,
    frontRiderId,observedGapSeconds:gapSeconds,
    unavailableRiderIds,choice,paceEstimate,
    sources:{prefix},
    movesRoad:false,officialResults:false};
}

export function validatePhysicalFrontRearThreatFromStateV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    decidePhysicalFrontRearThreatFromStateV1(
      input)))
    throw new Error(
      'Front-rear threat differs from paid source.');
  return true;
}
