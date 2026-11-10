// An isolated whole recording for one paid departure followed by
// shared-clock contact. Other attacks and front changes fail closed.
import {isDeepStrictEqual} from 'node:util';
import {orderAt} from './orders.mjs';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionAttackDepartureKmV1} from
  './physical-first-position-attack-departure-km-v1.mjs';
import {advancePhysicalFirstPositionSharedRoadKmV1} from
  './physical-first-position-shared-road-km-v1.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1} from
  './physical-first-position-fixed-lane-finish-v1.mjs';

export const PHYSICAL_FIRST_POSITION_SINGLE_CATCH_RACE_VERSION=
  'physical-first-position-single-catch-race-1';

function choicePrior(prior){
  const peloton=prior.positions.filter(row=>
    row.roadId==='peloton');
  return {sourceKm:prior.sourceKm,
    roads:[{roadId:'peloton',
      riderIds:peloton.map(row=>row.riderId),
      clockSeconds:prior.clockSeconds}],
    riders:prior.positions.map(row=>({
      riderId:row.riderId,teamId:row.teamId,
      roadId:row.roadId,
      distanceM:row.roadId==='peloton'?
        prior.sourceKm*1000:row.distanceM,
      clockSeconds:prior.clockSeconds,
      reserve:row.energy,
      quietKm:row.quietKm}))};
}

function validateUnchangedFront(prior,segment,input){
  const choice=choicePrior(prior);
  const plan=planPhysicalFirstPelotonLeaderV1({
    prior:choice,segment,
    teams:input.teams,stakes:input.stakes,
    emergencyFrontWorkers:
      input.emergencyFrontWorkers??[]});
  if(plan.leaderRiderId!==prior.leaderRiderId)
    throw new Error(
      'Single-catch race needs paid front-worker passing.');
  return plan;
}

export function recordPhysicalFirstPositionSingleCatchRaceV1({
  input,grid}){
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    !Array.isArray(input.kilometres)||
    input.kilometres.length<2)
    throw new Error('Single-catch race needs committed inputs.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid});
  const firstSegment=input.kilometres[0];
  const firstChoices=choosePhysicalFirstBoundaryAttacksV1({
    prior:choicePrior(start),
    segment:firstSegment,
    teams:input.teams,
    stakes:input.stakes,
    kilometres:input.kilometres});
  const firstAttempts=firstChoices.filter(row=>
    row.choice==='attempt_paid_attack');
  if(firstAttempts.length!==1)
    throw new Error(
      'Single-catch race needs one first-kilometre attack.');
  const attack=advancePhysicalFirstPositionAttackDepartureKmV1({
    prior:start,segment:firstSegment,
    input,choice:firstAttempts[0]});
  const riderId=attack.soloPosition.riderId;
  const steps=[{sourceKm:1,
    attackChoices:firstChoices,
    departure:attack}];
  const checkpointCrossings=[
    ...attack.peloton.checkpointCrossings,
    ...attack.soloCheckpointCrossings];
  let state=attack.peloton;
  let solo=attack.soloPosition;
  for(const segment of input.kilometres.slice(1)){
    const prior=state;
    const activePositions=solo?
      [...state.positions,solo]:state.positions;
    const active={...state,positions:activePositions};
    const available=activePositions.find(row=>
      row.riderId===riderId);
    if(!available)
      throw new Error('Single-catch race lost its paid attacker.');
    for(const team of input.teams){
      const order=orderAt(team.orders,
        segment.km-1);
      if(order.attack!=='none'&&
        team.riders.some(row=>
          row.id===order.attackRiderId&&
          activePositions.some(position=>
            position.riderId===row.id&&
            position.roadId==='peloton')))
        throw new Error(
          'Single-catch race needs another paid attack.');
      if(order.attack!=='none'&&
        !order.attackRiderId)
        throw new Error(
          'Single-catch race needs an unnamed attack choice.');
    }
    const leaderPlan=validateUnchangedFront(
      active,segment,input);
    state=advancePhysicalFirstPositionSharedRoadKmV1({
      priorPeloton:prior,
      ...(solo?{priorSolos:[solo]}:{}),
      segment,input});
    solo=null;
    checkpointCrossings.push(...state
      .checkpointCrossings);
    steps.push({sourceKm:segment.km,
      leaderPlan,sharedRoad:state});
  }
  const tail=settlePhysicalFirstPositionFixedLaneFinishV1({
    prior:state,input});
  checkpointCrossings.push(...tail.checkpointCrossings);
  const finishKm=input.kilometres.length;
  const finishCrossings=tail.finishCrossings;
  const riderCount=start.positions.length;
  const beforeFinish=checkpointCrossings.filter(row=>
    row.km<finishKm);
  const crossingKeys=new Set([
    ...beforeFinish.map(row=>
      `${row.riderId}:${row.km}`),
    ...finishCrossings.map(row=>
      `${row.riderId}:${finishKm}`)]);
  if(steps.length!==finishKm||
    finishCrossings.length!==riderCount||
    beforeFinish.length!==
      riderCount*(finishKm-1)||
    new Set(finishCrossings.map(row=>
      row.riderId)).size!==riderCount||
    crossingKeys.size!==riderCount*finishKm||
    steps.flatMap(row=>row.sharedRoad
      ?.soloCatchEvents??[]).length!==1||
    state.positions.some(row=>
      row.roadId===`solo:${row.riderId}`))
    throw new Error(
      `Single-catch race lacks one catch and paid crossings: `+
      `${beforeFinish.length}/${riderCount*(finishKm-1)} `+
      `intermediate, ${finishCrossings.length}/${riderCount} `+
      `finish, ${steps.flatMap(row=>row.sharedRoad
        ?.soloCatchEvents??[]).length} catches.`);
  return {version:
    PHYSICAL_FIRST_POSITION_SINGLE_CATCH_RACE_VERSION,
  raceSeed:input.raceSeed,
  inputHash:start.inputHash,
  plannedKm:finishKm,
  completedThroughKm:steps.length,
  riderCount,start,steps,tail,
  checkpointCrossings,finishCrossings,
  paidAttackDepartures:1,
  soloCatchEvents:steps.flatMap(row=>
    row.sharedRoad?.soloCatchEvents??[]),
  sourceGroupClockPositionsUsedForMovement:false,
  officialResults:false};
}

export function replayPhysicalFirstPositionSingleCatchRaceV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionSingleCatchRaceV1(input)))
    throw new Error(
      'Single-catch race differs from paid movement.');
  return recorded;
}
