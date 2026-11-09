import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed,createSampler,commentaryAt} from
  '@pelotonia/race-viewer/data';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {previewBroadcastClockV1} from
  '../../lib/viewer/preview-clock-v1.mjs';

for(const category of ['men','women'])
  test(`selective paid race ${category} reaches viewer finish`,()=>{
    const {feed,coverage,version}=
      createPhysicalFirstSplitViewerTestRaceV1(category);
    assert.deepEqual(validateFeed(feed),feed);
    assert.match(version,/split-to-pelotonia.viewer.v1/);
    assert.equal(feed.riderCategory,category);
    assert.equal(feed.riders.length,120);
    assert.equal(coverage.paidRiderKilometres,14400);
    assert.equal(coverage.recordedContactEvents,0);
    assert.equal(coverage.sameSeedFinishMismatches,0);
    assert.equal(coverage.officialResults,false);
    assert.equal(feed.results,undefined);
    assert.equal(feed.frames[0].time,0);
    assert.equal(feed.frames.at(-1).time,feed.duration);
    const sampler=createSampler(feed);
    for(const time of [0,feed.frames[1].time,
      feed.frames[Math.floor(feed.frames.length/2)].time,
      feed.duration]){
      const state=sampler(time);
      assert.equal(state.positions.length,120);
      assert.ok(state.positions.every(row=>
        row.distance>=0&&row.distance<=120000&&
        row.lateral===0));
      assert.equal(state.results,null);
      assert.ok(state.events.every(row=>row.time<=time));
      assert.ok(commentaryAt(feed,time).every(row=>
        row.time<=time));
    }
    assert.ok(feed.frames[0].positions.every(row=>
      row.groupId==='peloton'));
    assert.ok(feed.frames.at(-1).positions.every(row=>
      row.groupId==='peloton'));
    assert.equal(feed.events.some(row=>
      row.label.includes('recorded paid contact')),false);
    assert.ok(feed.frames.at(-1).positions.every(row=>
      row.distance===120000));
    assert.equal(commentaryAt(feed,0).some(row=>
      row.text.includes('finish')),false);
    const anchor=previewBroadcastClockV1(feed.duration,
      4*3_600_000+1);
    assert.equal(anchor.clock.serverEpochMs,4*3_600_000);
    assert.ok(anchor.clock.serverEpochMs+
      feed.duration*1000<8*3_600_000);
  });

for(const category of ['men','women'])
  test(`full chase ${category} preserves paid split/contact evidence`,()=>{
    const {feed,coverage}=createPhysicalFirstSplitViewerTestRaceV1(
      category,{chase:'all'});
    assert.deepEqual(validateFeed(feed),feed);
    assert.equal(coverage.paidRiderKilometres,14400);
    assert.equal(coverage.recordedContactEvents,5);
    assert.equal(coverage.sameSeedFinishMismatches,50);
    assert.ok(feed.frames[0].positions.some(row=>
      row.groupId.startsWith('solo:')));
    assert.ok(feed.frames.at(-1).positions.some(row=>
      row.groupId.startsWith('rear:')));
    assert.ok(feed.events.some(row=>
      row.label.includes('recorded paid contact')));
    assert.ok(createSampler(feed)(feed.duration).positions.every(row=>
      row.distance===120000));
    assert.equal(feed.results,undefined);
  });
