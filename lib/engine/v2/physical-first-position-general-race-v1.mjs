// Experimental whole-race position recorder. Every rider starts on one
// committed clock, whether or not an attack is ordered at kilometre 1.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1,
  choosePhysicalFirstBoundaryAttacksV2} from
  './physical-first-attack-choice-v1.mjs';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {quotePhysicalFirstPositionFrontPassV1} from
  './physical-first-position-front-pass-quote-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionSharedRoadKmV10,
  advancePhysicalFirstPositionSharedRoadKmV11,
  advancePhysicalFirstPositionSharedRoadKmV12,
  advancePhysicalFirstPositionSharedRoadKmV13,
  advancePhysicalFirstPositionSharedRoadKmV14,
  advancePhysicalFirstPositionSharedRoadKmV15,
  advancePhysicalFirstPositionSharedRoadKmV16} from
  './physical-first-position-shared-road-km-v1.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1,
  settlePhysicalFirstPositionFixedLaneFinishV2,
  settlePhysicalFirstPositionFixedLaneFinishV3} from
  './physical-first-position-fixed-lane-finish-v1.mjs';

export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V1_VERSION=
  'physical-first-position-general-race-1';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V2_VERSION=
  'physical-first-position-general-race-2';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V3_VERSION=
  'physical-first-position-general-race-3';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V4_VERSION=
  'physical-first-position-general-race-4';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V5_VERSION=
  'physical-first-position-general-race-5';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION=
  'physical-first-position-general-race-6';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION=
  'physical-first-position-general-race-7';
export const PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION=
  'physical-first-position-general-race-8';

function sourceChoiceState(state){
  const peloton=state.positions.filter(row=>
    row.roadId==='peloton');
  return {sourceKm:state.sourceKm,
    frontDistanceM:state.frontDistanceM,
    roads:[{roadId:'peloton',
      riderIds:peloton.map(row=>row.riderId),
      clockSeconds:state.clockSeconds}],
    riders:state.positions.map(row=>({
      riderId:row.riderId,teamId:row.teamId,
      roadId:row.roadId,
      distanceM:row.roadId==='peloton'?
        state.sourceKm*1000:row.distanceM,
      clockSeconds:state.clockSeconds,
      reserve:row.energy,
      quietKm:row.quietKm}))};
}

