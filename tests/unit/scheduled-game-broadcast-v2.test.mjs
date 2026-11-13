import test from 'node:test';
import assert from 'node:assert/strict';
import {scheduledGameBroadcastV2,
  SCHEDULED_GAME_PLAYBACK_MS} from
  '../../lib/viewer/scheduled-game-broadcast-v2.mjs';

const start=Date.parse('2026-11-15T18:00:00Z');
const race={race_id:'sunday',duration:120,
  recorded_at:new Date(start-60_000).toISOString(),
  scheduled_at:new Date(start).toISOString(),
  events:[{id:'start',time:0},{id:'attack',time:60},
    {id:'finish',time:120}]};

test('the scheduled recording runs once from 19:00 to 19:30 CET',()=>{
  const before=scheduledGameBroadcastV2(race,start-1);
  assert.equal(before.recordingPublished,false);
  assert.equal(before.clock.paused,true);
  assert.deepEqual(before.events,[]);
  const beginning=scheduledGameBroadcastV2(race,start);
  assert.equal(beginning.publicationAtMs,start);
  assert.equal(beginning.finishAtMs,start+SCHEDULED_GAME_PLAYBACK_MS);
  assert.equal(beginning.clock.version,'scheduled-game-broadcast-v2');
  assert.equal(beginning.clock.rate,120/1800);
  assert.equal(beginning.clock.paused,false);
  assert.deepEqual(beginning.events.map(row=>row.id),['start']);
  const midpoint=scheduledGameBroadcastV2(race,start+900_000);
  assert.deepEqual(midpoint.events.map(row=>row.id),
    ['start','attack']);
  assert.equal(midpoint.finishPublished,false);
  const almost=scheduledGameBroadcastV2(race,start+1_799_999);
  assert.equal(almost.finishPublished,false);
  assert.deepEqual(almost.events.map(row=>row.id),
    ['start','attack']);
  const finish=scheduledGameBroadcastV2(race,start+1_800_000);
  assert.equal(finish.finishPublished,true);
  assert.equal(finish.clock.paused,true);
  assert.equal(finish.clock.position,120);
  assert.deepEqual(finish.events.map(row=>row.id),
    ['start','attack','finish']);
  const later=scheduledGameBroadcastV2(race,start+7_200_000);
  assert.equal(later.finishPublished,true);
  assert.equal(later.clock.serverEpochMs,start);
  assert.equal(later.clock.position,120);
});

test('a late recording retains a full shared window without inventing frames',()=>{
  const recorded=start+60_000;
  const late={...race,recorded_at:new Date(recorded).toISOString()};
  assert.equal(scheduledGameBroadcastV2(late,start)
    .recordingPublished,false);
  assert.equal(scheduledGameBroadcastV2(late,recorded)
    .publicationAtMs,recorded);
  assert.equal(scheduledGameBroadcastV2(late,
    recorded+SCHEDULED_GAME_PLAYBACK_MS).finishPublished,true);
});

test('historic unscheduled recordings retain their existing clock',()=>{
  const historic=scheduledGameBroadcastV2(
    {...race,scheduled_at:null},start-58_000);
  assert.equal(historic.clock.version,'recorded-game-broadcast-v1');
  assert.equal(historic.clock.rate,60);
  assert.throws(()=>scheduledGameBroadcastV2({...race,
    scheduled_at:'invalid'},start),/valid recording and start/);
});
