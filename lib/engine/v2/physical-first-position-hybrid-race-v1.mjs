// A versioned, opt-in whole-race position recording. It cannot invent a
// missing movement: a refused kilometre aborts the entire recording.
import {isDeepStrictEqual} from 'node:util';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionHybridKmV1,
  PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION} from
  './physical-first-position-hybrid-km-v1.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1} from
  './physical-first-position-fixed-lane-finish-v1.mjs';

export const PHYSICAL_FIRST_POSITION_HYBRID_RACE_VERSION=
  'physical-first-position-hybrid-race-1';

export function recordPhysicalFirstPositionHybridRaceV1({
  input,grid}){
  if(input?.positionModelVersion!==
    PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    !Array.isArray(input?.kilometres)||
    !input.kilometres.length)
    throw new Error('Hybrid race needs committed position inputs.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid});
  const steps=[];
  let prior=start;
  for(const segment of input.kilometres){
    const next=advancePhysicalFirstPositionHybridKmV1({
      prior,segment,input});
    if(next.sourceKm!==steps.length+1||
      next.positions.length!==start.positions.length||
      next.decisions.length!==start.positions.length||
      next.selectionPolicyVersion!==
        PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION)
      throw new Error('Hybrid race lost paid rider decisions.');
    steps.push(next);
    prior=next;
  }
  const finish=settlePhysicalFirstPositionFixedLaneFinishV1({
    prior,input});
  if(finish.finishCrossings.length!==
    start.positions.length||
    finish.officialResults)
    throw new Error('Hybrid race lacks paid finish coverage.');
  const checkpointCrossings=steps.flatMap(step=>
    step.checkpointCrossings);
  const contactEvents=steps.flatMap(step=>
    step.contactEvents??[]);
  const frontPassEvents=steps.flatMap(step=>
    step.event?.type==='paid_front_pass'?
      [step.event]:[]);
  return {version:
    PHYSICAL_FIRST_POSITION_HYBRID_RACE_VERSION,
  positionPolicyVersion:
    PHYSICAL_FIRST_POSITION_HYBRID_POLICY_VERSION,
  raceSeed:input.raceSeed,
  inputHash:start.inputHash,
  routeKm:input.kilometres.length,
  riderCount:start.positions.length,
  positionRiderKm:steps.length*
    start.positions.length,
  start,steps,checkpointCrossings,
  contactEvents,frontPassEvents,
  finish,
  finishCrossingCoverage:
    `${finish.finishCrossings.length}/${start.positions.length}`,
  sourceGroupClockUsedForMovement:false,
  competitiveSprintModelUsed:false,
  officialResults:false,
  viewerReady:false};
}

export function replayPhysicalFirstPositionHybridRaceV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionHybridRaceV1(input)))
    throw new Error('Hybrid race differs from paid movement.');
  return recorded;
}
