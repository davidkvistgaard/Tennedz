import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFeed,createSampler,validateClock,
  commentaryAt} from '@pelotonia/race-viewer/data';
import {createPhysicalFirstViewerTestRaceV1} from
  '../../lib/viewer/physical-first-test-race-v1.mjs';
import {adaptConnectedPhysicalFirstRaceV1} from
  '../../lib/viewer/physical-first-adapter-v1.mjs';
import {previewBroadcastClockV1} from
  '../../lib/viewer/preview-clock-v1.mjs';
import {rendererStressFeedV1} from
  '../../lib/viewer/renderer-stress-feed-v1.mjs';

for(const category of ['men','women'])
  test(`actual paid Motor Lab race exports ${category} from start to finish`,()=>{
    const {feed,coverage}=createPhysicalFirstViewerTestRaceV1(category);
    assert.deepEqual(validateFeed(feed),feed);
    assert.equal(feed.riderCategory,category);
    assert.equal(feed.riders.length,32);
    assert.equal(feed.frames.length,41);
    assert.equal(coverage.paidRiderKilometres,1280);
    assert.equal(feed.results,undefined);
    assert.equal(feed.route.points.length,2);
    const sample=createSampler(feed);
    for(const [time,distance] of [[0,0],
      [feed.frames[20].time,20000],
      [feed.duration,40000]]){
      const state=sample(time);
      assert.equal(state.positions.length,32);
      assert.ok(state.positions.every(row=>
        Math.abs(row.distance-distance)<.002&&
        row.lateral===0&&row.groupId==='peloton'));
      assert.equal(state.results,null);
      assert.ok(state.events.every(event=>event.time<=time));
      assert.ok(commentaryAt(feed,time).every(row=>row.time<=time));
    }
    assert.equal(commentaryAt(feed,0).some(row=>
      row.text.includes('finish')),false);
    assert.equal(commentaryAt(feed,0).some(row=>
      row.text.includes('leads kilometre')),false);
    assert.equal(commentaryAt(feed,feed.frames[1].time-.001).some(row=>
      row.text.includes('leads kilometre 1')),false);
    assert.equal(commentaryAt(feed,feed.frames[1].time).some(row=>
      row.text.includes('leads kilometre 1')),true);
    const anchor=previewBroadcastClockV1(feed.duration,4_020_123);
    assert.equal(validateClock(anchor.clock).duration,feed.duration);
    assert.equal(anchor.clock.serverEpochMs,3_600_000);
  });

test('split roads are refused instead of converting group gaps to positions',()=>{
  const {feed}=createPhysicalFirstViewerTestRaceV1('men');
  const fake={completedThroughKm:40,
    states:feed.frames.map((frame,index)=>({sourceKm:index,
      roads:[{roadId:'peloton',clockSeconds:frame.time,
        riderIds:feed.riders.map(rider=>rider.id)},
      {roadId:'break',clockSeconds:frame.time-20,riderIds:[]}],
      riders:feed.riders.map(rider=>({riderId:rider.id,
        roadId:'peloton',distanceM:index*1000,
        clockSeconds:frame.time}))})),
    steps:Array.from({length:40},()=>({}))};
  const kilometres=feed.route.profile.samples.slice(1)
    .map(([distance,endM],index)=>({km:index+1,
      startM:feed.route.profile.samples[index][1],endM,
      distance}));
  const teams=feed.teams.map(team=>({id:team.id,
    riders:feed.riders.filter(rider=>rider.teamId===team.id)}));
  assert.throws(()=>adaptConnectedPhysicalFirstRaceV1({
    race:fake,kilometres,teams,teamStyles:feed.teams,
    raceId:'refusal',category:'men'}),
  /lacks common-time paid positions/);
});

for(const category of ['men','women'])
  for(const count of [30,150])
    test(`synthetic renderer stress contract ${category} ${count}`,()=>{
      const source=createPhysicalFirstViewerTestRaceV1(category).feed;
      const feed=rendererStressFeedV1(source,count,{missingAsset:true});
      assert.deepEqual(validateFeed(feed),feed);
      assert.equal(feed.riders.length,count);
      assert.equal(createSampler(feed)(feed.frames[20].time)
        .positions.length,count);
      assert.equal(feed.assets.length,1);
      assert.equal(feed.results,undefined);
      assert.match(feed.title,/Synthetic/);
    });
