import test from 'node:test';
import assert from 'node:assert/strict';
import {startGeneralClassification,recordGeneralClassificationStage} from
  '../../lib/engine/v2/classification.mjs';

const riders=Array.from({length:16},(_,index)=>({riderId:`r${index}`,
  teamId:index<8?'a':'b',gender:'M'}));
const times=(overrides={})=>riders.map(rider=>({riderId:rider.riderId,
  timeSeconds:overrides[rider.riderId]??3600}));

test('two classified stages update cumulative time exactly once without changing earlier standings',()=>{
  const start=startGeneralClassification({raceCategory:'M',riders});
  const first=recordGeneralClassificationStage(start,{stageId:'stage-1',
    classifiedTimes:times({r0:3590,r8:3595})});
  assert.deepEqual(first,recordGeneralClassificationStage(start,{stageId:'stage-1',
    classifiedTimes:times({r0:3590,r8:3595}).reverse()}));
  const snapshot=structuredClone(first);
  const second=recordGeneralClassificationStage(first,{stageId:'stage-2',
    classifiedTimes:riders.map(rider=>({riderId:rider.riderId,
      timeSeconds:rider.riderId==='r0'?3650:rider.riderId==='r8'?3630:3700}))});
  assert.deepEqual(first,snapshot);
  assert.deepEqual(start.completedStageIds,[]);
  assert.deepEqual(second.completedStageIds,['stage-1','stage-2']);
  assert.equal(first.standings[0].riderId,'r0');
  assert.equal(second.standings[0].riderId,'r8');
  assert.equal(second.standings[0].totalMilliseconds,7225000);
  assert.equal(second.standings.find(row=>row.riderId==='r0').totalMilliseconds,7240000);
  assert.throws(()=>recordGeneralClassificationStage(second,{stageId:'stage-2',
    classifiedTimes:times()}),/classification stage/);
});

test('equal cumulative times share a place and categories stay separate',()=>{
  const start=startGeneralClassification({raceCategory:'M',riders});
  const first=recordGeneralClassificationStage(start,{stageId:'stage-1',
    classifiedTimes:times({r0:3599.5,r8:3599.5})});
  assert.equal(first.standings[0].position,1);
  assert.equal(first.standings[1].position,1);
  assert.equal(first.standings[2].position,3);
  assert.throws(()=>startGeneralClassification({raceCategory:'F',riders}),/roster/);
});

test('classified milliseconds accumulate without floating-point drift',()=>{
  const start=startGeneralClassification({raceCategory:'M',riders});
  const first=recordGeneralClassificationStage(start,{stageId:'stage-1',
    classifiedTimes:times({r0:3600.001})});
  const second=recordGeneralClassificationStage(first,{stageId:'stage-2',
    classifiedTimes:times({r0:3600.002})});
  assert.equal(second.standings.find(row=>row.riderId==='r0').totalMilliseconds,7200003);
});

test('classification rejects missing, duplicate, foreign and invented stage times',()=>{
  const start=startGeneralClassification({raceCategory:'M',riders});
  const apply=classifiedTimes=>recordGeneralClassificationStage(start,
    {stageId:'stage-1',classifiedTimes});
  assert.throws(()=>apply(times().slice(1)),/classification stage/);
  assert.throws(()=>apply([...times().slice(1),times()[1]]),/roster/);
  assert.throws(()=>apply([...times().slice(1),{riderId:'foreign',timeSeconds:3600}]),
    /classified stage time/);
  assert.throws(()=>apply(times({r0:-1})),/classified stage time/);
  assert.throws(()=>apply(times({r0:3600.0001})),/classified stage time/);
  assert.throws(()=>apply(times({r0:'3600'})),/classified stage time/);
});
