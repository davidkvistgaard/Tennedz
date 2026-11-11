import test from 'node:test';
import assert from 'node:assert/strict';
import {recordedGameBroadcastV1} from
  '../../lib/viewer/recorded-game-broadcast-v1.mjs';

const epoch=Date.parse('2026-11-09T14:00:00.000Z');
const source={recorded_at:new Date(epoch).toISOString(),
  race_id:'saved-race',duration:120,
  events:[{id:'start',time:0},{id:'attack',time:50},
    {id:'finish',time:120}]};

test('one saved timestamp drives every spectator without future events',()=>{
  const early=recordedGameBroadcastV1(source,epoch+500);
  assert.equal(early.clock.serverEpochMs,epoch+2000);
  assert.equal(early.clock.rate,60);
  assert.deepEqual(early.events,[]);
  assert.equal(early.recordingPublished,false);
  assert.equal(early.finishPublished,false);
  const start=recordedGameBroadcastV1(source,epoch+2000);
  assert.equal(start.recordingPublished,true);
  assert.deepEqual(start.events.map(event=>event.id),['start']);
  const later=recordedGameBroadcastV1(source,epoch+3000);
  assert.deepEqual(later.events.map(event=>event.id),
    ['start','attack']);
  assert.equal(later.finishPublished,false);
  const finished=recordedGameBroadcastV1(source,epoch+4000);
  assert.equal(finished.finishPublished,true);
  assert.deepEqual(finished.events.map(event=>event.id),
    ['start','attack','finish']);
  assert.equal(recordedGameBroadcastV1(source,epoch+5000)
    .clock.serverEpochMs,epoch+2000);
  assert.equal(recordedGameBroadcastV1(source,epoch+19000)
    .clock.serverEpochMs,epoch+19000);
});
