import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSyntheticPositionCatchV1} from
  './synthetic-position-catch-fixture-v1.mjs';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {createPhysicalFirstPositionStartV2,
  PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionSharedRoadKmV11,
  advancePhysicalFirstPositionSharedRoadKmV13} from
  '../../lib/engine/v2/physical-first-position-shared-road-km-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV1,
  replayPhysicalFirstPositionGeneralRaceV1,
  recordPhysicalFirstPositionGeneralRaceV2,
  replayPhysicalFirstPositionGeneralRaceV2,
  recordPhysicalFirstPositionGeneralRaceV3,
  replayPhysicalFirstPositionGeneralRaceV3,
  recordPhysicalFirstPositionGeneralRaceV4,
  replayPhysicalFirstPositionGeneralRaceV4,
  recordPhysicalFirstPositionGeneralRaceV5,
  replayPhysicalFirstPositionGeneralRaceV5,
  recordPhysicalFirstPositionGeneralRaceV6,
  replayPhysicalFirstPositionGeneralRaceV6} from
  '../../lib/engine/v2/physical-first-position-general-race-v1.mjs';

test('a connected start records every rider without an attack',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  const race=recordPhysicalFirstPositionGeneralRaceV1(
    request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.decisionCount,320);
  assert.equal(race.checkpointCrossings.length,304);
  assert.equal(race.finishCrossings.length,16);
  assert.equal(race.attackDepartureEvents.length,0);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV1(
      request,race),race);
  const forged=structuredClone(race);
  forged.steps[0].sharedRoad.decisions[0]
    .energyAfter=0;
  assert.throws(()=>
    replayPhysicalFirstPositionGeneralRaceV1(
      request,forged),/differs from paid movement/);
});

test('membership-only contact events preserve paid movement and finish',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,weakBunchCount:2,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  const prior=recordPhysicalFirstPositionGeneralRaceV2(request);
  const race=recordPhysicalFirstPositionGeneralRaceV3(request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.decisionCount,320);
  assert.equal(race.checkpointCrossings.length,304);
  assert.equal(race.finishCrossings.length,16);
  assert.ok(prior.contactEvents.length>1000);
  assert.ok(race.contactEvents.length<20);
  assert.deepEqual(race.steps.map(step=>
    step.sharedRoad.positions.map(({version,...row})=>row)),
  prior.steps.map(step=>
    step.sharedRoad.positions.map(({version,...row})=>row)));
  assert.deepEqual(race.steps.map(step=>
    step.sharedRoad.decisions.map(({version,...row})=>row)),
  prior.steps.map(step=>
    step.sharedRoad.decisions.map(({version,...row})=>row)));
  assert.deepEqual(race.checkpointCrossings,
    prior.checkpointCrossings);
  assert.deepEqual(race.finishCrossings,
    prior.finishCrossings);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV3(request,race),race);
  const forged=structuredClone(race);
  forged.contactEvents[0].observedAtClockSeconds+=1;
  assert.throws(()=>
    replayPhysicalFirstPositionGeneralRaceV3(request,forged),
  /differs from paid movement/);
});

