// Experimental whole positional race with at most one paid solo attack.
// Every extra attack or unimplemented physical contact fails closed.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {createPhysicalFirstPositionStartV2} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionRotationKmV2} from
  './physical-first-position-rotation-km-v2.mjs';
import {advancePhysicalFirstPositionAttackDepartureKmV1} from
  './physical-first-position-attack-departure-km-v1.mjs';
import {advancePhysicalFirstPositionSoloKmV1,
  advancePhysicalFirstPositionSoloKmV2,
  advancePhysicalFirstPositionSoloKmV3} from
  './physical-first-position-solo-km-v1.mjs';
import {settlePhysicalFirstPositionFinishTailV2} from
  './physical-first-position-finish-tail-v2.mjs';

export const PHYSICAL_FIRST_POSITION_ONE_ATTACK_RACE_VERSION=
  'physical-first-position-one-attack-race-1';
export const PHYSICAL_FIRST_POSITION_ONE_ATTACK_RACE_V2_VERSION=
  'physical-first-position-one-attack-race-2';
export const PHYSICAL_FIRST_POSITION_ONE_ATTACK_RACE_V3_VERSION=
  'physical-first-position-one-attack-race-3';

function recordOneAttackRace({input,grid},
  mode){
  let peloton=createPhysicalFirstPositionStartV2({
    input,grid});
  const start=peloton;
  let solo=null,soloFinish=null;
  const soloLineClocks=new Map();
  const steps=[],checkpointCrossings=[];
  for(const segment of input.kilometres){
    const priorKm=peloton.sourceKm;
    const choiceRoads=[{roadId:'peloton',
      riderIds:peloton.positions.map(row=>row.riderId),
      clockSeconds:peloton.clockSeconds}];
    const choiceRiders=peloton.positions.map(row=>({
      riderId:row.riderId,teamId:row.teamId,
      roadId:'peloton',distanceM:priorKm*1000,
      clockSeconds:peloton.clockSeconds,
      reserve:row.energy,quietKm:row.quietKm}));
    if(solo){
      const crossingClock=soloLineClocks.get(priorKm);
      if(!Number.isFinite(crossingClock))
        throw new Error('Solo choice lacks recorded line time.');
      choiceRoads.push({roadId:solo.roadId,
        riderIds:[solo.riderId],
        clockSeconds:crossingClock});
      choiceRiders.push({riderId:solo.riderId,
        teamId:solo.teamId,roadId:solo.roadId,
        distanceM:priorKm*1000,
        clockSeconds:crossingClock,
        reserve:solo.energy,quietKm:solo.quietKm});
    }
    const choicePrior={sourceKm:priorKm,
      roads:choiceRoads,riders:choiceRiders};
    const attackChoices=choosePhysicalFirstBoundaryAttacksV1({
      prior:choicePrior,segment,teams:input.teams,
      stakes:input.stakes,kilometres:input.kilometres});
    const attempts=attackChoices.filter(row=>
      row.choice==='attempt_paid_attack');
    if(attempts.length>1||attempts.length&&solo)
      throw new Error(
        `Position race lacks another paid attack at km ${segment.km}.`);
    const priorPeloton=peloton;
    let departure=null,soloStep=null;
    if(attempts.length){
      departure=advancePhysicalFirstPositionAttackDepartureKmV1({
        prior:peloton,segment,input,
        choice:attempts[0]});
      peloton=departure.peloton;
      solo=departure.soloPosition;
      for(const crossing of departure.soloCheckpointCrossings)
        soloLineClocks.set(crossing.km,
          crossing.clockSeconds);
      checkpointCrossings.push(...departure
        .soloCheckpointCrossings);
    }else{
      peloton=advancePhysicalFirstPositionRotationKmV2({
        prior:peloton,segment,input});
      if(solo&&!solo.finishedAtClockSeconds){
        soloStep=(mode===3?
          advancePhysicalFirstPositionSoloKmV3:
          mode===2?
          advancePhysicalFirstPositionSoloKmV2:
          advancePhysicalFirstPositionSoloKmV1)({
          priorSolo:solo,priorPeloton,
          nextPeloton:peloton,segment,input});
        solo=soloStep.position;
        for(const crossing of soloStep.checkpointCrossings)
          soloLineClocks.set(crossing.km,
            crossing.clockSeconds);
        checkpointCrossings.push(...soloStep
          .checkpointCrossings);
        if(soloStep.finished)
          soloFinish=soloStep.finishCrossing;
      }
    }
    checkpointCrossings.push(...peloton
      .checkpointCrossings);
    steps.push({sourceKm:segment.km,
      attackChoices,departure,soloStep,peloton,
      soloPosition:solo});
  }
  const tail=settlePhysicalFirstPositionFinishTailV2({
    input,prior:peloton});
  const finishKm=input.kilometres.length;
  const finishCrossings=[...tail.lineCrossings,
    ...(soloFinish?[{
      riderId:soloFinish.riderId,
      lineDistanceM:soloFinish.lineDistanceM,
      clockSeconds:soloFinish.clockSeconds,
      sourceKm:soloFinish.sourceKm,
      paidRoadId:`solo:${soloFinish.riderId}`
    }]:[])].sort((a,b)=>
    a.clockSeconds-b.clockSeconds||
    a.riderId.localeCompare(b.riderId));
  const riderCount=start.positions.length;
  const crossingKeys=new Set([
    ...checkpointCrossings.map(row=>
      `${row.riderId}:${row.km}`),
    ...finishCrossings.map(row=>
      `${row.riderId}:${finishKm}`)]);
  if(steps.length!==finishKm||
    finishCrossings.length!==riderCount||
    new Set(finishCrossings.map(row=>
      row.riderId)).size!==riderCount||
    crossingKeys.size!==riderCount*finishKm||
    (solo&&!soloFinish))
    throw new Error('One-attack race lacks paid finish passages.');
  return {version:mode===3?
    PHYSICAL_FIRST_POSITION_ONE_ATTACK_RACE_V3_VERSION:
    mode===2?
    PHYSICAL_FIRST_POSITION_ONE_ATTACK_RACE_V2_VERSION:
    PHYSICAL_FIRST_POSITION_ONE_ATTACK_RACE_VERSION,
  raceSeed:input.raceSeed,inputHash:start.inputHash,
  plannedKm:finishKm,completedThroughKm:steps.length,
  riderCount,start,steps,checkpointCrossings,
  tail,soloFinish,finishCrossings,
  physicalRoadCount:solo?2:1,
  sourceGroupClockPositionsUsedForMovement:false,
  officialResults:false};
}

export function recordPhysicalFirstPositionOneAttackRaceV1(
  input){
  return recordOneAttackRace(input,1);
}

export function recordPhysicalFirstPositionOneAttackRaceV2(
  input){
  return recordOneAttackRace(input,2);
}

export function recordPhysicalFirstPositionOneAttackRaceV3(
  input){
  return recordOneAttackRace(input,3);
}

export function replayPhysicalFirstPositionOneAttackRaceV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionOneAttackRaceV1(input)))
    throw new Error('One-attack race differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionOneAttackRaceV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionOneAttackRaceV2(input)))
    throw new Error('One-attack race v2 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionOneAttackRaceV3(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionOneAttackRaceV3(input)))
    throw new Error('One-attack race v3 differs from paid movement.');
  return recorded;
}
