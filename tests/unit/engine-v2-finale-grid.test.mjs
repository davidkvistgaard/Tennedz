import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';

test('the finale grid covers exactly five kilometres and names its coarse route source',()=>{
  const route=buildKilometreRoute({distance_km:40,
    profile_points:[[0,100],[35,100],[40,300]]},{seed:'finale-grid'});
  const slices=finaleDistanceGrid(route);
  assert.equal(slices.length,11);
  assert.equal(slices[0].startDistanceM,35000);
  assert.equal(slices.at(-1).endDistanceM,40000);
  assert.equal(slices.at(-1).remainingM,0);
  assert.equal(slices.reduce((sum,slice)=>sum+slice.lengthM,0),5000);
  for(const [index,slice] of slices.entries()){
    if(index)assert.equal(slice.startDistanceM,slices[index-1].endDistanceM);
    assert.equal(slice.remainingM,40000-slice.endDistanceM);
    assert.equal(slice.sourceKm,Math.floor(slice.startDistanceM/1000)+1);
    assert.equal(slice.profileResolutionM,1000);
    assert.ok(route.kilometres[slice.sourceKm-1]);
  }
  assert.deepEqual(slices.map(slice=>slice.phase),[
    ...Array(4).fill('finale'),...Array(2).fill('approach'),
    ...Array(5).fill('finish')]);
  assert.deepEqual(slices.slice(-7).map(slice=>slice.sourceKm),Array(7).fill(40));
});

test('the grid rejects incomplete or unversioned route input',()=>{
  const route=buildKilometreRoute({distance_km:20,
    profile_points:[[0,100],[20,100]]},{seed:'finale-grid'});
  assert.equal(finaleDistanceGrid(route)[0].startDistanceM,15000);
  assert.throws(()=>finaleDistanceGrid({...route,version:1}),/complete v2/);
  assert.throws(()=>finaleDistanceGrid({...route,kilometres:route.kilometres.slice(1)}),
    /complete v2/);
});