test('an early solo finish retains its paid clock and freezes the rider',()=>{
  const prepared=preparePhysicalFirstSplitMotorInputV1(
    'men',{terrain:'rolling',chase:'all',
      attack:'selective',seed:'preview-recorded-road-1'});
  const request={input:{...prepared.input,
    positionModelVersion:
      PHYSICAL_FIRST_POSITION_START_V2_VERSION,
    positionPassingCorridorCount:1},
  grid:{laneCount:4,wheelSpacingM:2.5,
    laneStaggerM:.08}};
  const race=recordPhysicalFirstPositionGeneralRaceV2(
    request);
  assert.equal(race.completedThroughKm,120);
  assert.equal(race.decisionCount,14_400);
  assert.ok(race.terminalDecisionCount>0);
  assert.equal(race.activeDecisionCount+
    race.terminalDecisionCount,14_400);
  assert.equal(race.checkpointCrossings.length,
    120*119);
  assert.equal(race.finishCrossings.length,120);
  assert.ok(race.earlyFinishCrossings.length>0);
  const early=race.earlyFinishCrossings.find(row=>
    row.clockSeconds<race.steps.at(-1)
      .sharedRoad.clockSeconds);
  assert.ok(early);
  const finishingStep=race.steps.find(step=>
    step.sharedRoad.earlyFinishCrossings.some(row=>
      row.riderId===early.riderId));
  assert.ok(finishingStep.sourceKm<120);
  for(const step of race.steps.slice(
    finishingStep.sourceKm)){
    const decision=step.sharedRoad.decisions.find(row=>
      row.riderId===early.riderId);
    assert.equal(decision.choice,'already_finished');
    assert.equal(decision.paidDistanceM,0);
    assert.equal(decision.energyAfter,
      decision.energyBefore);
  }
  assert.equal(race.finishCrossings.find(row=>
    row.riderId===early.riderId)
    .clockSeconds,early.clockSeconds);
  const forgedPrior=structuredClone(
    finishingStep.sharedRoad);
  forgedPrior.positions.find(row=>
    row.riderId===early.riderId)
    .finishedAtClockSeconds=
      forgedPrior.clockSeconds+1;
  assert.throws(()=>
    advancePhysicalFirstPositionSharedRoadKmV11({
      priorPeloton:forgedPrior,
      segment:request.input.kilometres[
        finishingStep.sourceKm],
      input:request.input}),
  /unpriced rider source/);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV2(
      request,race),race);
  const forged=structuredClone(race);
  forged.earlyFinishCrossings[0].clockSeconds+=1;
  assert.throws(()=>
    replayPhysicalFirstPositionGeneralRaceV2(
      request,forged),/differs from paid movement/);
});

test('a general race records two paid attacks and a shared rear contact',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain',
    oneTimeAttack:true,
    frontWorkerAtKm:2,
    secondAttackAtKm:5});
  request.input.positionPassingCorridorCount=1;
  const source=runPhysicalFirstWholeRaceProbeV1(
    request.input);
  const race=recordPhysicalFirstPositionGeneralRaceV1(
    request);
  assert.deepEqual(race.attackDepartureEvents.map(row=>
    row.sourceKm),[1,5]);
  assert.ok(race.frontPassEvents.length>0);
  const sourceRear=source.states.at(-1).roads.find(row=>
    row.roadId.startsWith('rear:'));
  const modelRear=race.steps.at(-1)
    .sharedRoad.positions.filter(row=>
      row.roadId.startsWith('rear:'));
  assert.deepEqual([...sourceRear.riderIds].sort(),
    modelRear.map(row=>row.riderId).sort());
  assert.equal(new Set(modelRear.map(row=>
    row.roadId)).size,1);
  assert.equal(race.decisionCount,320);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV1(
      request,race),race);
});

test('two ordered attacks receive one paid boundary attempt slot',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,oneTimeAttack:true});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[1].orders.baseline.attack=
    'selective';
  request.input.teams[1].orders.baseline
    .attackRiderId='team-1-7';
  request.input.teams[1].orders.phases.push({
    atKm:1,attack:'none',attackRiderId:null});
  assert.throws(()=>
    recordPhysicalFirstPositionGeneralRaceV3(request),
  /needs multiple paid attacks/);
  const race=recordPhysicalFirstPositionGeneralRaceV4(
    request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.decisionCount,320);
  assert.equal(race.checkpointCrossings.length,304);
  assert.equal(race.finishCrossings.length,16);
  assert.deepEqual(race.steps[0].attackChoices
    .filter(row=>row.choice==='attempt_paid_attack')
    .map(row=>row.riderId),
  ['team-0-7','team-1-7']);
  assert.deepEqual(race.attackDepartureEvents
    .map(row=>row.toRiderId),['team-0-7']);
  assert.deepEqual(race.attackCapacityRefusals
    .map(row=>[row.sourceKm,row.riderId,
      row.prioritizedRiderId,
      row.paidFromReserve,
      row.recordedPaidDeparture]),
  [[1,'team-1-7','team-0-7',0,false]]);
  const start=createPhysicalFirstPositionStartV2(request);
  assert.throws(()=>
    advancePhysicalFirstPositionSharedRoadKmV13({
      priorPeloton:{...start,frontDistanceM:0,
        leaderRiderId:start.firstLeaderPlan.leaderRiderId,
        separateRoadRiderIds:[]},
      segment:request.input.kilometres[0],
      input:request.input,
      attackChoice:race.steps[0].attackChoices.find(row=>
        row.riderId==='team-1-7')}),
  /differs from committed choice/);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV4(request,race),
    race);
  const forged=structuredClone(race);
  forged.attackCapacityRefusals[0]
    .prioritizedRiderId='team-1-7';
  assert.throws(()=>
    replayPhysicalFirstPositionGeneralRaceV4(
      request,forged),/differs from paid movement/);
});

