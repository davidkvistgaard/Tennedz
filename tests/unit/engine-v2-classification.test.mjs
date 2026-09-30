import test from 'node:test';
import assert from 'node:assert/strict';
import {startGeneralClassification,recordGeneralClassificationStage,
  projectGeneralClassification,identifyTopTenThreats} from
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

test('provisional road gaps reveal a top-ten GC threat without future results',()=>{
  const prior=startGeneralClassification({raceCategory:'M',riders});
  const faster=new Set(['r1','r2','r3','r4','r5','r6','r7','r9','r10']);
  const classifiedTimes=times(Object.fromEntries(riders.map(rider=>[
    rider.riderId,faster.has(rider.riderId)?3590:
      rider.riderId==='r0'?3600:rider.riderId==='r8'?3602:3610,
  ])));
  const before=recordGeneralClassificationStage(prior,{stageId:'stage-1',classifiedTimes});
  assert.equal(before.standings.find(row=>row.riderId==='r0').position,10);
  assert.equal(before.standings.find(row=>row.riderId==='r8').position,11);
  const states=riders.map(rider=>({id:rider.riderId,teamId:rider.teamId,
    group:rider.riderId==='r8'?'breakaway':'peloton',deficitSeconds:0}));
  const threatened=projectGeneralClassification(before,{roadGroups:[{
    id:'road-1',riderIds:['r8'],teamIds:['b'],gapSeconds:5,
  }],riderStates:states});
  assert.equal(threatened.find(row=>row.riderId==='r0').position,11);
  assert.ok(threatened.find(row=>row.riderId==='r8').position<=10);
  assert.equal(before.standings.find(row=>row.riderId==='r0').position,10);
  const harmless=projectGeneralClassification(before,{roadGroups:[{
    id:'road-1',riderIds:['r15'],teamIds:['b'],gapSeconds:5,
  }],riderStates:states.map(state=>({...state,group:state.id==='r15'?'breakaway':'peloton'}))});
  assert.equal(harmless.find(row=>row.riderId==='r0').position,10);
});

test('GC projection rejects missing or contradictory road state',()=>{
  const start=startGeneralClassification({raceCategory:'M',riders});
  const first=recordGeneralClassificationStage(start,{stageId:'stage-1',
    classifiedTimes:times()});
  const states=riders.map(rider=>({id:rider.riderId,teamId:rider.teamId,
    group:'peloton',deficitSeconds:0}));
  assert.throws(()=>projectGeneralClassification(start,{roadGroups:[],riderStates:states}),
    /completed stage/);
  assert.throws(()=>projectGeneralClassification(first,{roadGroups:[],riderStates:states.slice(1)}),
    /full rider state/);
  assert.throws(()=>projectGeneralClassification(first,{roadGroups:[{
    id:'road-1',riderIds:['r8'],teamIds:['b'],gapSeconds:5,
  }],riderStates:states}),/rider state/);
  assert.throws(()=>projectGeneralClassification(first,{roadGroups:[{
    id:'road-1',riderIds:['r8'],teamIds:['a'],gapSeconds:5,
  }],riderStates:states.map(state=>({...state,group:state.id==='r8'?'breakaway':'peloton'}))}),
  /rider state/);
});

test('top-ten threat identifies only a rival break that displaces a protected place',()=>{
  const start=startGeneralClassification({raceCategory:'M',riders});
  const faster=new Set(['r1','r2','r3','r4','r5','r6','r7','r9','r10']);
  const prior=recordGeneralClassificationStage(start,{stageId:'stage-1',
    classifiedTimes:times(Object.fromEntries(riders.map(rider=>[
      rider.riderId,faster.has(rider.riderId)?3590:
        rider.riderId==='r0'?3600:rider.riderId==='r8'?3602:3610,
    ])))});
  const states=riders.map(rider=>({id:rider.riderId,teamId:rider.teamId,
    group:rider.riderId==='r8'?'breakaway':'peloton',deficitSeconds:0}));
  const moving={roadGroups:[{id:'road-1',riderIds:['r8'],teamIds:['b'],gapSeconds:5}],
    riderStates:states};
  assert.deepEqual(identifyTopTenThreats(prior,moving),[{
    teamId:'a',riderId:'r0',priorPosition:10,projectedPosition:11,rivalRiderIds:['r8'],
  }]);
  assert.deepEqual(identifyTopTenThreats(prior,{...moving,roadGroups:[{
    ...moving.roadGroups[0],gapSeconds:1,
  }]}),[]);
  assert.deepEqual(identifyTopTenThreats(prior,{...moving,riderStates:states.map(state=>({
    ...state,group:state.id==='r0'?'dropped':state.group,
    deficitSeconds:state.id==='r0'?10:0,
  }))}),[]);
});
