import test from 'node:test';
import assert from 'node:assert/strict';
import {positionResultPublishedV1} from
  '../../lib/viewer/position-result-publication-v1.mjs';

const start=Date.parse('2026-11-15T18:00:00Z');
const event={id:'race',engine_version:
  'physical-first-position-general-race-8',
  scheduled_at:new Date(start).toISOString()};
const source={race_id:'race',duration:120,
  recorded_at:new Date(start-60_000).toISOString(),
  events:[{id:'start',time:0},{id:'finish',time:120}]};
const db={rpc:async()=>({data:source,error:null})};

test('result endpoints remain hidden until the shared finish',async()=>{
  assert.equal(await positionResultPublishedV1(db,event,start-1),false);
  assert.equal(await positionResultPublishedV1(db,event,start+1_799_999),false);
  assert.equal(await positionResultPublishedV1(db,event,start+1_800_000),true);
  assert.equal(await positionResultPublishedV1(db,event,start+7_200_000),true);
});

test('historic engines keep their published results',async()=>{
  const noRpc={rpc:()=>{throw new Error('must not query');}};
  assert.equal(await positionResultPublishedV1(noRpc,
    {...event,engine_version:'2.1'},start),true);
});

test('missing or invalid recordings fail closed',async()=>{
  assert.equal(await positionResultPublishedV1(
    {rpc:async()=>({data:null,error:null})},event,start+10_000),false);
  await assert.rejects(positionResultPublishedV1(
    {rpc:async()=>({data:null,error:{message:'broken'}})},
    event,start+10_000),/recorded race clock/);
});
