import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed,createSampler,commentaryAt} from
  '@pelotonia/race-viewer/data';
import {createPhysicalFirstSplitViewerTestRaceV1} from
  '../../lib/viewer/physical-first-split-test-race-v1.mjs';
import {previewBroadcastClockV1} from
  '../../lib/viewer/preview-clock-v1.mjs';
import {parsePhysicalSplitVariantV1,physicalSplitVariantQueryV1} from
  '../../lib/viewer/physical-first-split-variant-v1.mjs';
import {scenicPresentationV1} from
  '../../lib/viewer/scenic-presentation-v1.mjs';

test('split viewer variant survives URL and rejects invented inputs',()=>{
  const variant={terrain:'rolling',chase:'all',attack:'selective',
    seed:'race-21'};
  const query=physicalSplitVariantQueryV1(variant);
  assert.deepEqual(parsePhysicalSplitVariantV1(new URLSearchParams(query)),
    variant);
  assert.throws(()=>parsePhysicalSplitVariantV1({terrain:'desert'}),
    /Choose valid/);
  assert.throws(()=>parsePhysicalSplitVariantV1({seed:'../secret'}),
    /Choose valid/);
  assert.throws(()=>parsePhysicalSplitVariantV1({winner:'you-7'}),
    /Choose valid/);
});

test('new seed and profile produce a distinct replayable viewer race',()=>{
  const variant=parsePhysicalSplitVariantV1({terrain:'flat',
    seed:'new-profile-2'});
  const first=createPhysicalFirstSplitViewerTestRaceV1('men',variant);
  const again=createPhysicalFirstSplitViewerTestRaceV1('men',variant);
  const original=createPhysicalFirstSplitViewerTestRaceV1('men');
  assert.equal(first,again);
  assert.notEqual(first.feed.raceId,original.feed.raceId);
  assert.deepEqual(validateFeed(first.feed),first.feed);
  const scene=scenicPresentationV1(first.feed);
  assert.deepEqual(validateFeed(scene),scene);
  assert.equal(scene.synthetic,true);
  assert.deepEqual(scene.frames,first.feed.frames);
  assert.deepEqual(scene.events,first.feed.events);
  assert.equal(scene.results,undefined);
  assert.equal(first.coverage.paidRiderKilometres,14400);
  assert.equal(first.feed.results,undefined);
  assert.equal(first.feed.frames.at(-1).time,first.feed.duration);
  assert.equal(previewBroadcastClockV1(first.feed.duration,10_000)
    .clock.duration,first.feed.duration);
});

for(const category of ['men','women'])
  test(`selective paid race ${category} reaches viewer finish`,()=>{
    const {feed,coverage,version,finishEvidence}=
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
    assert.equal(finishEvidence.version,'motor-lab-paid-finish-v1');
    assert.equal(finishEvidence.publishedAt,feed.duration);
    assert.equal(finishEvidence.entries.length,120);
    assert.equal(new Set(finishEvidence.entries.map(row=>row.riderId)).size,
      120);
    assert.ok(finishEvidence.entries.every((row,index,rows)=>
      row.clockSeconds>0&&row.clockSeconds<=feed.duration&&
      (index===0||row.clockSeconds>=rows[index-1].clockSeconds)));
    assert.equal(finishEvidence.entries.at(-1).clockSeconds,
      feed.duration);
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
    const {feed,coverage,finishEvidence}=
      createPhysicalFirstSplitViewerTestRaceV1(
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
    assert.equal(finishEvidence.entries.length,120);
  });
