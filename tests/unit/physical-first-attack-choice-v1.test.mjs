import test from 'node:test';
import assert from 'node:assert/strict';
import {choosePhysicalFirstBoundaryAttacksV1,
  choosePhysicalFirstBoundaryAttacksV2} from
  '../../lib/engine/v2/physical-first-attack-choice-v1.mjs';

const segment={km:5,terrain:'flat',gradientPct:0,surface:'road',
  exposed:false,weather:{temperatureC:16,windKph:0,rainMm:0}};
const rider=id=>({id,flat:70,hills:60,mountain:50,
  endurance:65,form:50,fatigue:0});
const fixture=()=>({prior:{sourceKm:4,
  roads:[{roadId:'peloton',riderIds:['captain','helper'],
    clockSeconds:0}],
  riders:['captain','helper'].map(riderId=>({riderId,
    roadId:'peloton',distanceM:4000,clockSeconds:0,
    reserve:80}))},segment,
  teams:[{id:'team',riders:['captain','helper'].map(rider),
    orders:{helperIds:['helper'],
      baseline:{attack:'repeated',effort:'steady',
        helperAttackPolicy:'hold_for_captain'},phases:[]}}],
  stakes:[{teamId:'team',sportingGoal:'break_stage',
    sportingCaptainId:'captain'}]});

test('attack choice obeys helper guard and records the actual stake',()=>{
  const choice=choosePhysicalFirstBoundaryAttacksV1(fixture())[0];
  assert.equal(choice.choice,'attempt_paid_attack');
  assert.equal(choice.riderId,'captain');
  assert.equal(choice.teamOrderAttack,'repeated');
  assert.equal(choice.sportingGoal,'break_stage');
  assert.equal(choice.attackInitiationCost,2.4);
});

test('named manager attack overrides helper guard',()=>{
  const input=fixture();
  input.teams[0].orders.baseline.attackRiderId='helper';
  input.stakes[0].sportingGoal='sprint_finish';
  const choice=choosePhysicalFirstBoundaryAttacksV1(input)[0];
  assert.equal(choice.choice,'attempt_paid_attack');
  assert.equal(choice.riderId,'helper');
});

test('generated attack requires a sporting stake and payable rider',()=>{
  const input=fixture();
  input.stakes[0].sportingGoal='sprint_finish';
  assert.equal(choosePhysicalFirstBoundaryAttacksV1(input)[0].choice,
    'hold_no_sporting_stake');
  input.stakes[0].sportingGoal='break_stage';
  input.prior.riders[0].reserve=1;
  assert.equal(choosePhysicalFirstBoundaryAttacksV1(input)[0].choice,
    'hold_insufficient_reserve');
});

test('detached rider cannot be selected at a later boundary',()=>{
  const input=fixture();
  input.prior.roads[0].riderIds=['helper'];
  input.prior.riders[0].roadId='solo:captain';
  assert.equal(choosePhysicalFirstBoundaryAttacksV1(input)[0].choice,
    'hold_no_available_attacker');
});

test('committed specialist takes priority only while able to pay',()=>{
  const input=fixture();
  input.teams[0].orders.baseline.helperAttackPolicy='open';
  input.stakes[0].specialistRiderId='helper';
  assert.equal(choosePhysicalFirstBoundaryAttacksV1(input)[0]
    .riderId,'helper');
  input.prior.riders[1].reserve=1;
  const choice=choosePhysicalFirstBoundaryAttacksV1(input)[0];
  assert.equal(choice.riderId,'captain');
  assert.equal(choice.choice,'attempt_paid_attack');
});

test('repeated order records a hold outside its committed window',()=>{
  const input=fixture();
  input.prior.sourceKm=0;
  input.prior.riders.forEach(row=>{
    row.distanceM=0;
  });
  input.segment={...segment,km:1};
  const choice=choosePhysicalFirstBoundaryAttacksV1(
    input)[0];
  assert.equal(choice.choice,
    'hold_until_ordered_attack_window');
  assert.equal(choice.attackWindow,null);
});

