import test from 'node:test';
import assert from 'node:assert/strict';
import {choosePhysicalFirstBoundaryAttacksV1} from
  '../../lib/engine/v2/physical-first-attack-choice-v1.mjs';
import {advancePhysicalFirstAttackRoadV1} from
  '../../lib/engine/v2/physical-first-attack-road-v1.mjs';

const fixture=()=>{
  const segment={km:1,terrain:'flat',gradientPct:0,
    surface:'road',exposed:false,
    weather:{temperatureC:16,windKph:0,rainMm:0}};
  const rider={id:'attacker',flat:78,hills:70,
    mountain:60,endurance:70,form:50,fatigue:0};
  const input={prior:{sourceKm:0,
    roads:[{roadId:'peloton',riderIds:[rider.id],
      clockSeconds:0}],
    riders:[{riderId:rider.id,roadId:'peloton',
      distanceM:0,clockSeconds:0,reserve:80,
      quietKm:0}]},segment,kilometres:[segment],
  teams:[{id:'team',riders:[rider],orders:{
    helperIds:[],baseline:{attack:'repeated',
      effort:'steady',attackRiderId:rider.id},
    phases:[]}}],
  stakes:[{teamId:'team',sportingGoal:'break_stage',
    sportingCaptainId:rider.id}]};
  const choice=choosePhysicalFirstBoundaryAttacksV1(input)[0];
  return {...input,choice};
};

test('boundary attack pays a solo kilometre from zero gap',()=>{
  const input=fixture();
  const step=advancePhysicalFirstAttackRoadV1(input);
  assert.equal(step.launchEvent.atDistanceM,0);
  assert.equal(step.launchEvent.atClockSeconds,0);
  assert.equal(step.road.startClockSeconds,0);
  assert.equal(step.road.startDistanceM,0);
  assert.equal(step.road.endDistanceM,1000);
  assert.ok(step.road.finishClockSeconds>0);
  assert.equal(step.road.riderIds[0],'attacker');
  assert.equal(step.road.riderDecisions[0]
    .attackInitiationCost,2.4);
  assert.ok(step.finishes[0].energyAfter<80);
  assert.equal(step.finishes[0].paidFromReserve,
    step.road.riderDecisions[0].roadWorkCost+2.4);
});

test('attack road rejects a forged choice or missing contact',()=>{
  const input=fixture();
  assert.throws(()=>advancePhysicalFirstAttackRoadV1({
    ...input,choice:{...input.choice,
      perceivedAbilityAtChoice:999}}),
  /choice differs from committed order/);
  input.prior.riders[0].roadId='solo:attacker';
  assert.throws(()=>advancePhysicalFirstAttackRoadV1(input),
    /ordered measured launch|bunch contact/);
});
