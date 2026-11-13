import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePhysicalFirstRoadV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';
import {resolvePhysicalFirstSoloContactV1} from
  '../../lib/engine/v2/physical-first-solo-contact-v1.mjs';

const fixture=(breakWork='cooperate')=>{
  const segment={km:1,terrain:'flat',
    gradientPct:0,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const teams=[['a',65],['b',70]].map(
    ([id,flat])=>({id,riders:[{id,flat,
      hills:flat,mountain:flat,endurance:65,
      form:50,fatigue:0}],orders:{helperIds:[],
      baseline:{effort:'steady',breakWork,
        attack:'none'},phases:[]}}));
  const prior={sourceKm:0,roads:[
    {roadId:'solo:a',riderIds:['a'],clockSeconds:100},
    {roadId:'solo:b',riderIds:['b'],clockSeconds:100.2}],
  riders:[['a',100],['b',100.2]].map(([riderId,clockSeconds])=>
    ({riderId,teamId:riderId,
      roadId:`solo:${riderId}`,
      distanceM:0,clockSeconds,reserve:100,
      quietKm:0}))};
  const stakes=['a','b'].map(teamId=>({teamId,
    sportingGoal:'break_stage',
    sportingCaptainId:teamId}));
  const kilometres=[segment];
  const steps=['a','b'].map(riderId=>
    advancePhysicalFirstRoadV1({prior,
      roadId:`solo:${riderId}`,
      leaderRiderId:riderId,
      planVersion:'solo-continuation-test',
      segment,kilometres,teams,stakes}));
  return {prior,firstStep:steps[0],
    secondStep:steps[1],segment,
    kilometres,teams,stakes};
};

test('two paid solos meet and pay one leader plus shelter',()=>{
  const input=fixture();
  const result=resolvePhysicalFirstSoloContactV1(input);
  assert.ok(result.atDistanceM>0&&
    result.atDistanceM<1000);
  assert.equal(result.road.riderIds.length,2);
  assert.equal(result.road.leaderRiderId,'b');
  assert.equal(result.road.startClockSeconds,
    result.atClockSeconds);
  assert.equal(result.finishes.length,2);
  assert.ok(result.finishes.every(row=>
    row.endDistanceM===1000&&
    row.clockSeconds===
      result.road.finishClockSeconds));
  assert.equal(result.road.riderDecisions.filter(
    row=>row.role==='leader').length,1);
  assert.equal(result.road.riderDecisions.filter(
    row=>row.role==='sheltered').length,1);
  assert.ok(result.road.riderDecisions.every(row=>
    Math.abs(row.approachCost+
      row.remainderCost-row.paidFromReserve)<1e-9));
});

test('contact refuses forged solo work and sit-on leaders',()=>{
  const input=fixture();
  input.firstStep.finishes[0]
    .paidFromReserve+=1;
  assert.throws(()=>resolvePhysicalFirstSoloContactV1(
    input),/approach differs from paid road/);
  const idle=fixture('sit_on');
  assert.throws(()=>resolvePhysicalFirstSoloContactV1(
    idle),/lacks a payable shared leader/);
});
