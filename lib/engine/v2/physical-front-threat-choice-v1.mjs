// One source-replayed observer choice at the next kilometre after a
// paid named break. The road gap and all current energies are physical;
// rival strength in the tactical forecast is the observer's estimate.
import {isDeepStrictEqual} from 'node:util';
import {runPhysicalFrontSoloV1} from
  './physical-front-solo-run-v1.mjs';
import {runPhysicalBunchAfterNamedAttackV1} from
  './physical-start-bunch-v1.mjs';
import {decideCommittedTeamChaseV1} from
  './team-chase-stake-v1.mjs';

export const PHYSICAL_FRONT_THREAT_CHOICE_VERSION=
  'v2-physical-front-threat-choice-1';

export function decidePhysicalFrontThreatV1({startInput,start,
  attackKm,choiceKm,observerTeamId,
  nominatedChaseTeamIds,conditionalChaseTeamIds=[]}){
  if(!Number.isInteger(choiceKm)||choiceKm<=attackKm+1||
    choiceKm>startInput?.routeKilometres?.length)
    throw new Error('Physical threat needs a later source kilometre.');
  const throughKm=choiceKm-1;
  const front=runPhysicalFrontSoloV1({startInput,start,
    attackKm,throughKm});
  const bunch=runPhysicalBunchAfterNamedAttackV1({
    startInput,start,attackKm,throughKm});
  const frontTeam=startInput.teams.find(team=>team.riders.some(
    rider=>rider.id===front.riderId));
  const gapSeconds=bunch.elapsedSeconds-front.elapsedSeconds;
  if(Math.abs(gapSeconds-front.gapSecondsToBunch)>1e-7||
    gapSeconds<=0)
    throw new Error('Physical threat needs a paid forward gap.');
  const teams=structuredClone(startInput.teams);
  const energyByRider={...bunch.energyByRider,
    [front.riderId]:front.energyAfter};
  if(Object.keys(energyByRider).length!==start.riderIds.length)
    throw new Error('Physical threat needs all rider energy.');
  for(const team of teams)for(const rider of team.riders)
    team.energy[rider.id]=energyByRider[rider.id];
  const roadGroups=[{id:'road-1',
    riderIds:[front.riderId],teamIds:[frontTeam.id],
    gapSeconds}];
  const choiceInput={commitment:startInput.commitment,
    teams,roadGroups,observerTeamId,
    raceSeed:startInput.raceSeed,
    nominatedChaseTeamIds,conditionalChaseTeamIds,
    remainingSegments:startInput.routeKilometres.slice(
      choiceKm-1)};
  const choice=decideCommittedTeamChaseV1(choiceInput);
  return {version:PHYSICAL_FRONT_THREAT_CHOICE_VERSION,
    sourceKm:choiceKm,frontRiderId:front.riderId,
    observedGapSeconds:gapSeconds,
    physicalSource:{front,bunch},choice,
    movesRoad:false,officialResults:false};
}

export function validatePhysicalFrontThreatV1(input,recording){
  if(!isDeepStrictEqual(recording,
    decidePhysicalFrontThreatV1(input)))
    throw new Error('Physical front threat differs from source.');
  return true;
}
