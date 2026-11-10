import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSyntheticPositionCatchV1} from
  './synthetic-position-catch-fixture-v1.mjs';
import {preparePhysicalFirstSplitMotorInputV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {PHYSICAL_FIRST_POSITION_START_V2_VERSION} from
  '../../lib/engine/v2/physical-first-position-start-v2.mjs';
import {advancePhysicalFirstPositionSharedRoadKmV11} from
  '../../lib/engine/v2/physical-first-position-shared-road-km-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV1,
  replayPhysicalFirstPositionGeneralRaceV1,
  recordPhysicalFirstPositionGeneralRaceV2,
  replayPhysicalFirstPositionGeneralRaceV2} from
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
