import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearSoloContactV1,validateRearSoloContactV1} from
  '../../lib/engine/v2/rear-solo-contact-v1.mjs';

const slice={startDistanceM:5000,endDistanceM:6000,lengthM:1000};
const front={riderId:'a',behindBunchSeconds:30,speedKph:30,
  energy:10,workCostPerKm:2};
const rear={riderId:'b',behindBunchSeconds:40,speedKph:36,
  energy:10,workCostPerKm:3};

test('two paid solo roads form a contact at the computed half-kilometre',()=>{
  const input={slice,bunchSpeedKph:36,front,rear};
  const result=advanceRearSoloContactV1(input);
  assert.equal(result.endDistanceM,5500);
  assert.deepEqual(result.event,{kind:'rear_contact',atDistanceM:5500,
    riderIds:['a','b']});
  assert.equal(result.riders[0].behindBunchSeconds,40);
  assert.equal(result.riders[1].behindBunchSeconds,40);
  assert.deepEqual(result.riders.map(row=>row.energySpent),[1,1.5]);
  assert.equal(validateRearSoloContactV1(input,result),true);
  const forged=structuredClone(result);
  forged.event.atDistanceM=5400;
  assert.throws(()=>validateRearSoloContactV1(input,forged),/differs/);
});

test('separate solo roads remain separate without a paid catch',()=>{
  const result=advanceRearSoloContactV1({slice,bunchSpeedKph:36,front,
    rear:{...rear,speedKph:32}});
  assert.equal(result.endDistanceM,6000);
  assert.equal(result.event,null);
  assert.ok(result.riders[1].behindBunchSeconds>
    result.riders[0].behindBunchSeconds);
});

test('a bunch catch or insufficient energy refuses rear-group contact',()=>{
  assert.throws(()=>advanceRearSoloContactV1({slice,bunchSpeedKph:36,
    front:{...front,behindBunchSeconds:5,speedKph:50},rear}),
  /reaches the bunch/);
  assert.throws(()=>advanceRearSoloContactV1({slice,bunchSpeedKph:36,
    front:{...front,energy:.5},rear}),/cannot pay/);
});