test('committed break limit counts only physically forward teammates',()=>{
  const input=fixture();
  input.teams[0].riders.push(rider('worker'));
  input.prior.roads[0].riderIds=['worker'];
  input.prior.roads.push(
    {roadId:'solo:captain',riderIds:['captain'],
      clockSeconds:-2},
    {roadId:'solo:helper',riderIds:['helper'],
      clockSeconds:-1});
  input.prior.riders[0].roadId='solo:captain';
  input.prior.riders[0].clockSeconds=-2;
  input.prior.riders[1].roadId='solo:helper';
  input.prior.riders[1].clockSeconds=-1;
  input.prior.riders.push({riderId:'worker',
    roadId:'peloton',distanceM:4000,
    clockSeconds:0,reserve:80});
  const choice=choosePhysicalFirstBoundaryAttacksV1(
    input)[0];
  assert.equal(choice.forwardRiderCount,2);
  assert.equal(choice.choice,
    'hold_team_forward_limit');
});

test('unnamed bridge holds when it cannot reach a useful shared turn',()=>{
  const input=fixture();
  input.teams[0].orders.baseline.helperAttackPolicy='open';
  input.prior.roads[0].riderIds=['helper'];
  input.prior.roads.push({roadId:'solo:captain',
    riderIds:['captain'],clockSeconds:-13});
  input.prior.riders[0].roadId='solo:captain';
  input.prior.riders[0].clockSeconds=-13;
  input.kilometres=Array.from({length:40},
    (_,index)=>({...segment,km:index+1}));
  const choice=choosePhysicalFirstBoundaryAttacksV1(
    input)[0];
  assert.equal(choice.forwardRiderCount,1);
  assert.equal(choice.bridge.measuredGapSeconds,13);
  assert.equal(choice.choice,
    'hold_unhelpful_forward_bridge');
  input.teams[0].orders.baseline.attackRiderId='helper';
  assert.equal(choosePhysicalFirstBoundaryAttacksV1(
    input)[0].choice,'attempt_paid_attack');
});

test('position choice counts a forward teammate from recorded metres',()=>{
  const input=fixture();
  input.teams[0].orders.baseline.helperAttackPolicy='open';
  input.prior.frontDistanceM=4000;
  input.prior.roads[0].riderIds=['helper'];
  input.prior.riders[0].roadId='solo:captain';
  input.prior.riders[0].distanceM=4103.8796;
  input.kilometres=Array.from({length:40},
    (_,index)=>({...segment,km:index+1}));
  const historic=choosePhysicalFirstBoundaryAttacksV1(input)[0];
  const positional=choosePhysicalFirstBoundaryAttacksV2(input)[0];
  assert.equal(historic.forwardRiderCount,0);
  assert.equal(positional.forwardRiderCount,1);
  assert.ok(Math.abs(positional.bridge.measuredGapM-
    103.8796)<1e-6);
  assert.equal(positional.bridge.measuredGapSeconds,
    undefined);
  assert.equal(positional.bridge.projectedContactKm,null);
  assert.equal(positional.choice,
    'hold_unhelpful_forward_bridge');
});

test('position bridge tests closing speed against measured road gap',()=>{
  const input=fixture();
  input.teams[0].orders.baseline.helperAttackPolicy='open';
  Object.assign(input.teams[0].riders[1],{
    flat:100,timetrial:100});
  input.prior.frontDistanceM=4000;
  input.prior.roads[0].riderIds=['helper'];
  input.prior.riders[0].roadId='solo:captain';
  input.prior.riders[0].distanceM=4100;
  input.kilometres=Array.from({length:40},
    (_,index)=>({...segment,km:index+1}));
  const choice=choosePhysicalFirstBoundaryAttacksV2(input)[0];
  assert.equal(choice.forwardRiderCount,1);
  assert.equal(choice.bridge.measuredGapM,100);
  assert.ok(choice.bridge.closingSpeedMps>0);
  assert.ok(choice.bridge.projectedContactKm>0);
  assert.equal(choice.choice,'attempt_paid_attack');
  input.kilometres=input.kilometres.slice(0,8);
  assert.equal(choosePhysicalFirstBoundaryAttacksV2(input)[0]
    .choice,'hold_unhelpful_forward_bridge');
});

test('position choice refuses an unmeasured front distance',()=>{
  const input=fixture();
  assert.throws(()=>
    choosePhysicalFirstBoundaryAttacksV2(input),
  /measured bunch/);
  input.prior.frontDistanceM=3999;
  assert.throws(()=>
    choosePhysicalFirstBoundaryAttacksV2(input),
  /measured bunch/);
});
