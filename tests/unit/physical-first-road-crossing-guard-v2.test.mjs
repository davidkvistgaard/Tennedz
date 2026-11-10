import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoUnpaidRoadCrossingsV1,
  assertNoUnpaidRoadCrossingsV2} from
  '../../lib/engine/v2/physical-first-road-crossing-guard-v1.mjs';
import {prepareSyntheticPositionCatchV1} from
  './synthetic-position-catch-fixture-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1,
  runPhysicalFirstWholeRaceProbeV2,
  replayPhysicalFirstWholeRaceProbeV2} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';

test('paid boundary contact permits two separately priced solos',()=>{
  const prior={sourceKm:2,
    roads:['a','b'].map(id=>({
      roadId:`solo:${id}`,riderIds:[id],
      clockSeconds:100}))};
  const advancedRoads=['a','b'].map(id=>({
    roadId:`solo:${id}`,
    finishClockSeconds:150}));
  const receipt={
    version:'physical-first-rear-boundary-contact-3',
    type:'paid_contact_without_shared_leader',
    atDistanceM:2000,atClockSeconds:100,
    fromRoadIds:['solo:a','solo:b'],
    riderIds:['a','b'],
    approach:['a','b'].map(id=>({
      roadId:`solo:${id}`,riderId:id,
      clockSeconds:100,paidFromReserve:1})),
    recordedPaidContact:true,
    sharedRoadCreated:false,
    reason:'no_payable_shelter_compatible_leader'};
  assert.throws(()=>
    assertNoUnpaidRoadCrossingsV1(prior,
      advancedRoads),/recorded paid contact/);
  assert.equal(assertNoUnpaidRoadCrossingsV2(
    prior,advancedRoads,[receipt]),true);
  const forged=structuredClone(receipt);
  forged.approach[0].paidFromReserve=0;
  assert.throws(()=>
    assertNoUnpaidRoadCrossingsV2(prior,
      advancedRoads,[forged]),
  /lacks paid contact/);
  const wrongClock=structuredClone(receipt);
  wrongClock.approach[0].clockSeconds+=1;
  assert.throws(()=>
    assertNoUnpaidRoadCrossingsV2(prior,
      advancedRoads,[wrongClock]),
  /lacks paid contact/);
});

test('weak workers can continue on independent paid roads',()=>{
  const request=prepareSyntheticPositionCatchV1({
    kmCount:20,profile:'hill_then_mountain',
    weakBunchCount:1});
  request.input.teams[0]
    .orders.baseline.attack='none';
  assert.throws(()=>
    runPhysicalFirstWholeRaceProbeV1(
      request.input),
  /lacks one payable shelter-compatible leader/);
  const race=runPhysicalFirstWholeRaceProbeV2(
    request.input);
  assert.equal(race.completedThroughKm,20);
  assert.deepEqual(
    replayPhysicalFirstWholeRaceProbeV2(
      request.input,race),race);
  const contacts=race.steps.flatMap(step=>
    step.boundaryContactEvents).filter(event=>
    event.type===
      'paid_contact_without_shared_leader');
  assert.ok(contacts.length>0);
  assert.ok(contacts.every(event=>
    event.recordedPaidContact&&
      !event.sharedRoadCreated));
  assert.equal(race.states.at(-1).riders.length,16);
  const forged=structuredClone(race);
  forged.steps.flatMap(step=>
    step.boundaryContactEvents).find(event=>
    event.type===
      'paid_contact_without_shared_leader')
    .approach[0].paidFromReserve=0;
  assert.throws(()=>
    replayPhysicalFirstWholeRaceProbeV2(
      request.input,forged),
  /differs from paid decisions/);
});

test('the new source probe preserves paid races without the new contact',()=>{
  const request=prepareSyntheticPositionCatchV1({
    kmCount:20,profile:'hill_then_mountain'});
  request.input.teams[0]
    .orders.baseline.attack='none';
  const oldRace=runPhysicalFirstWholeRaceProbeV1(
    request.input);
  const newRace=runPhysicalFirstWholeRaceProbeV2(
    request.input);
  const withoutVersion=states=>states.map(
    ({version,...state})=>state);
  assert.deepEqual(withoutVersion(oldRace.states),
    withoutVersion(newRace.states));
});

test('a solo cannot pass an existing rear road without paid contact',()=>{
  const request=prepareSyntheticPositionCatchV1({
    kmCount:20,profile:'hill_then_mountain',
    weakBunchCount:1,oneTimeAttack:true,
    secondAttackAtKm:5,frontWorkerAtKm:2});
  assert.throws(()=>
    runPhysicalFirstWholeRaceProbeV2(request.input),
  error=>error.sourceKm===12&&
    error.message===
      'Road crossing needs recorded paid contact.'&&
    error.sourceEvidence?.firstRoadId
      .startsWith('solo:')&&
    error.sourceEvidence?.secondRoadId
      .startsWith('rear:'));
});
