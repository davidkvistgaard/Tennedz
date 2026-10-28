import test from 'node:test';
import assert from 'node:assert/strict';
import {runRearGroupV1,validateRearGroupRunV1} from
  '../../lib/engine/v2/rear-group-run-v1.mjs';

const input={soloInput:{slice:{startDistanceM:5000,endDistanceM:6000,
  lengthM:1000},bunchSpeedKph:36,
front:{riderId:'a',behindBunchSeconds:30,speedKph:30,
  energy:10,workCostPerKm:2},
rear:{riderId:'b',behindBunchSeconds:40,speedKph:36,
  energy:10,workCostPerKm:3}},
groupId:'rear-1',initialTurn:{leaderRiderId:'a',groupSpeedKph:36,
  leadCostPerKm:2,shelteredCostPerKm:.5},
followingSteps:[
  {slice:{startDistanceM:6000,endDistanceM:7000,lengthM:1000},
    bunchSpeedKph:36,riderPlans:[
      {riderId:'a',choice:'pull',reason:'finish_together',speedKph:36,
        leadCostPerKm:2,shelteredCostPerKm:.5},
      {riderId:'b',choice:'pull',reason:'finish_together',speedKph:36,
        leadCostPerKm:2,shelteredCostPerKm:.5}]},
  {slice:{startDistanceM:7000,endDistanceM:8000,lengthM:1000},
    bunchSpeedKph:36,riderPlans:[
      {riderId:'a',choice:'pull',reason:'finish_together',speedKph:36,
        leadCostPerKm:2,shelteredCostPerKm:.5},
      {riderId:'b',choice:'sit_in',reason:'save_energy',speedKph:36,
        leadCostPerKm:2,shelteredCostPerKm:.5}]},
]};

test('a rear group carries exact contact, changing turns and paid energy',()=>{
  const recording=runRearGroupV1(input);
  assert.equal(recording.initial.contact.event.atDistanceM,5500);
  assert.deepEqual(recording.steps.map(step=>step.leaderRiderId),['b','a']);
  assert.equal(recording.finalGroup.atDistanceM,8000);
  assert.equal(recording.finalGroup.behindBunchSeconds,40);
  assert.equal(recording.joinedBunchAtDistanceM,null);
  assert.equal(validateRearGroupRunV1(input,recording),true);
  const forged=structuredClone(recording);
  forged.steps[1].riders[1].energySpent=0;
  assert.throws(()=>validateRearGroupRunV1(input,forged),/differs/);
});

test('a later step cannot start from an unrecorded contact or leap ahead',()=>{
  assert.throws(()=>runRearGroupV1({...input,soloInput:{...input.soloInput,
    rear:{...input.soloInput.rear,speedKph:32}}}),/paid contact/);
  assert.throws(()=>runRearGroupV1({...input,followingSteps:[{
    ...input.followingSteps[0],slice:{startDistanceM:6500,
      endDistanceM:7500,lengthM:1000}}]}),/complete rider decisions/);
});
