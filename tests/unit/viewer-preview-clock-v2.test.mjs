import test from 'node:test';
import assert from 'node:assert/strict';
import {broadcastTime,validateClock} from '@pelotonia/race-viewer/data';
import {previewBroadcastClockV2,previewVisibleEventsV2,
  VIEWER_PREVIEW_FINISH_HOLD_MS} from
  '../../lib/viewer/preview-clock-v2.mjs';

test('shared preview clock holds the finish without extending race time',()=>{
  const duration=240;
  const raceMs=duration*1000;
  const cycleMs=raceMs+VIEWER_PREVIEW_FINISH_HOLD_MS;
  for(const [now,expected] of [[0,0],[raceMs-1,239.999],
    [raceMs,240],[raceMs+7500,240],[cycleMs-1,240],
    [cycleMs,0],[cycleMs+1800,1.8]]){
    const {clock}=previewBroadcastClockV2(duration,now);
    assert.deepEqual(validateClock(clock),clock);
    assert.equal(clock.duration,duration);
    assert.equal(broadcastTime(clock,now),expected,`at ${now} ms`);
    assert.equal(clock.paused,now%cycleMs>=raceMs);
  }
});

test('a fractional recorded duration still reaches its recorded finish',()=>{
  const duration=3317.9154;
  const raceMs=Math.round(duration*1000);
  const {clock}=previewBroadcastClockV2(duration,raceMs+1000);
  assert.equal(clock.position,duration);
  assert.equal(clock.paused,true);
  assert.equal(broadcastTime(clock,raceMs+1000),duration);
});

test('public sample clock discloses only reached commentary events',()=>{
  const feed={duration:240,events:[{time:0,label:'Start'},
    {time:80,label:'Chase'},{time:240,label:'Finish'}]};
  assert.deepEqual(previewVisibleEventsV2(feed,
    previewBroadcastClockV2(240,79000)),[feed.events[0]]);
  assert.deepEqual(previewVisibleEventsV2(feed,
    previewBroadcastClockV2(240,80000)),feed.events.slice(0,2));
  assert.deepEqual(previewVisibleEventsV2(feed,
    previewBroadcastClockV2(240,240000)),feed.events);
  assert.deepEqual(previewVisibleEventsV2(feed,
    previewBroadcastClockV2(240,255000)),[feed.events[0]]);
});
