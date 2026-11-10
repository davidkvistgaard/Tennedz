import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateFeed,createSampler,commentaryAt,broadcastTime} from
  '@pelotonia/race-viewer/data';
import {scenicPresentationV1} from
  '../../lib/viewer/scenic-presentation-v1.mjs';
import {previewBroadcastClockV2,
  VIEWER_PREVIEW_FINISH_HOLD_MS} from
  '../../lib/viewer/preview-clock-v2.mjs';

for(const category of ['men','women'])
  test(`experimental split recording ${category} plays to finish`,()=>{
    const source=JSON.parse(readFileSync(new URL(
      `../../data/viewer/physical-120km-${category}-v1.json`,
      import.meta.url)));
    const {feed,coverage,sourceCommit,version}=source;
    assert.equal(sourceCommit,
      '5352f9eb0a2f618976083b933189839bcacbe673');
    assert.equal(version,
      'physical-first-split-to-pelotonia.viewer.v1-1');
    assert.equal(coverage.paidRiderKilometres,14400);
    assert.equal(coverage.recordedContactEvents,5);
    assert.equal(coverage.sameSeedFinishMismatches,50);
    assert.equal(feed.riderCategory,category);
    assert.equal(feed.riders.length,120);
    assert.equal(feed.results,undefined);
    assert.ok(feed.frames.every(frame=>frame.gaps===undefined));
    assert.deepEqual(validateFeed(feed),feed);
    const scenic=scenicPresentationV1(feed);
    assert.deepEqual(validateFeed(scenic),scenic);
    assert.equal(scenic.route.profile.samples.at(-1)[0],120000);
    assert.equal(scenic.terrain.step[1],80);
    assert.equal(scenic.terrain.rows,1503);
    assert.ok(scenic.landmarks.every(row=>
      row.position[2]>=0&&row.position[2]<120000));
    const sample=createSampler(scenic);
    for(const time of [0,feed.frames[10].time,
      feed.frames[80].time,feed.duration]){
      const state=sample(time);
      assert.equal(state.positions.length,120);
      assert.equal(state.results,null);
      assert.ok(commentaryAt(scenic,time).every(row=>
        row.time<=time));
    }
    assert.ok(sample(0).positions.some(row=>
      row.groupId.startsWith('solo:')));
    assert.ok(sample(feed.duration).positions.every(row=>
      row.distance===120000));
    const atFinish=Math.round(feed.duration*1000);
    const {clock}=previewBroadcastClockV2(feed.duration,atFinish+
      VIEWER_PREVIEW_FINISH_HOLD_MS-1);
    assert.equal(broadcastTime(clock,atFinish+
      VIEWER_PREVIEW_FINISH_HOLD_MS-1),feed.duration);
  });
