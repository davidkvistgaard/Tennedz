import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceFinaleGroupStep,validateFinaleGroupStep,
  FINALE_GROUP_STEP_VERSION} from
  '../../lib/engine/v2/finale-group-step.mjs';

const slice={startDistanceM:39000,endDistanceM:39250,lengthM:250};
const group={id:'road-1',gapSeconds:1,riderIds:['a-0','b-0']};
const riderPlans=[
  {riderId:'a-0',energy:4,workCostPerKm:2},
  {riderId:'b-0',energy:3,workCostPerKm:.4},
  {riderId:'c-0',energy:5,workCostPerKm:2.4},
  {riderId:'d-0',energy:2,workCostPerKm:.3},
];
const input={slice,frontGroup:group,pelotonRiderIds:['c-0','d-0'],
  frontPull:{riderId:'a-0',speedKph:40},
  chasePull:{riderId:'c-0',speedKph:50},riderPlans};

test('a short-step catch stops and charges every road rider at the catch point',()=>{
  const original=structuredClone(input);
  const result=advanceFinaleGroupStep(input);
  assert.equal(result.version,FINALE_GROUP_STEP_VERSION);
  assert.equal(result.event.kind,'catch');
  assert.ok(result.endDistanceM>slice.startDistanceM);
  assert.ok(result.endDistanceM<slice.endDistanceM);
  assert.deepEqual(result.roadGroups,[]);
  assert.deepEqual(result.pelotonRiderIds,['c-0','d-0','a-0','b-0']);
  const fraction=(result.endDistanceM-slice.startDistanceM)/slice.lengthM;
  for(const plan of riderPlans){
    const state=result.riders.find(rider=>rider.riderId===plan.riderId);
    assert.ok(Math.abs(state.energySpent-plan.workCostPerKm*.25*fraction)<1e-10);
    assert.ok(Math.abs(state.energy-(plan.energy-state.energySpent))<1e-10);
  }
  assert.equal(result.riders.find(rider=>rider.riderId==='a-0').role,'pull');
  assert.equal(result.riders.find(rider=>rider.riderId==='b-0').role,'sheltered');
  assert.equal(validateFinaleGroupStep(input,result),true);
  const altered=structuredClone(result);
  altered.riders[1].energy+=.1;
  assert.throws(()=>validateFinaleGroupStep(input,altered),/differs/);
  assert.deepEqual(input,original);
});

test('a faster leading group preserves the earned gap and distinct memberships',()=>{
  const result=advanceFinaleGroupStep({...input,
    frontPull:{riderId:'a-0',speedKph:50},
    chasePull:{riderId:'c-0',speedKph:40}});
  assert.equal(result.event,null);
  assert.equal(result.endDistanceM,slice.endDistanceM);
  assert.ok(result.roadGroups[0].gapSeconds>group.gapSeconds);
  assert.deepEqual(result.roadGroups[0].riderIds,['a-0','b-0']);
  assert.deepEqual(result.pelotonRiderIds,['c-0','d-0']);
  assert.equal(result.riders.find(rider=>rider.riderId==='a-0').energySpent,.5);
});

test('a group step rejects unearned work, absent riders and invented pullers',()=>{
  assert.throws(()=>advanceFinaleGroupStep({...input,
    riderPlans:riderPlans.map(plan=>plan.riderId==='a-0'?{...plan,energy:0}:plan)}),
  /cannot spend energy/);
  assert.throws(()=>advanceFinaleGroupStep({...input,
    riderPlans:riderPlans.slice(1)}),/complete distinct riders/);
  assert.throws(()=>advanceFinaleGroupStep({...input,
    frontPull:{riderId:'d-0',speedKph:40}}),/complete distinct riders/);
});