test('a single attack retains the prior paid positional trajectory',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,oneTimeAttack:true});
  request.input.positionPassingCorridorCount=1;
  const prior=recordPhysicalFirstPositionGeneralRaceV3(request);
  const race=recordPhysicalFirstPositionGeneralRaceV4(request);
  assert.equal(race.attackCapacityRefusals.length,0);
  assert.deepEqual(race.steps.map(step=>
    step.sharedRoad.positions.map(({version,...row})=>row)),
  prior.steps.map(step=>
    step.sharedRoad.positions.map(({version,...row})=>row)));
  assert.deepEqual(race.steps.map(step=>
    step.sharedRoad.decisions.map(({version,...row})=>row)),
  prior.steps.map(step=>
    step.sharedRoad.decisions.map(({version,...row})=>row)));
  assert.deepEqual(race.checkpointCrossings,
    prior.checkpointCrossings);
  assert.deepEqual(race.finishCrossings,
    prior.finishCrossings);
});

test('four ordered teams cannot occupy one attack slot',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:4,kmCount:20,oneTimeAttack:true});
  request.input.positionPassingCorridorCount=1;
  for(const team of request.input.teams.slice(1)){
    team.orders.baseline.attack='selective';
    team.orders.baseline.attackRiderId=
      `${team.id}-7`;
    team.orders.phases.push({
      atKm:1,attack:'none',attackRiderId:null});
  }
  const race=recordPhysicalFirstPositionGeneralRaceV4(
    request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.decisionCount,640);
  assert.equal(race.finishCrossings.length,32);
  assert.equal(race.steps[0].attackChoices.filter(row=>
    row.choice==='attempt_paid_attack').length,4);
  assert.equal(race.attackCapacityRefusals.length,3);
  assert.equal(race.attackDepartureEvents.length,1);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV4(request,race),
    race);
});

test('a stronger non-staged attacker still has to pass physically',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,oneTimeAttack:true});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[1].orders.baseline.attack=
    'selective';
  request.input.teams[1].orders.baseline
    .attackRiderId='team-1-7';
  request.input.teams[1].orders.phases.push({
    atKm:1,attack:'none',attackRiderId:null});
  Object.assign(request.input.teams[1].riders[6],{
    flat:100,hills:100,mountain:100,
    acceleration:100,positioning:100});
  const race=recordPhysicalFirstPositionGeneralRaceV4(
    request);
  assert.equal(race.start.stagedAttackRiderId,
    'team-0-7');
  assert.equal(race.attackCapacityRefusals[0]
    .riderId,'team-0-7');
  assert.equal(race.attackDepartureEvents[0]
    .toRiderId,'team-1-7');
  assert.ok(race.attackDepartureEvents[0]
    .surgePaidFromReserve>0);
  assert.deepEqual(
    replayPhysicalFirstPositionGeneralRaceV4(request,race),
    race);
});

