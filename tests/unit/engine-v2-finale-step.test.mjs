import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleGap,energyCostForFinaleSlice} from
  '../../lib/engine/v2/finale-step.mjs';

const route=buildKilometreRoute({distance_km:40,
  profile_points:[[0,100],[40,100]]},{seed:'finale-step'});
const slices=finaleDistanceGrid(route);

test('the same road gap closes within a 250 m chase step or grows under a faster break',()=>{
  const slice=slices[4];
  const caught=advanceFinaleGap({slice,gapSeconds:1,
    frontSpeedKph:40,chaseSpeedKph:50});
  assert.equal(caught.caught,true);
  assert.equal(caught.gapSeconds,0);
  assert.ok(caught.catchDistanceM>slice.startDistanceM);
  assert.ok(caught.catchDistanceM<slice.endDistanceM);
  const escaped=advanceFinaleGap({slice,gapSeconds:1,
    frontSpeedKph:50,chaseSpeedKph:40});
  assert.equal(escaped.caught,false);
  assert.equal(escaped.catchDistanceM,null);
  assert.ok(escaped.gapSeconds>1);
});

test('a small lead survives equal speeds without a fabricated catch',()=>{
  const state=advanceFinaleGap({slice:slices.at(-1),gapSeconds:.01,
    frontSpeedKph:45,chaseSpeedKph:45});
  assert.equal(state.caught,false);
  assert.ok(Math.abs(state.gapSeconds-.01)<1e-9);
  assert.equal(state.catchDistanceM,null);
});

test('work cost is proportional to actual distance across the whole finale',()=>{
  const costPerKm=.35;
  const total=slices.reduce((sum,slice)=>
    sum+energyCostForFinaleSlice(slice,costPerKm),0);
  assert.ok(Math.abs(total-5*costPerKm)<1e-10);
  assert.ok(Math.abs(energyCostForFinaleSlice(slices.at(-1),costPerKm)-.035)<1e-10);
  assert.throws(()=>energyCostForFinaleSlice(slices[0],-.1),/non-negative/);
  assert.throws(()=>advanceFinaleGap({slice:slices[0],gapSeconds:1,
    frontSpeedKph:0,chaseSpeedKph:40}),/positive gap and speeds/);
});
