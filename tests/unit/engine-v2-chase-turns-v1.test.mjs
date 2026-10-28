import test from 'node:test';
import assert from 'node:assert/strict';
import {planChaseTurnsV1} from '../../lib/engine/v2/chase-turns-v1.mjs';

const candidates=[
  {teamId:'a',riderId:'a-1',capacity:10,costPerKm:1,energy:5},
  {teamId:'a',riderId:'a-2',capacity:8,costPerKm:1,energy:5},
  {teamId:'b',riderId:'b-1',capacity:12,costPerKm:2,energy:5},
];

test('chasing teams rotate one named paid helper without summing speeds',()=>{
  const plan=planChaseTurnsV1({km:1,candidates});
  assert.deepEqual(plan.turns.map(row=>[row.leaderRiderId,row.startM,
    row.endM]),[['a-1',0,334],['a-2',334,667],['b-1',667,1000]]);
  assert.ok(plan.chasePower<30);
  assert.equal(plan.chasePower,
    plan.teamContributions.reduce((sum,row)=>sum+row.capacity,0));
  assert.deepEqual(plan.extraEnergyCosts.map(row=>row.leadingM),
    [334,333,333]);
  assert.equal(planChaseTurnsV1({km:2,candidates}).turns[0].leaderRiderId,
    'a-2');
});

test('an unpayable named turn refuses and no committed chase stays idle',()=>{
  assert.throws(()=>planChaseTurnsV1({km:1,candidates:[
    {...candidates[0],energy:.1},...candidates.slice(1)]}),/cannot be paid/);
  assert.equal(planChaseTurnsV1({km:1,candidates:[]}).status,'no_chase');
});