test('positional attack choices see a paid teammate ahead in metres',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,oneTimeAttack:true,
    secondAttackAtKm:5});
  request.input.positionPassingCorridorCount=1;
  Object.assign(request.input.teams[0].riders[6],{
    flat:100,hills:100,mountain:100});
  const prior=recordPhysicalFirstPositionGeneralRaceV4(request);
  const race=recordPhysicalFirstPositionGeneralRaceV5(request);
  const fourth=race.steps[3].sharedRoad;
  const forward=fourth.positions.find(row=>
    row.riderId==='team-0-7');
  assert.ok(forward.distanceM>fourth.frontDistanceM+100);
  assert.equal(prior.steps[4].attackChoices[0]
    .forwardRiderCount,0);
  assert.equal(race.steps[4].attackChoices[0]
    .forwardRiderCount,1);
  assert.equal(race.steps[4].attackChoices[0]
    .choice,'attempt_paid_attack');
  assert.deepEqual(race.attackDepartureEvents.map(row=>
    row.sourceKm),[1,5]);
  assert.equal(race.decisionCount,320);
  assert.equal(race.finishCrossings.length,16);
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV5(
    request,race),race);
  const forged=structuredClone(race);
  forged.steps[4].attackChoices[0]
    .forwardRiderCount=0;
  assert.throws(()=>
    replayPhysicalFirstPositionGeneralRaceV5(
      request,forged),/differs from paid movement/);
});

test('position choice version preserves a no-attack paid race',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,weakBunchCount:2,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  const prior=recordPhysicalFirstPositionGeneralRaceV4(request);
  const race=recordPhysicalFirstPositionGeneralRaceV5(request);
  const withoutVersion=rows=>rows.map(({version,...row})=>row);
  assert.deepEqual(race.steps.map(step=>
    withoutVersion(step.sharedRoad.positions)),
  prior.steps.map(step=>
    withoutVersion(step.sharedRoad.positions)));
  assert.deepEqual(race.steps.map(step=>
    withoutVersion(step.sharedRoad.decisions)),
  prior.steps.map(step=>
    withoutVersion(step.sharedRoad.decisions)));
  assert.deepEqual(race.checkpointCrossings,
    prior.checkpointCrossings);
  assert.deepEqual(race.finishCrossings,
    prior.finishCrossings);
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV5(
    request,race),race);
});

test('last 300 metres settle from a paid sprint handoff',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  request.input.stakes[0].sportingGoal='sprint_finish';
  Object.assign(request.input.teams[0].riders[6],{
    hills:65,mountain:65,sprint:100,
    acceleration:100});
  const race=recordPhysicalFirstPositionGeneralRaceV6(request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.decisionCount,320);
  assert.equal(race.checkpointCrossings.length,304);
  assert.equal(race.finishCrossings.length,16);
  assert.equal(race.steps.at(-1).sharedRoad
    .frontDistanceM,19_700);
  assert.equal(race.tail.sprintDecisions.length,16);
  assert.deepEqual(race.tail.sprintDecisions
    .filter(row=>row.choice==='attempt_paid_sprint')
    .map(row=>row.riderId),['team-0-7']);
  assert.ok(race.tail.sprintLaneEvents.some(row=>
    row.riderId==='team-0-7'));
  assert.ok(race.tail.sprintPassEvents.some(row=>
    row.riderId==='team-0-7'&&
    row.passedRiderId==='team-0-2'&&
    row.cumulativeSprintDistanceM>0&&
    row.cumulativeSprintPaidFromReserve>0));
  assert.ok(race.tail.decisions.find(row=>
    row.riderId==='team-0-7').legs.some(leg=>
    leg.role==='sprint'&&leg.paidFromReserve>0));
  assert.equal(race.finishCrossings[0].riderId,
    'team-0-7');
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV6(
    request,race),race);
  const forged=structuredClone(race);
  forged.tail.sprintPassEvents[0]
    .observedAtClockSeconds+=1;
  assert.throws(()=>
    replayPhysicalFirstPositionGeneralRaceV6(
      request,forged),/differs from paid movement/);
});

