// Pay an explicitly ordered chase kilometre after a full front/rear
// state and record the observer's separate perceived threat advice.
import {isDeepStrictEqual} from 'node:util';
import {decidePhysicalFrontRearThreatFromStateV1} from
  './physical-front-rear-threat-from-state-v1.mjs';
import {sourcePhysicalFrontRearBoundaryFromStateV1} from
  './physical-front-rear-next-km-v1.mjs';
import {replayPhysicalFrontRearAllContactsKmV1} from
  './physical-front-rear-joined-km-v1.mjs';

export const PHYSICAL_FRONT_REAR_MANAGER_CHASE_KM_VERSION=
  'v2-physical-front-rear-manager-chase-km-1';

export function replayPhysicalFrontRearManagerChaseKmV1(
  input){
  const threat=decidePhysicalFrontRearThreatFromStateV1(
    input);
  const {startInput,observerTeamId}=input;
  const prior=threat.sources.prefix.sources.last;
  const sourceInput={startInput,prior,
    chaseObserverTeamId:observerTeamId};
  const boundary=
    sourcePhysicalFrontRearBoundaryFromStateV1(
      sourceInput).recording;
  const paid=boundary.fieldKilometreIncomplete?
    replayPhysicalFrontRearAllContactsKmV1(
      sourceInput):boundary;
  if(paid.fieldKilometreIncomplete||
    paid.riderCount!==input.start.riderIds.length||
    paid.sourceKm!==input.choiceKm||
    !Number.isFinite(paid.endFrontState
      ?.gapSecondsToBunch))
    throw new Error(
      'Manager chase lacks full paid front/rear kilometre.');
  const workerId=boundary.sources.step
    .leaderRiderId;
  const workerBefore=prior.riderStates.find(row=>
    row.riderId===workerId);
  const workerAfter=paid.riderStates.find(row=>
    row.riderId===workerId);
  if(!workerBefore||!workerAfter||
    workerAfter.energyAfter>=workerBefore
      .energyAfter||
    workerAfter.decisions[0].choice!=='chase')
    throw new Error(
      'Manager chase lacks paid named worker.');
  return {version:
    PHYSICAL_FRONT_REAR_MANAGER_CHASE_KM_VERSION,
    sourceKm:paid.sourceKm,
    observerTeamId,workerId,
    perceivedAction:threat.choice.choice
      .assessments[0].action,
    gapBeforeSeconds:threat.observedGapSeconds,
    gapAfterSeconds:paid.endFrontState
      .gapSecondsToBunch,
    workerEnergyBefore:workerBefore.energyAfter,
    workerEnergyAfter:workerAfter.energyAfter,
    riderStates:paid.riderStates,
    riderCount:paid.riderCount,
    sources:{threat,paid},
    movesGuidedRace:false,officialResults:false};
}

export function validatePhysicalFrontRearManagerChaseKmV1(
  input,recording){
  if(!isDeepStrictEqual(recording,
    replayPhysicalFrontRearManagerChaseKmV1(input)))
    throw new Error(
      'Front-rear manager chase differs from paid source.');
  return true;
}
