import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed} from '@pelotonia/race-viewer/data';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {illustrativeGroupLayoutFeedV1,
  illustrativeGroupLayoutFrameV1,
  ILLUSTRATIVE_GROUP_LAYOUT_VERSION} from
  '../../lib/viewer/illustrative-group-layout-v1.mjs';

test('renderer spacing is deterministic and leaves recorded data intact',()=>{
  assert.equal(ILLUSTRATIVE_GROUP_LAYOUT_VERSION,
    'illustrative-group-layout-1');
  for(const category of ['men','women']){
    const {feed}=createPhysicalFirstSplitViewerTestRaceV1(category);
    const source=structuredClone(feed);
    const visual=illustrativeGroupLayoutFeedV1(feed);
    assert.deepEqual(feed,source);
    assert.deepEqual(validateFeed(visual),visual);
    assert.deepEqual(visual.events,feed.events);
    assert.deepEqual(visual.results,feed.results);
    assert.deepEqual(visual.orders,feed.orders);
    assert.deepEqual(visual.actions,feed.actions);
    assert.deepEqual(visual.route,feed.route);
    assert.deepEqual(illustrativeGroupLayoutFeedV1(feed),visual);
    for(const index of [0,Math.floor(feed.frames.length/2),
      feed.frames.length-1]){
      const original=feed.frames[index];
      const frame=visual.frames[index];
      assert.equal(frame.time,original.time);
      assert.deepEqual(frame.groupRoles,original.groupRoles);
      assert.equal(frame.positions.length,feed.riders.length);
      assert.deepEqual(frame.positions.map(row=>[row.riderId,row.groupId]),
        original.positions.map(row=>[row.riderId,row.groupId]));
      assert.equal(new Set(frame.positions.map(row=>
        `${row.distance}:${row.lateral}`)).size,feed.riders.length);
      assert.ok(frame.positions.every(row=>row.distance>=0&&
        row.distance<=feed.route.profile.samples.at(-1)[0]));
      if(index>0)assert.ok(frame.positions.every((row,position)=>(
        row.distance<=original.positions[position].distance)));
    }
  }
});

for(const count of [30,150,160])
  test(`renderer spacing shows ${count} recorded riders without cloning`,()=>{
    const positions=Array.from({length:count},(_,index)=>({
      riderId:`r${index}`,groupId:'peloton',distance:50_000,
      lateral:0}));
    const frame={time:10,positions,groupRoles:{peloton:'peloton'}};
    const visual=illustrativeGroupLayoutFrameV1(frame,120_000);
    assert.deepEqual(frame.positions,positions);
    assert.equal(visual.positions.length,count);
    assert.equal(new Set(visual.positions.map(row=>
      `${row.distance}:${row.lateral}`)).size,count);
    assert.ok(visual.positions.every(row=>row.groupId==='peloton'&&
      row.distance<=50_000&&row.distance>=49_950&&
      Math.abs(row.lateral)<3));
  });

test('solo positions and unreached streaming sentinel stay unchanged',()=>{
  const solo={riderId:'solo',groupId:'solo:1',distance:200,lateral:0};
  const pack=[1,2].map(number=>({riderId:`p${number}`,
    groupId:'peloton',distance:180,lateral:0}));
  const frame={time:3,positions:[solo,...pack]};
  const visual=illustrativeGroupLayoutFrameV1(frame,1000);
  assert.equal(visual.positions[0],solo);
  assert.equal(visual.positions.length,3);
  assert.equal(illustrativeGroupLayoutFrameV1(
    {time:10,positions:[]},1000).positions.length,0);
  const short={positions:Array.from({length:20},(_,index)=>({
    riderId:`short-${index}`,groupId:'peloton',distance:5,
    lateral:0}))};
  assert.ok(illustrativeGroupLayoutFrameV1(short,10).positions.every(
    row=>row.distance>=0&&row.distance<=10));
  assert.throws(()=>illustrativeGroupLayoutFrameV1(
    {positions:[{...solo,distance:NaN}]},1000),/anchor/);
});
