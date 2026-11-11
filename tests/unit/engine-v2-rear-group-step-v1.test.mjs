import test from 'node:test';
import assert from 'node:assert/strict';
import {continueRearContactV1} from
  '../../lib/engine/v2/rear-contact-continuation-v1.mjs';
import {advanceRearGroupStepV1,validateRearGroupStepV1} from
  '../../lib/engine/v2/rear-group-step-v1.mjs';

const soloInput={slice:{startDistanceM:5000,endDistanceM:6000,lengthM:1000},
  bunchSpeedKph:36,
  front:{riderId:'a',behindBunchSeconds:30,speedKph:30,
    energy:10,workCostPerKm:2},
  rear:{riderId:'b',behindBunchSeconds:40,speedKph:36,
    energy:10,workCostPerKm:3}};
const contact=continueRearContactV1({soloInput,groupId:'rear-1',
  leaderRiderId:'a',groupSpeedKph:36,leadCostPerKm:2,
  shelteredCostPerKm:.5});
const plans=[{riderId:'a',choice:'pull',reason:'finish_together',
  speedKph:36,leadCostPerKm:2,shelteredCostPerKm:.5},
{riderId:'b',choice:'pull',reason:'finish_together',
  speedKph:36,leadCostPerKm:2,shelteredCostPerKm:.5}];
const slice={startDistanceM:6000,endDistanceM:7000,lengthM:1000};

test('successive rear steps rotate one leader and pay sheltered riders less',()=>{
  const first=advanceRearGroupStepV1({slice,group:contact.rearGroup,
    bunchSpeedKph:36,riderPlans:plans});
  assert.equal(first.leaderRiderId,'b');
  assert.deepEqual(first.riders.map(row=>[row.role,row.energySpent]),
    [['sheltered',.5],['leader',2]]);
  assert.equal(first.rearGroup.behindBunchSeconds,40);
  const next=advanceRearGroupStepV1({slice:{startDistanceM:7000,
    endDistanceM:8000,lengthM:1000},group:first.rearGroup,
  bunchSpeedKph:36,riderPlans:plans});
  assert.equal(next.leaderRiderId,'a');
  assert.equal(validateRearGroupStepV1({slice,group:contact.rearGroup,
    bunchSpeedKph:36,riderPlans:plans},first),true);
  const forged=structuredClone(first);
  forged.riders[0].energySpent=0;
  assert.throws(()=>validateRearGroupStepV1({slice,group:contact.rearGroup,
    bunchSpeedKph:36,riderPlans:plans},forged),/differs/);
});

test('sitters cannot become leaders and a leaderless group is refused',()=>{
  const oneWilling=plans.map((plan,index)=>index?{...plan,
    choice:'sit_in',reason:'save_energy'}:plan);
  const result=advanceRearGroupStepV1({slice,group:contact.rearGroup,
    bunchSpeedKph:36,riderPlans:oneWilling});
  assert.equal(result.leaderRiderId,'a');
  assert.throws(()=>advanceRearGroupStepV1({slice,group:contact.rearGroup,
    bunchSpeedKph:36,riderPlans:plans.map(plan=>({...plan,choice:'sit_in'}))}),
  /no willing leader/);
});

test('unpayable work and a faster group rejoining the bunch are bounded',()=>{
  assert.throws(()=>advanceRearGroupStepV1({slice,group:contact.rearGroup,
    bunchSpeedKph:36,riderPlans:plans.map(plan=>({...plan,
      leadCostPerKm:30}))}),/cannot pay/);
  const near={...contact.rearGroup,behindBunchSeconds:5};
  const fast=plans.map(plan=>({...plan,speedKph:50}));
  const result=advanceRearGroupStepV1({slice,group:near,
    bunchSpeedKph:36,riderPlans:fast});
  assert.equal(result.event.kind,'rejoin_bunch');
  assert.equal(result.rearGroup,null);
  assert.ok(result.endDistanceM<7000);
});
