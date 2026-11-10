// Experimental one-clock positional race. Later ordered attacks must
// earn separation through paid shared-road motion; no group gap is used.
import {isDeepStrictEqual} from 'node:util';
import {choosePhysicalFirstBoundaryAttacksV1} from
  './physical-first-attack-choice-v1.mjs';
import {planPhysicalFirstPelotonLeaderV1} from
  './physical-first-leader-plan-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  './physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionAttackDepartureKmV1} from
  './physical-first-position-attack-departure-km-v1.mjs';
import {advancePhysicalFirstPositionSharedRoadKmV6} from
  './physical-first-position-shared-road-km-v1.mjs';
import {settlePhysicalFirstPositionFixedLaneFinishV1} from
  './physical-first-position-fixed-lane-finish-v1.mjs';

export const PHYSICAL_FIRST_POSITION_MULTI_ATTACK_CONTACT_RACE_VERSION=
  'physical-first-position-multi-attack-contact-race-1';

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

function choicesFor(prior,segment,input){
  return choosePhysicalFirstBoundaryAttacksV1({
    prior:choicePrior(prior),segment,
    teams:input.teams,stakes:input.stakes,
    kilometres:input.kilometres});
}

function planFront(prior,segment,input){
  return planPhysicalFirstPelotonLeaderV1({
    prior:choicePrior(prior),segment,
    teams:input.teams,stakes:input.stakes,
    emergencyFrontWorkers:
      input.emergencyFrontWorkers??[]});
}

export function recordPhysicalFirstPositionMultiAttackContactRaceV1({
  input,grid}){
  if(input?.positionModelVersion!==
      PHYSICAL_FIRST_POSITION_START_V2_VERSION||
    input.positionPassingCorridorCount!==1||
    !Array.isArray(input.kilometres)||
    input.kilometres.length<2)
    throw new Error(
      'Multi-attack contact race needs committed inputs.');
  const start=createPhysicalFirstPositionStartV2({
    input,grid});
  const firstSegment=input.kilometres[0];
  const firstChoices=choicesFor(start,
    firstSegment,input);
  const firstAttempts=firstChoices.filter(row=>
    row.choice==='attempt_paid_attack');
  if(firstAttempts.length!==1)
    throw new Error(
      'Multi-attack race needs one paid first departure.');
  const departure=advancePhysicalFirstPositionAttackDepartureKmV1({
    prior:start,segment:firstSegment,
    input,choice:firstAttempts[0]});
  const steps=[{sourceKm:1,
    attackChoices:firstChoices,departure}];
  const checkpointCrossings=[
    ...departure.peloton.checkpointCrossings,
    ...departure.soloCheckpointCrossings];
  let state=departure.peloton;
  let firstSolo=departure.soloPosition;
  for(const segment of input.kilometres.slice(1)){
    const prior=state;
    const active={...prior,
      positions:firstSolo?
        [...prior.positions,firstSolo]:
        prior.positions};
    const attackChoices=choicesFor(active,
      segment,input);
    const attempts=attackChoices.filter(row=>
      row.choice==='attempt_paid_attack');
    if(attempts.length>1)
      throw new Error(
        'Multi-attack race needs simultaneous paid departures.');
    const leaderPlan=planFront(active,
      segment,input);
    const frontPassCandidateId=
      leaderPlan.leaderRiderId!==
        prior.leaderRiderId?
        leaderPlan.leaderRiderId:null;
    // One paid passing corridor cannot host two independent front moves
    // at the same boundary. Keep the ordered attempt as a refusal.
    const assignmentRefusal=attempts.length&&
      frontPassCandidateId?{
        version:
          PHYSICAL_FIRST_POSITION_MULTI_ATTACK_CONTACT_RACE_VERSION,
        sourceKm:segment.km,
        riderId:attempts[0].riderId,
        competingFrontRiderId:
          frontPassCandidateId,
        reason:'front_assignment_conflict'}:null;
    const sharedRoad=
      advancePhysicalFirstPositionSharedRoadKmV6({
        priorPeloton:prior,
        ...(firstSolo?{
          priorSolos:[firstSolo]}:{}),
        segment,input,
        frontPassCandidateId,
        attackChoice:assignmentRefusal?
          null:attempts[0]??null});
    firstSolo=null;
    checkpointCrossings.push(...sharedRoad
      .checkpointCrossings);
    steps.push({sourceKm:segment.km,
      attackChoices,leaderPlan,
      ...(assignmentRefusal?{
        assignmentRefusal}:{}),sharedRoad});
    state=sharedRoad;
  }
  const tail=settlePhysicalFirstPositionFixedLaneFinishV1({
    prior:state,input});
  checkpointCrossings.push(...tail.checkpointCrossings);
  const finishKm=input.kilometres.length;
  const riderCount=start.positions.length;
  const beforeFinish=checkpointCrossings.filter(row=>
    row.km<finishKm);
  const finishCrossings=tail.finishCrossings;
  const crossingKeys=new Set([
    ...beforeFinish.map(row=>
      `${row.riderId}:${row.km}`),
    ...finishCrossings.map(row=>
      `${row.riderId}:${finishKm}`)]);
  const decisionCount=departure.peloton
    .decisions.length+1+
    steps.slice(1).reduce((sum,step)=>
      sum+step.sharedRoad.decisions.length,0);
  if(steps.length!==finishKm||
    decisionCount!==riderCount*finishKm||
    beforeFinish.length!==
      riderCount*(finishKm-1)||
    finishCrossings.length!==riderCount||
    crossingKeys.size!==riderCount*finishKm||
    new Set(finishCrossings.map(row=>
      row.riderId)).size!==riderCount)
    throw new Error(
      'Multi-attack race lacks paid decisions or crossings.');
  const attackDepartureEvents=[
    departure.passEvent,
    ...steps.flatMap(step=>
      step.sharedRoad?.attackDepartureEvent?
        [step.sharedRoad.attackDepartureEvent]:[])];
  return {version:
    PHYSICAL_FIRST_POSITION_MULTI_ATTACK_CONTACT_RACE_VERSION,
  raceSeed:input.raceSeed,
  inputHash:start.inputHash,
  positionModelConfigHash:steps[1]
    .sharedRoad.positionModelConfigHash,
  plannedKm:finishKm,
  completedThroughKm:steps.length,
  riderCount,decisionCount,
  start,steps,tail,
  checkpointCrossings,finishCrossings,
  attackDepartureEvents,
  attackRefusals:steps.flatMap(step=>
    [step.assignmentRefusal,
      step.sharedRoad?.attackRefusal]
      .filter(Boolean)),
  soloCatchEvents:steps.flatMap(step=>
    step.sharedRoad?.soloCatchEvents??[]),
  contactEvents:steps.flatMap(step=>
    step.sharedRoad?.contactEvents??[]),
  sourceGroupClockPositionsUsedForMovement:false,
  officialResults:false,
  viewerReady:false};
}

export function replayPhysicalFirstPositionMultiAttackContactRaceV1(
  input,recorded){
  if(!isDeepStrictEqual(recorded,
    recordPhysicalFirstPositionMultiAttackContactRaceV1(input)))
    throw new Error(
      'Multi-attack contact race differs from paid movement.');
  return recorded;
}
