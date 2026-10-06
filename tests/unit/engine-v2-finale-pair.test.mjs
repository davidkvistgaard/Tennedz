import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {simulateFinalePair,validateFinalePair} from
  '../../lib/engine/v2/finale-pair.mjs';

const route=buildKilometreRoute({distance_km:40,
  profile_points:[[0,100],[40,100]]},{seed:'pair'});
const steps=finaleDistanceGrid(route);
const worker=(riderId,speedKph,workCostPerKm=1)=>({riderId,energy:20,
  steps:steps.map(()=>({speedKph,workCostPerKm}))});

test('a faster chaser catches within a slice and both workers pay only for the ridden part',()=>{
  const input={route,initialGapSeconds:5,
    front:worker('front',40),rear:worker('rear',50)};
  const recording=simulateFinalePair(input);
  assert.equal(recording.outcome,'caught');
  assert.equal(recording.frames.length,1);
  const frame=recording.frames[0];
  assert.equal(frame.event,'catch');
  assert.ok(frame.endDistanceM>frame.startDistanceM);
  assert.ok(frame.endDistanceM<steps[0].endDistanceM);
  assert.equal(frame.gapSeconds,0);
  assert.ok(Math.abs(frame.frontEnergySpent-
    (frame.endDistanceM-frame.startDistanceM)/1000)<1e-9);
  assert.equal(validateFinalePair(input,recording),true);
  const invented=structuredClone(recording);
  invented.frames[0].endDistanceM+=10;
  assert.throws(()=>validateFinalePair(input,invented),/differs/);
  const freeWork=structuredClone(recording);
  freeWork.frames[0].rearEnergy=20;
  assert.throws(()=>validateFinalePair(input,freeWork),/differs/);
});

test('a stronger break survives all eleven slices with a continuous finite trace',()=>{
  const input={route,initialGapSeconds:2,
    front:worker('front',46,1.5),rear:worker('rear',44,1)};
  const recording=simulateFinalePair(input);
  assert.equal(recording.outcome,'survived');
  assert.equal(recording.frames.length,11);
  assert.equal(recording.frames.at(-1).remainingM,0);
  assert.ok(recording.finishGapSeconds>input.initialGapSeconds);
  assert.ok(recording.frames.every((frame,index)=>index===0||
    frame.startDistanceM===recording.frames[index-1].endDistanceM));
  assert.ok(Math.abs(recording.frames.at(-1).frontEnergy-12.5)<1e-9);
  assert.equal(validateFinalePair(input,recording),true);
});

test('a plan cannot continue at its chosen pace after spending unavailable energy',()=>{
  const input={route,initialGapSeconds:10,
    front:{...worker('front',46,5),energy:1},rear:worker('rear',44)};
  assert.throws(()=>simulateFinalePair(input),/cannot spend energy/);
  assert.throws(()=>simulateFinalePair({...input,front:worker('front',0)}),
    /complete finite plans/);
});
