import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultKit} from '../../lib/riders/club-kit.mjs';
import {preparePhysicalEntryV1,
  PHYSICAL_ENTRY_REQUEST_VERSION} from
  '../../lib/race/physical-entry-v1.mjs';

const team={id:'team-fixture',name:'Saved club'};
const ids=Array.from({length:8},(_,index)=>
  `rider-${index+1}`);
const body=()=>({version:PHYSICAL_ENTRY_REQUEST_VERSION,
  selected_riders:[...ids],captain_id:ids[6],
  orders:{version:2,captainId:ids[6],
    roadCaptainId:ids[0],
    helperIds:[ids[1],ids[2],ids[3],ids[4],ids[5],ids[7]],
    baseline:{effort:'steady',attack:'none',
      chase:'selective',frontWork:'rotate',
      frontWorkRiderId:ids[1]}},
  stake:{sportingGoal:'sprint_finish',
    sportingCaptainId:ids[6]}});

test('physical entry commits normalized manager orders and game kit',()=>{
  const result=preparePhysicalEntryV1({body:body(),
    stage:{distance_km:120,keypoints:[]},team,
    savedKit:defaultKit(team.id)});
  assert.equal(result.orders.captainId,ids[6]);
  assert.equal(result.orders.baseline.frontWorkRiderId,ids[1]);
  assert.deepEqual(result.stake,body().stake);
  assert.equal(result.teamStyle.id,team.id);
  assert.equal(result.teamStyle.name,team.name);
  assert.equal(result.teamStyle.pattern,'paths');
  assert.match(result.teamStyle.color,/^#[0-9a-f]{6}$/i);
});

test('physical entry refuses invented tactical and sporting inputs',()=>{
  const missing=body();
  delete missing.orders.baseline.chase;
  assert.throws(()=>preparePhysicalEntryV1({body:missing,
    stage:{distance_km:120},team}),/explicit orders/);
  const wrongGoal=body();
  wrongGoal.stake.sportingCaptainId='outside-lineup';
  assert.throws(()=>preparePhysicalEntryV1({body:wrongGoal,
    stage:{distance_km:120},team}),/explicit orders/);
  const wrongKit={palette:'not-saved',pattern:'plain'};
  assert.throws(()=>preparePhysicalEntryV1({body:body(),
    stage:{distance_km:120},team,savedKit:wrongKit}),
  /saved kit/);
});
