import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSyntheticPositionCatchV1} from
  './synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionGeneralRaceV1,
  replayPhysicalFirstPositionGeneralRaceV1} from
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
