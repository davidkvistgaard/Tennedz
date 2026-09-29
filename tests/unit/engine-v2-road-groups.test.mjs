import test from 'node:test';
import assert from 'node:assert/strict';
import {splitFrontRoadGroup,formChasingRoadGroup,advanceRoadGroups,
  validateRoadGroupTransition} from '../../lib/engine/v2/road-groups.mjs';

const initial=[{id:'road-1',riderIds:['a-0','a-1','b-0'],teamIds:['a','b'],gapSeconds:20}];
const teams={"a-0":'a',"a-1":'a',"b-0":'b'};
const split=()=>splitFrontRoadGroup(initial,{riderId:'a-0',teamByRiderId:teams,
  newGroupId:'road-2',attackSeconds:4});

test('a break rider can open a second road group without moving teammates instantly',()=>{
  const groups=split();
  assert.deepEqual(groups,[
    {id:'road-2',riderIds:['a-0'],teamIds:['a'],gapSeconds:24},
    {id:'road-1',riderIds:['a-1','b-0'],teamIds:['a','b'],gapSeconds:20},
  ]);
  assert.deepEqual(initial,[{id:'road-1',riderIds:['a-0','a-1','b-0'],teamIds:['a','b'],gapSeconds:20}]);
});

test('the pursuing break can recatch the attacker without losing its group identity',()=>{
  const state=advanceRoadGroups(split(),{'road-2':-5,'road-1':0});
  assert.deepEqual(state.mergedGroupIds,['road-2']);
  assert.deepEqual(state.caughtRiderIds,[]);
  assert.equal(state.groups.length,1);
  assert.equal(state.groups[0].id,'road-1');
  assert.deepEqual(new Set(state.groups[0].riderIds),new Set(['a-0','a-1','b-0']));
  assert.equal(state.groups[0].gapSeconds,20);
});

test('the peloton can catch the pursuing group while the attacker remains clear',()=>{
  const state=advanceRoadGroups(split(),{'road-2':-2,'road-1':-21});
  assert.deepEqual(state.caughtRiderIds,['a-1','b-0']);
  assert.deepEqual(state.mergedGroupIds,[]);
  assert.deepEqual(state.groups,[{id:'road-2',riderIds:['a-0'],teamIds:['a'],gapSeconds:22}]);
});

test('an unsupported split is rejected before changing road state',()=>{
  assert.throws(()=>splitFrontRoadGroup(initial,{riderId:'foreign',teamByRiderId:teams,
    newGroupId:'road-2',attackSeconds:4}),/split/);
  assert.throws(()=>splitFrontRoadGroup(initial,{riderId:'a-0',teamByRiderId:teams,
    newGroupId:'road-1',attackSeconds:4}),/split/);
  assert.throws(()=>advanceRoadGroups(split(),{'road-2':0}),/pace change/);
});

test('replay must account for a split, a merge and a catch without losing riders',()=>{
  const splitGroups=split();
  assert.equal(validateRoadGroupTransition(initial,splitGroups,{splitRiderId:'a-0'}),true);
  assert.throws(()=>validateRoadGroupTransition(initial,splitGroups),/appeared/);
  const merged=advanceRoadGroups(splitGroups,{'road-2':-5,'road-1':0});
  assert.equal(validateRoadGroupTransition(splitGroups,merged.groups,
    {mergedGroupIds:merged.mergedGroupIds}),true);
  assert.throws(()=>validateRoadGroupTransition(splitGroups,merged.groups),/disappeared/);
  const caught=advanceRoadGroups(splitGroups,{'road-2':-2,'road-1':-21});
  assert.equal(validateRoadGroupTransition(splitGroups,caught.groups,
    {caughtRiderIds:caught.caughtRiderIds}),true);
  assert.throws(()=>validateRoadGroupTransition(splitGroups,caught.groups,
    {caughtRiderIds:['a-1']}),/continue|disappeared/);
});

test('a same-kilometre attack and finish catch can leave no road group',()=>{
  assert.equal(validateRoadGroupTransition([],[],{
    joinedRiderIds:['a-0'],caughtRiderIds:['a-0']}),true);
});

test('a distant peloton move forms a separate chasing group with its own gap',()=>{
  const previous=[{id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:24}];
  const chasing=formChasingRoadGroup(previous,{riderIds:['b-0','c-0'],
    teamByRiderId:{'b-0':'b','c-0':'c'},newGroupId:'road-2',gapSeconds:5});
  assert.deepEqual(chasing[0],previous[0]);
  assert.deepEqual(chasing[1],{id:'road-2',riderIds:['b-0','c-0'],
    teamIds:['b','c'],gapSeconds:5});
  assert.equal(validateRoadGroupTransition(previous,chasing,{
    joinedRiderIds:['b-0','c-0'],formedChaseGroupId:'road-2'}),true);
  assert.throws(()=>validateRoadGroupTransition(previous,chasing,{
    joinedRiderIds:['b-0','c-0']}),/appeared/);
  assert.throws(()=>formChasingRoadGroup(previous,{riderIds:['b-0'],
    teamByRiderId:{'b-0':'b'},newGroupId:'road-2',gapSeconds:24}),/chasing/);
});

test('several road groups can merge in order without losing their riders or identities',()=>{
  const groups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:30},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:20},
    {id:'road-3',riderIds:['c-0'],teamIds:['c'],gapSeconds:10},
  ];
  const moved=advanceRoadGroups(groups,{'road-1':-20,'road-2':-5,'road-3':6});
  assert.deepEqual(moved.mergedGroupIds,['road-1','road-2']);
  assert.deepEqual(moved.caughtRiderIds,[]);
  assert.deepEqual(moved.groups,[{id:'road-3',riderIds:['c-0','b-0','a-0'],
    teamIds:['c','b','a'],gapSeconds:16}]);
  assert.equal(validateRoadGroupTransition(groups,moved.groups,
    {mergedGroupIds:moved.mergedGroupIds}),true);
  const swapped=structuredClone(moved.groups);
  swapped[0].riderIds=['c-0','b-0','foreign'];
  assert.throws(()=>validateRoadGroupTransition(groups,swapped,
    {mergedGroupIds:moved.mergedGroupIds}),/continue|merge/);
});

test('the bunch catches a middle group before an independent rear move can pass it',()=>{
  const groups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:30},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:20},
    {id:'road-3',riderIds:['c-0'],teamIds:['c'],gapSeconds:10},
  ];
  const moved=advanceRoadGroups(groups,{'road-1':-10,'road-2':-21,'road-3':-9});
  assert.deepEqual(moved.caughtRiderIds,['b-0']);
  assert.deepEqual(moved.mergedGroupIds,[]);
  assert.deepEqual(moved.groups.map(group=>group.id),['road-1','road-3']);
  assert.equal(validateRoadGroupTransition(groups,moved.groups,
    {caughtRiderIds:moved.caughtRiderIds}),true);
});
