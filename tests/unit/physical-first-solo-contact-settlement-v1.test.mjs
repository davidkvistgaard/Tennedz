import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePhysicalFirstRoadV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';
import {settlePhysicalFirstSoloCrossingV1} from
  '../../lib/engine/v2/physical-first-solo-contact-settlement-v1.mjs';

const fixture=()=>{
  const segment={km:1,terrain:'flat',
    gradientPct:0,surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const teams=[['a',65],['b',70],['c',70]]
    .map(([id,flat])=>({id,riders:[{id,flat,
      hills:flat,mountain:flat,endurance:65,
      form:50,fatigue:0}],orders:{helperIds:[],
      baseline:{effort:'steady',
        breakWork:'cooperate',attack:'none'},
      phases:[]}}));
  const prior={sourceKm:0,roads:[
    {roadId:'peloton',riderIds:['c'],
      clockSeconds:200},
    {roadId:'solo:a',riderIds:['a'],
      clockSeconds:100},
    {roadId:'solo:b',riderIds:['b'],
      clockSeconds:100.2}],
  riders:[['a',100,'solo:a'],
    ['b',100.2,'solo:b'],
    ['c',200,'peloton']].map(
    ([riderId,clockSeconds,roadId])=>({
      riderId,teamId:riderId,roadId,
      distanceM:0,clockSeconds,
      reserve:100,quietKm:0}))};
  const stakes=['a','b','c'].map(teamId=>({
    teamId,sportingGoal:'break_stage',
    sportingCaptainId:teamId}));
  const kilometres=[segment];
  const steps=prior.roads.map(road=>
    advancePhysicalFirstRoadV1({prior,
      roadId:road.roadId,
      leaderRiderId:road.riderIds[0],
      planVersion:'test',segment,kilometres,
      teams,stakes}));
  return {prior,roads:steps.map(step=>step.road),
    finishes:steps.flatMap(step=>step.finishes),
    launchEvents:[],otherSteps:steps.slice(1),
    pelotonStep:steps[0],segment,kilometres,
    teams,stakes};
};

test('settlement replaces paid crossing solos with one rear road',()=>{
  const input=fixture();
  const result=settlePhysicalFirstSoloCrossingV1(
    input);
  assert.equal(result.events.length,1);
  assert.equal(result.roads.length,2);
  assert.equal(result.finishes.length,3);
  assert.equal(result.events[0]
    .recordedPaidContact,true);
  assert.equal(result.roads.find(row=>
    row.kind==='rear_group').riderIds.length,2);
  assert.deepEqual(settlePhysicalFirstSoloCrossingV1(
    input),result);
});

test('settlement rejects a falsified solo approach',()=>{
  const input=fixture();
  input.otherSteps[0].finishes[0]
    .paidFromReserve+=1;
  assert.throws(()=>settlePhysicalFirstSoloCrossingV1(
    input),/approach differs from paid road/);
});
