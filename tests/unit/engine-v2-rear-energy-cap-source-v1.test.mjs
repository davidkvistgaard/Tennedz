import test from 'node:test';
import assert from 'node:assert/strict';
import {replayRearEnergyCapV1,validateRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';

const route=Array.from({length:162},(_,index)=>({km:index+1,
  gradientPct:index===160?6:0,surface:'road'}));
const rider={id:'rear-a',endurance:70,fatigue:0};

test('source cap decays on the actual late climbing kilometre',()=>{
  const before=replayRearEnergyCapV1({rider,kilometres:route,
    throughKm:160});
  const climb=replayRearEnergyCapV1({rider,kilometres:route,
    throughKm:161});
  const tired=replayRearEnergyCapV1({rider:{...rider,fatigue:30},
    kilometres:route,throughKm:161});
  assert.equal(before.cap,100);
  assert.equal(climb.cap,99.728);
  assert.equal(tired.initialCap,88);
  assert.equal(tired.cap,87.728);
  assert.equal(climb.decay[0].terrainLoad,1.21);
  assert.equal(validateRearEnergyCapV1({rider,kilometres:route,
    throughKm:161},climb),true);
  const forged=structuredClone(climb);
  forged.cap=100;
  assert.throws(()=>validateRearEnergyCapV1({rider,kilometres:route,
    throughKm:161},forged),/differs/);
});

test('a missing route kilometre cannot seed an invented rear cap',()=>{
  const broken=route.map(row=>({...row}));
  broken[100].km=102;
  assert.throws(()=>replayRearEnergyCapV1({rider,kilometres:broken,
    throughKm:161}),/missing kilometre/);
});