function recordGeneralRace({input,grid},version){
  const featureVersion=version===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION?
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION:version;
  const earlyFinish=featureVersion===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V2_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V3_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V4_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V5_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION;
  const oneAttackSlot=featureVersion===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V4_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V5_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION;
  const positionChoice=featureVersion===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V5_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION;
  const sprintHandoff=featureVersion===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION||
    featureVersion===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION;
  const sampledFinish=featureVersion===
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION;
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    input.positionPassingCorridorCount!==1||
    !Array.isArray(input.kilometres)||
    input.kilometres.length<2)
    throw new Error(
      'General position race needs committed inputs.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid});
  let state={...start,
    frontDistanceM:0,
    leaderRiderId:
      start.firstLeaderPlan.leaderRiderId,
    separateRoadRiderIds:[]};
  const steps=[];
  const checkpointCrossings=[];
  const earlyFinishCrossings=[];
  for(const segment of input.kilometres){
    const prior=state;
    const sourcePrior=sourceChoiceState(prior);
    const attackChoices=
      (positionChoice?
        choosePhysicalFirstBoundaryAttacksV2:
        choosePhysicalFirstBoundaryAttacksV1)({
        prior:sourcePrior,segment,
        teams:input.teams,
        stakes:input.stakes,
        kilometres:input.kilometres});
    const attempts=attackChoices.filter(row=>
      row.choice==='attempt_paid_attack');
    if(attempts.length>1&&!oneAttackSlot)
      throw new Error(
        `General position race needs multiple paid attacks at km ${segment.km}.`);
    const rankedAttempts=oneAttackSlot?
      [...attempts].sort((a,b)=>
        b.perceivedAbilityAtChoice-
          a.perceivedAbilityAtChoice||
        a.riderId.localeCompare(b.riderId)):
      attempts;
    const selectedAttempt=rankedAttempts[0]??null;
    const attackCapacityRefusals=oneAttackSlot?
      rankedAttempts.slice(1).map(choice=>({
        version,sourceKm:segment.km,
        riderId:choice.riderId,
        teamId:choice.teamId,
        prioritizedRiderId:selectedAttempt.riderId,
        reason:'single_boundary_attack_slot',
        attemptedChoice:choice,
        paidFromReserve:0,
        recordedPaidDeparture:false})):[];
    const leaderPlan=planPhysicalFirstPelotonLeaderV1({
      prior:sourcePrior,segment,
      teams:input.teams,
      stakes:input.stakes,
      emergencyFrontWorkers:
        input.emergencyFrontWorkers??[]});
    const proposedFrontRiderId=
      leaderPlan.leaderRiderId!==
        prior.leaderRiderId?
        leaderPlan.leaderRiderId:null;
    let frontQuote=null;
    if(proposedFrontRiderId){
      try{frontQuote=quotePhysicalFirstPositionFrontPassV1({
        prior,segment,input});}
      catch(error){
        const peloton=prior.positions.filter(row=>
          row.roadId==='peloton');
        throw new Error(`Front pass quote failed at km ${segment.km}; `+
          `peloton riders ${peloton.length}; `+
          `first ${peloton[0]?.riderId} at `+
          `${peloton[0]?.distanceM} m; `+
          `expected ${(segment.km-1)*1000} m; `+
          `previous pass ${prior.frontPassEvent?.toRiderId??'none'}; `+
          `previous attack ${prior.attackDepartureEvent?.toRiderId??'none'}; `+
          `previous catches ${prior.soloCatchEvents?.map(row=>
            row.riderId).join(',')??'none'}; `+
          `previous contact ${prior.contactEvents?.length??0}; `+
          `first paid roles ${prior.decisions?.find(row=>
            row.riderId===peloton[0]?.riderId)?.legs.map(row=>
              row.role).join(',')??'none'}; `+
          `front ${prior.leaderRiderId}: ${error.message}`,
        {cause:error});
      }
    }
    const preSprintRunway=segment.km<
      input.kilometres.length||
      !sprintHandoff||
      frontQuote?.firstDistanceM<
        700-prior.grid.wheelSpacingM;
    const frontPassCandidateId=frontQuote&&
      preSprintRunway?
      proposedFrontRiderId:null;
    const frontPassRefusal=proposedFrontRiderId&&
      !frontPassCandidateId?{
        version,
        sourceKm:segment.km,
        riderId:proposedFrontRiderId,
        reason:frontQuote?
          'insufficient_pre_sprint_runway':
          'no_payable_front_pass'}:null;
    if(frontPassCandidateId&&
      selectedAttempt?.riderId===frontPassCandidateId)
      throw new Error(
        'Named front worker cannot also depart without a paid replacement.');
    let sharedRoad;
    try{
      sharedRoad=(version===
      PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION?
        advancePhysicalFirstPositionSharedRoadKmV16:
        version===
      PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION||
        version===PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION?
        advancePhysicalFirstPositionSharedRoadKmV15:
        version===
        PHYSICAL_FIRST_POSITION_GENERAL_RACE_V5_VERSION?
        advancePhysicalFirstPositionSharedRoadKmV14:
        version===
        PHYSICAL_FIRST_POSITION_GENERAL_RACE_V4_VERSION?
        advancePhysicalFirstPositionSharedRoadKmV13:
        version===
        PHYSICAL_FIRST_POSITION_GENERAL_RACE_V3_VERSION?
        advancePhysicalFirstPositionSharedRoadKmV12:
        earlyFinish?
          advancePhysicalFirstPositionSharedRoadKmV11:
        advancePhysicalFirstPositionSharedRoadKmV10)({
        priorPeloton:prior,
        segment,input,
        frontPassCandidateId,
        attackChoice:selectedAttempt});
    }catch(error){
      error.sourceKm=segment.km;
      error.completedThroughKm=segment.km-1;
      error.activeSoloRiderIds=prior.positions
        .filter(row=>row.roadId===
          `solo:${row.riderId}`)
        .map(row=>row.riderId);
      error.attackAttemptRiderIds=attempts
        .map(row=>row.riderId);
      error.frontPassCandidateId=
        frontPassCandidateId;
      throw error;
    }
    checkpointCrossings.push(...sharedRoad
      .checkpointCrossings);
    if(earlyFinish)
      earlyFinishCrossings.push(...sharedRoad
        .earlyFinishCrossings);
    steps.push({sourceKm:segment.km,
      attackChoices,leaderPlan,
      ...(oneAttackSlot?{
        attackCapacityRefusals}:{}),
      ...(frontPassRefusal?{
        frontPassRefusal}:{}),
      sharedRoad});
    state=sharedRoad;
  }
  const tail=(sampledFinish?
    settlePhysicalFirstPositionFixedLaneFinishV3:
    sprintHandoff?
    settlePhysicalFirstPositionFixedLaneFinishV2:
    settlePhysicalFirstPositionFixedLaneFinishV1)({
    prior:state,input,
    ...(earlyFinish?{earlyFinishCrossings}:{})});
  checkpointCrossings.push(...tail.checkpointCrossings);
  const kmCount=input.kilometres.length;
  const riderCount=start.positions.length;
  const beforeFinish=checkpointCrossings.filter(row=>
    row.km<kmCount);
  const finishCrossings=tail.finishCrossings;
  const crossingKeys=new Set([
    ...beforeFinish.map(row=>
      `${row.riderId}:${row.km}`),
    ...finishCrossings.map(row=>
      `${row.riderId}:${kmCount}`)]);
  const decisionCount=steps.reduce((sum,step)=>
    sum+step.sharedRoad.decisions.length,0);
  const terminalDecisionCount=earlyFinish?
    steps.reduce((sum,step)=>sum+
      step.sharedRoad.decisions.filter(row=>
        row.choice==='already_finished').length,0):0;
  if(steps.length!==kmCount||
    decisionCount!==riderCount*kmCount||
    beforeFinish.length!==riderCount*(kmCount-1)||
    finishCrossings.length!==riderCount||
    crossingKeys.size!==riderCount*kmCount||
    new Set(finishCrossings.map(row=>
      row.riderId)).size!==riderCount)
    throw new Error(
      'General position race lacks paid decisions or crossings.');
  return {version,
  raceSeed:input.raceSeed,
  inputHash:start.inputHash,
  positionModelConfigHash:
    steps[0].sharedRoad.positionModelConfigHash,
  plannedKm:kmCount,
  completedThroughKm:steps.length,
  riderCount,decisionCount,
  ...(earlyFinish?{
    terminalDecisionCount,
    activeDecisionCount:decisionCount-
      terminalDecisionCount}:{}),
  start,steps,tail,
  ...(sprintHandoff?{
    finaleSprintDecisions:tail.sprintDecisions,
    finaleSprintLaneEvents:
      tail.sprintLaneEvents,
    finaleSprintPassEvents:
      tail.sprintPassEvents,
    finaleFinishTieObservations:
      tail.finishTieObservations}:{}),
  ...(earlyFinish?{earlyFinishCrossings}:{}),
  checkpointCrossings,finishCrossings,
  attackDepartureEvents:steps.flatMap(step=>
    step.sharedRoad.attackDepartureEvent?
      [step.sharedRoad.attackDepartureEvent]:[]),
  attackRefusals:steps.flatMap(step=>
    step.sharedRoad.attackRefusal?
      [step.sharedRoad.attackRefusal]:[]),
  ...(oneAttackSlot?{
    attackCapacityRefusals:steps.flatMap(step=>
      step.attackCapacityRefusals)}:{}),
  frontPassEvents:steps.flatMap(step=>
    step.sharedRoad.frontPassEvent?
      [step.sharedRoad.frontPassEvent]:[]),
  frontPassRefusals:steps.flatMap(step=>
    step.frontPassRefusal?
      [step.frontPassRefusal]:[]),
  soloCatchEvents:steps.flatMap(step=>
    step.sharedRoad.soloCatchEvents),
  contactEvents:steps.flatMap(step=>
    step.sharedRoad.contactEvents),
  contactPaceEvents:steps.flatMap(step=>
    step.sharedRoad.contactPaceEvents),
  laneChangeEvents:steps.flatMap(step=>
    step.sharedRoad.laneChangeEvents),
  sourceGroupClockPositionsUsedForMovement:false,
  officialResults:false,
  viewerReady:false};
}

export function recordPhysicalFirstPositionGeneralRaceV1(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V1_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV2(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V2_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV3(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V3_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV4(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V4_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV5(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V5_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV6(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V6_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV7(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V7_VERSION);
}

export function recordPhysicalFirstPositionGeneralRaceV8(request){
  return recordGeneralRace(request,
    PHYSICAL_FIRST_POSITION_GENERAL_RACE_V8_VERSION);
}

export function replayPhysicalFirstPositionGeneralRaceV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV1(input)))
    throw new Error(
      'General position race differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV2(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV2(input)))
    throw new Error(
      'General position race v2 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV3(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV3(input)))
    throw new Error(
      'General position race v3 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV4(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV4(input)))
    throw new Error(
      'General position race v4 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV5(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV5(input)))
    throw new Error(
      'General position race v5 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV6(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV6(input)))
    throw new Error(
      'General position race v6 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV7(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV7(input)))
    throw new Error(
      'General position race v7 differs from paid movement.');
  return recorded;
}

export function replayPhysicalFirstPositionGeneralRaceV8(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionGeneralRaceV8(input)))
    throw new Error(
      'General position race v8 differs from paid movement.');
  return recorded;
}
