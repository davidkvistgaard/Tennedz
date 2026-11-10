import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSyntheticPositionCatchV1} from
  './synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {recordPhysicalFirstPositionMultiAttackContactRaceV1,
  replayPhysicalFirstPositionMultiAttackContactRaceV1} from
  '../../lib/engine/v2/physical-first-position-multi-attack-contact-race-v1.mjs';

function twoAttackRequest(){
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain',
    oneTimeAttack:true,
    secondAttackAtKm:5});
  request.input.positionPassingCorridorCount=1;
  return request;
}

test('two ordered attacks earn separate paid departures with full replay',()=>{
  const request=twoAttackRequest();
  const race=recordPhysicalFirstPositionMultiAttackContactRaceV1(
    request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.riderCount,16);
  assert.equal(race.decisionCount,320);
  assert.equal(race.checkpointCrossings.length,304);
  assert.equal(race.finishCrossings.length,16);
  assert.deepEqual(race.attackDepartureEvents.map(row=>
    row.sourceKm),[1,5]);
  assert.deepEqual(race.attackDepartureEvents.map(row=>
    row.riderId??row.toRiderId),
  ['team-0-7','team-0-1']);
  assert.ok(race.contactEvents.some(row=>
    row.components.some(component=>
      component.includes('team-0-7')&&
      component.includes('team-0-1'))));
  assert.deepEqual(
    replayPhysicalFirstPositionMultiAttackContactRaceV1(
      request,race),race);
  const forged=structuredClone(race);
  forged.attackDepartureEvents[1].surgePaidFromReserve=0;
  assert.throws(()=>
    replayPhysicalFirstPositionMultiAttackContactRaceV1(
      request,forged),/differs from paid movement/);
});

test('source and positions both finish, with rear membership mismatch recorded',()=>{
  const request=twoAttackRequest();
  const source=runPhysicalFirstWholeRaceProbeV1(
    request.input);
  const race=recordPhysicalFirstPositionMultiAttackContactRaceV1(
    request);
  assert.equal(source.states.length-1,20);
  const sourceRear=source.states.at(-1).roads.find(row=>
    row.roadId.startsWith('rear:'));
  assert.deepEqual([...sourceRear.riderIds].sort(),
    ['team-0-1','team-0-7']);
  const positionRear=race.steps.at(-1)
    .sharedRoad.positions.filter(row=>
      row.roadId.startsWith('rear:'));
  assert.equal(positionRear.length,2);
  assert.notEqual(positionRear[0].roadId,
    positionRear[1].roadId);
});

test('competing front assignment records a refusal, not a launch',()=>{
  const request=prepareSyntheticPositionCatchV1({
    teamCount:2,kmCount:20,
    profile:'hill_then_mountain',
    oneTimeAttack:true,
    frontWorkerAtKm:2,
    secondAttackAtKm:5});
  request.input.positionPassingCorridorCount=1;
  const race=recordPhysicalFirstPositionMultiAttackContactRaceV1(
    request);
  assert.equal(race.completedThroughKm,20);
  assert.equal(race.attackDepartureEvents.length,1);
  assert.ok(race.attackRefusals.some(row=>
    row.sourceKm===5&&
    row.reason==='front_assignment_conflict'));
  assert.deepEqual(
    replayPhysicalFirstPositionMultiAttackContactRaceV1(
      request,race),race);
});
