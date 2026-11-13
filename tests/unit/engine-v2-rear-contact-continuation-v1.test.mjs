import test from 'node:test';
import assert from 'node:assert/strict';
import {continueRearContactV1,validateRearContactContinuationV1} from
  '../../lib/engine/v2/rear-contact-continuation-v1.mjs';

const soloInput={slice:{startDistanceM:5000,endDistanceM:6000,lengthM:1000},
  bunchSpeedKph:36,
  front:{riderId:'a',behindBunchSeconds:30,speedKph:30,
    energy:10,workCostPerKm:2},
  rear:{riderId:'b',behindBunchSeconds:40,speedKph:36,
    energy:10,workCostPerKm:3}};

test('a paid meeting forms a rear group with one exposed leader',()=>{
  const input={soloInput,groupId:'rear-1',leaderRiderId:'a',
    groupSpeedKph:36,leadCostPerKm:2,shelteredCostPerKm:.5};
  const result=continueRearContactV1(input);
  assert.equal(result.contact.event.atDistanceM,5500);
  assert.equal(result.endDistanceM,6000);
  assert.equal(result.behindBunchSeconds,40);
  assert.deepEqual(result.rearGroup.riderIds,['a','b']);
  assert.equal(result.rearGroup.turnCount,1);
  assert.deepEqual(result.riders.map(row=>[row.role,row.energySpent]),
    [['leader',1],['sheltered',.25]]);
  assert.equal(validateRearContactContinuationV1(input,result),true);
  const forged=structuredClone(result);
  forged.riders[1].energySpent=0;
  assert.throws(()=>validateRearContactContinuationV1(input,forged),/differs/);
});

test('a fast shared group stops exactly when it rejoins the bunch',()=>{
  const result=continueRearContactV1({soloInput:{...soloInput,
    front:{...soloInput.front,behindBunchSeconds:3},
    rear:{...soloInput.rear,behindBunchSeconds:13}},
  groupId:'rear-2',leaderRiderId:'b',groupSpeedKph:50,
  leadCostPerKm:2,shelteredCostPerKm:.5});
  assert.equal(result.event.kind,'rejoin_bunch');
  assert.equal(result.behindBunchSeconds,0);
  assert.equal(result.rearGroup,null);
  assert.ok(result.endDistanceM<6000);
});

test('unpaid and unobserved group joins refuse',()=>{
  assert.throws(()=>continueRearContactV1({soloInput:{...soloInput,
    rear:{...soloInput.rear,speedKph:32}},groupId:'rear-1',
  leaderRiderId:'a',groupSpeedKph:36,leadCostPerKm:2,
  shelteredCostPerKm:.5}),/paid contact/);
  assert.throws(()=>continueRearContactV1({soloInput,groupId:'rear-1',
    leaderRiderId:'a',groupSpeedKph:36,leadCostPerKm:20,
    shelteredCostPerKm:.5}),/cannot pay/);
});
