// Experimental connected-road race. Missing attack and rear-road movement
// contracts fail closed before any viewer recording is authorized.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  './physical-first-position-rotation-km-v2.mjs';
import {settlePhysicalFirstPositionFinishTailV2} from
  './physical-first-position-finish-tail-v2.mjs';

export const PHYSICAL_FIRST_POSITION_ROTATION_RACE_V2_VERSION=
  'physical-first-position-rotation-race-2';

export function recordPhysicalFirstPositionRotationRaceV2({
  input,grid}){
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    !Array.isArray(input.kilometres)||
    !input.kilometres.length)
    throw new Error('Position race v2 needs committed inputs.');
  const start=createPhysicalFirstPositionStartV2({input,grid});
  const states=[start],steps=[],checkpointCrossings=[];
  for(const segment of input.kilometres){
    const prior=states.at(-1);
    // The old choice contract may select an attempt, but only a paid
    // positional departure may create a new road. This projection is
    // choice-only and never supplies movement, wheels or a time gap.
    const choicePrior={sourceKm:prior.sourceKm,
      roads:[{roadId:'peloton',
        riderIds:prior.positions.map(row=>row.riderId),
        clockSeconds:prior.clockSeconds}],
      riders:prior.positions.map(row=>({
        riderId:row.riderId,teamId:row.teamId,
        roadId:'peloton',
        distanceM:prior.sourceKm*1000,
        clockSeconds:prior.clockSeconds,
        reserve:row.energy,quietKm:row.quietKm}))};
    const attackChoices=choosePhysicalFirstBoundaryAttacksV1({
      prior:choicePrior,segment,teams:input.teams,
      stakes:input.stakes,kilometres:input.kilometres});
    if(attackChoices.some(row=>
      row.choice==='attempt_paid_attack'))
      throw new Error(
        `Position race v2 lacks paid attack departure at km ${segment.km}.`);
    const step=advancePhysicalFirstPositionRotationKmV2({
      prior,segment,input});
    steps.push(step);
    states.push(step);
    checkpointCrossings.push(...step.checkpointCrossings);
  }
  const finish=settlePhysicalFirstPositionFinishTailV2({
    input,prior:states.at(-1)});
  const riderCount=start.positions.length;
  const allIds=new Set(start.positions.map(row=>row.riderId));
  const crossingKeys=new Set(checkpointCrossings.map(row=>
    `${row.riderId}:${row.km}`));
  if(steps.length!==input.kilometres.length||
    steps.some(step=>step.decisions.length!==riderCount||
      new Set(step.decisions.map(row=>row.riderId)).size!==
        riderCount||
      step.decisions.some(row=>!allIds.has(row.riderId)))||
    checkpointCrossings.length!==
      riderCount*(input.kilometres.length-1)+1||
    crossingKeys.size!==checkpointCrossings.length||
    finish.lineCrossings.length!==riderCount||
    finish.lineCrossings.some(row=>!allIds.has(row.riderId)))
    throw new Error('Position race v2 lacks a paid rider passage.');
  return {version:
    PHYSICAL_FIRST_POSITION_ROTATION_RACE_V2_VERSION,
  positionModelVersion:
    PHYSICAL_FIRST_POSITION_START_V2_VERSION,
  raceSeed:input.raceSeed,inputHash:start.inputHash,
  plannedKm:input.kilometres.length,
  completedThroughKm:steps.length,riderCount,
  positionRiderKm:steps.length*riderCount,
  start,steps,checkpointCrossings,finish,
  sourceGroupClockPositionsUsed:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionRotationRaceV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionRotationRaceV2(input)))
    throw new Error('Position race v2 differs from paid source.');
  return recorded;
}
