import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePhysicalFirstRoadV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';
import {resolvePhysicalFirstBunchCatchV1} from
  '../../lib/engine/v2/physical-first-bunch-catch-v1.mjs';

const fixture=(soloFlat=65)=>{
  const segment={km:1,terrain:'flat',
    gradientPct:0,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const teams=[['a',soloFlat],['b',70]].map(
    ([id,flat])=>({id,riders:[{id,flat,
      hills:flat,mountain:flat,endurance:65,
      form:50,fatigue:0}],orders:{helperIds:[id],
      baseline:{effort:'steady',breakWork:'cooperate',
        frontWork:'rotate',attack:'none'},phases:[]}}));
  const prior={sourceKm:0,roads:[
    {roadId:'peloton',riderIds:['b'],
      clockSeconds:100.2},
    {roadId:'solo:a',riderIds:['a'],
      clockSeconds:100}],
  riders:[['a',100,'solo:a'],
    ['b',100.2,'peloton']].map(
    ([riderId,clockSeconds,roadId])=>({
      riderId,teamId:riderId,roadId,
      distanceM:0,clockSeconds,
      reserve:100,quietKm:0}))};
  const stakes=['a','b'].map(teamId=>({teamId,
    sportingGoal:'sprint_finish',
    sportingCaptainId:teamId}));
  const kilometres=[segment];
  const pelotonStep=advancePhysicalFirstRoadV1({
    prior,roadId:'peloton',
    leaderRiderId:'b',planVersion:'test',
    segment,kilometres,teams,stakes});
  const soloStep=advancePhysicalFirstRoadV1({
    prior,roadId:'solo:a',
    leaderRiderId:'a',planVersion:'test',
    segment,kilometres,teams,stakes});
  return {prior,pelotonStep,soloStep,
    segment,kilometres,teams,stakes};
};

test('caught solo pays approach then joins bunch shelter',()=>{
  const input=fixture();
  const result=resolvePhysicalFirstBunchCatchV1(input);
  assert.ok(result.event.atDistanceM>0&&
    result.event.atDistanceM<1000);
  assert.equal(result.joined,true);
  assert.deepEqual(result.road.riderIds,
    ['b','a']);
  assert.equal(result.road.leaderRiderId,'b');
  assert.equal(result.finish.clockSeconds,
    input.pelotonStep.road.finishClockSeconds);
  assert.ok(result.finish.energyAfter<100);
  assert.equal(result.event.choice,
    'join_paid_bunch_shelter');
  assert.equal(result.road.riderDecisions.filter(
    row=>row.role==='leader').length,1);
});

test('unholdable caught rider slides through on paid solo road',()=>{
  const result=resolvePhysicalFirstBunchCatchV1(
    fixture(0));
  assert.equal(result.joined,false);
  assert.equal(result.finish,null);
  assert.deepEqual(result.road.riderIds,['b']);
  assert.equal(result.event.choice,
    'slide_through_unholdable_bunch');
});

test('catch refuses a forged solo payment',()=>{
  const input=fixture();
  input.soloStep.finishes[0]
    .paidFromReserve+=1;
  assert.throws(()=>resolvePhysicalFirstBunchCatchV1(
    input),/differs from paid road/);
});
