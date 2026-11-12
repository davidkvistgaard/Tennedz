import test from 'node:test';
import assert from 'node:assert/strict';
import {planWinterAgentTacticsV1} from
  '../../lib/race/winter-agent-tactics-v1.mjs';
import {preparePhysicalEntryV1} from
  '../../lib/race/physical-entry-v1.mjs';

const ids=Array.from({length:8},(_,i)=>`r${i}`);
const entry={selected_riders:ids,captain_id:ids[0]};
const stage={distance_km:298,tags:['FLAT'],keypoints:[]};
function riders({sprint=48,hills=28}={}){
  return ids.map((id,i)=>({id,sprint:i?30:sprint,
    hills:i?30:hills,flat:40+i,endurance:38+i,
    leadership:35+i,strength:40+i}));
}

test('sprint manager uses entered lineup, paid helper and late chase',()=>{
  const roster=riders();
  const plan=planWinterAgentTacticsV1({entry,riders:roster,stage});
  assert.equal(plan.version,'winter-agent-tactics-v1');
  assert.equal(plan.reason,'flat_route_sprint_captain');
  assert.equal(plan.stake.sportingGoal,'sprint_finish');
  assert.equal(plan.orders.captainId,ids[0]);
  assert.equal(plan.orders.baseline.frontWork,'rotate');
  assert.equal(plan.orders.helperIds.length,6);
  assert.equal(plan.orders.phases[0].atKm,245);
  assert.equal(plan.orders.phases[0].frontWork,'rotate');
  assert.equal(plan.orders.phases[0].frontWorkRiderId,undefined);
  const prepared=preparePhysicalEntryV1({body:{
    version:'physical-entry-request-v1',
    selected_riders:ids,captain_id:ids[0],
    orders:plan.orders,stake:plan.stake},stage,
  team:{id:'test-team',name:'Agent team'}});
  assert.equal(prepared.orders.phases[1].atKm,293);
  assert.equal(prepared.stake.sportingGoal,'sprint_finish');
});

test('climber captain conserves in a flat race',()=>{
  const plan=planWinterAgentTacticsV1({entry,
    riders:riders({sprint:24,hills:42}),stage});
  assert.equal(plan.reason,'flat_route_climb_captain_conserve');
  assert.equal(plan.orders.baseline.attack,'none');
  assert.equal(plan.orders.baseline.frontWork,'sit_in');
  assert.equal(plan.stake.sportingGoal,'none');
});

test('policy refuses another route or incomplete measured roster',()=>{
  assert.throws(()=>planWinterAgentTacticsV1({entry,
    riders:riders(),stage:{...stage,tags:['HILLY']}}));
  assert.throws(()=>planWinterAgentTacticsV1({entry,
    riders:riders().slice(1),stage}));
  assert.throws(()=>planWinterAgentTacticsV1({entry:{...entry,
    selected_riders:ids.slice(1)},riders:riders(),stage}));
});