test('an exhausted sprint captain cannot receive a free launch',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  request.input.stakes[0].sportingGoal='sprint_finish';
  request.input.start.riders.find(row=>
    row.riderId==='team-0-7').reserve=10;
  const race=recordPhysicalFirstPositionGeneralRaceV6(request);
  const choice=race.tail.sprintDecisions.find(row=>
    row.riderId==='team-0-7');
  assert.equal(choice.choice,'hold_sprint');
  assert.equal(choice.reason,'insufficient_reserve');
  assert.ok(!race.tail.sprintLaneEvents.some(row=>
    row.riderId==='team-0-7'));
  assert.ok(!race.tail.decisions.find(row=>
    row.riderId==='team-0-7').legs.some(leg=>
    leg.role==='sprint'));
  assert.equal(race.finishCrossings.length,16);
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV6(
    request,race),race);
});

test('a sprint stake cannot spend another team captain reserve',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  request.input.stakes[0].sportingGoal='sprint_finish';
  request.input.stakes[0].sportingCaptainId='team-1-7';
  assert.throws(()=>
    recordPhysicalFirstPositionGeneralRaceV6(request),
  /Sprint captain is not on the committed team/);
});

test('two sprint captains make separately paid finish choices',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  for(const stake of request.input.stakes)
    stake.sportingGoal='sprint_finish';
  for(const team of request.input.teams)
    Object.assign(team.riders[6],{
      hills:65,mountain:65,
      sprint:100,acceleration:100});
  const race=recordPhysicalFirstPositionGeneralRaceV6(request);
  const sprintIds=race.tail.sprintDecisions
    .filter(row=>row.choice==='attempt_paid_sprint')
    .map(row=>row.riderId).sort();
  assert.deepEqual(sprintIds,
    ['team-0-7','team-1-7']);
  assert.equal(race.finishCrossings.length,16);
  assert.equal(race.decisionCount,320);
  for(const riderId of sprintIds)
    assert.ok(race.tail.decisions.find(row=>
      row.riderId===riderId).paidFromReserve>0);
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV6(
    request,race),race);
});

test('sprint handoff leaves earlier paid kilometres intact',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain'});
  request.input.positionPassingCorridorCount=1;
  request.input.teams[0].orders.baseline.attack='none';
  const prior=recordPhysicalFirstPositionGeneralRaceV5(request);
  const race=recordPhysicalFirstPositionGeneralRaceV6(request);
  const withoutVersion=rows=>rows.map(({version,...row})=>row);
  assert.deepEqual(race.steps.slice(0,-1).map(step=>
    withoutVersion(step.sharedRoad.positions)),
  prior.steps.slice(0,-1).map(step=>
    withoutVersion(step.sharedRoad.positions)));
  assert.deepEqual(race.steps.slice(0,-1).map(step=>
    withoutVersion(step.sharedRoad.decisions)),
  prior.steps.slice(0,-1).map(step=>
    withoutVersion(step.sharedRoad.decisions)));
  assert.equal(race.tail.sprintDecisions.length,16);
  assert.ok(race.tail.sprintDecisions.every(row=>
    row.choice==='hold_sprint'));
  assert.equal(race.tail.sprintLaneEvents.length,0);
  assert.equal(race.tail.sprintPassEvents.length,0);
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV6(
    request,race),race);
});

test('a large sprint field exposes unresolved model clock ties',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:20,kmCount:120,
    weakBunchCount:2,
    profile:'hill_then_mountain',
    oneTimeAttack:false});
  request.input.positionPassingCorridorCount=1;
  for(const stake of request.input.stakes)
    stake.sportingGoal='sprint_finish';
  const race=recordPhysicalFirstPositionGeneralRaceV6(request);
  assert.equal(race.riderCount,160);
  assert.equal(race.finishCrossings.length,160);
  assert.ok(race.finaleFinishTieObservations.length>0);
  for(const tie of race.finaleFinishTieObservations){
    assert.ok(tie.riderIds.length>1);
    const crossingTimes=tie.riderIds.map(riderId=>
      race.finishCrossings.find(row=>
        row.riderId===riderId).clockSeconds);
    assert.ok(Math.max(...crossingTimes)-
      Math.min(...crossingTimes)<=1e-6);
  }
  assert.equal(race.officialResults,false);
  assert.deepEqual(replayPhysicalFirstPositionGeneralRaceV6(
    request,race),race);
});
