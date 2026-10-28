import test from 'node:test';
import assert from 'node:assert/strict';
import {planPelotonChaseRotation,paidRotationMoments} from
  '../../lib/engine/v2/peloton-chase-rotation.mjs';

const worker=(riderId,capacity)=>({riderId,capacity});

test('one willing rider pays the full leading cost',()=>{
  const plan=planPelotonChaseRotation({contributions:[{teamId:'sprint-a',
    workers:[worker('a-1',80)]}],leadExtraCostPerKm:2,draftCostPerKm:.2});
  assert.equal(plan.effectiveCapacity,80);
  assert.deepEqual(plan.rotation,[{teamId:'sprint-a',riderId:'a-1',
    leadShare:1,leadExtraCost:2,draftCost:0}]);
});

test('two helpers rotate rather than stack their power',()=>{
  const plan=planPelotonChaseRotation({contributions:[{teamId:'sprint-a',
    workers:[worker('a-1',80),worker('a-2',70)]}],
  leadExtraCostPerKm:2,draftCostPerKm:.2});
  assert.equal(plan.effectiveCapacity,75);
  assert.deepEqual(plan.rotation.map(row=>row.leadShare),[.5,.5]);
  assert.deepEqual(plan.rotation.map(row=>row.leadExtraCost),[1,1]);
  assert.deepEqual(plan.rotation.map(row=>row.draftCost),[.1,.1]);
});

test('a later second team can help without creating additive speed',()=>{
  const alone=planPelotonChaseRotation({contributions:[{teamId:'sprint-a',
    workers:[worker('a-1',80),worker('a-2',70)]}],leadExtraCostPerKm:2});
  const together=planPelotonChaseRotation({contributions:[
    {teamId:'sprint-a',workers:[worker('a-1',80),worker('a-2',70)]},
    {teamId:'sprint-b',workers:[worker('b-1',85),worker('b-2',75)]},
  ],leadExtraCostPerKm:2});
  assert.equal(together.effectiveCapacity,77.5);
  assert.ok(together.effectiveCapacity<alone.effectiveCapacity*2);
  assert.deepEqual(together.rotation.map(row=>row.leadExtraCost),
    [.5,.5,.5,.5]);
  assert.deepEqual(together.activeTeamIds,['sprint-a','sprint-b']);
});

test('an uncommitted team supplies no pull or capacity',()=>{
  const plan=planPelotonChaseRotation({contributions:[],
    leadExtraCostPerKm:2});
  assert.equal(plan.workerCount,0);
  assert.equal(plan.effectiveCapacity,0);
  assert.deepEqual(plan.rotation,[]);
});

test('duplicate or fabricated paid workers are refused',()=>{
  assert.throws(()=>planPelotonChaseRotation({contributions:[
    {teamId:'a',workers:[worker('same',80)]},
    {teamId:'b',workers:[worker('same',70)]},
  ],leadExtraCostPerKm:2}),/Invalid peloton rotation worker/);
  assert.throws(()=>planPelotonChaseRotation({contributions:[
    {teamId:'a',workers:[worker('one',80)]},
    {teamId:'a',workers:[worker('two',70)]},
  ],leadExtraCostPerKm:2}),/Invalid peloton rotation team/);
});

test('viewer lines follow paid starts, reinforcements and stops',()=>{
  const plan=contributions=>planPelotonChaseRotation({contributions,
    leadExtraCostPerKm:2});
  const one=plan([{teamId:'a',workers:[worker('a-1',80)]}]);
  const reinforced=plan([{teamId:'a',workers:[
    worker('a-1',80),worker('a-2',70)]},
  {teamId:'b',workers:[worker('b-1',85),worker('b-2',75)]}]);
  assert.deepEqual(paidRotationMoments(null,one,{a:'Team A'})
    .map(row=>row.text),
  ['Team A sends 1 rider into the paid chase rotation.']);
  assert.deepEqual(paidRotationMoments(one,reinforced,{a:'Team A',b:'Team B'})
    .map(row=>row.text),[
    'Team A adds 1 rider to the paid chase rotation.',
    'Team B sends 2 riders into the paid chase rotation.']);
  assert.deepEqual(paidRotationMoments(reinforced,one,{b:'Team B'})
    .map(row=>row.text),['Team B ends its paid chase rotation.']);
  assert.deepEqual(paidRotationMoments(one,one),[]);
});
