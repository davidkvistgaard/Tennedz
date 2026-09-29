import test from 'node:test';
import assert from 'node:assert/strict';
import {splitFrontRoadGroup,splitRoadGroup,joinRoadGroupAhead,formChasingRoadGroup,advanceRoadGroups,
  validateRoadGroupTransition,selectRoadGroupPulls} from '../../lib/engine/v2/road-groups.mjs';

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

test('a pursuing rider can attack into an intermediate group without moving the leaders',()=>{
  const previous=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:30},
    {id:'road-2',riderIds:['b-0','b-1'],teamIds:['b'],gapSeconds:12},
  ];
  const moved=splitRoadGroup(previous,{riderId:'b-0',teamByRiderId:{'b-0':'b','b-1':'b'},
    newGroupId:'road-3',attackSeconds:5});
  assert.deepEqual(moved.map(group=>group.id),['road-1','road-3','road-2']);
  assert.deepEqual(moved.map(group=>group.gapSeconds),[30,17,12]);
  assert.equal(validateRoadGroupTransition(previous,moved,{splitRiderId:'b-0'}),true);
  assert.throws(()=>validateRoadGroupTransition(previous,moved,{splitRiderId:'b-1'}),/split/);
  assert.throws(()=>splitRoadGroup(previous,{riderId:'b-0',
    teamByRiderId:{'b-0':'b','b-1':'b'},newGroupId:'road-3',attackSeconds:18}),/split/);
});

test('a pursuing rider can bridge into the group directly ahead',()=>{
  const previous=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:20},
    {id:'road-2',riderIds:['b-0','b-1'],teamIds:['b'],gapSeconds:12},
  ];
  const moved=joinRoadGroupAhead(previous,{riderId:'b-0',
    teamByRiderId:{'b-0':'b','b-1':'b'}});
  assert.deepEqual(moved.map(group=>group.riderIds),[['a-0','b-0'],['b-1']]);
  assert.equal(validateRoadGroupTransition(previous,moved,{advancedRiderId:'b-0',
    advancedToGroupId:'road-1'}),true);
  assert.throws(()=>validateRoadGroupTransition(previous,moved),/changed groups/);
  assert.throws(()=>validateRoadGroupTransition(previous,moved,{advancedRiderId:'b-0',
    advancedToGroupId:'road-2'}),/ahead/);
});

test('a teammate behind a rider up the road sits on while rivals can still pull',()=>{
  const groups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:25},
    {id:'road-2',riderIds:['a-1','b-0'],teamIds:['a','b'],gapSeconds:12},
  ];
  const teams=['a','b'].map(id=>({id,riders:[{id:`${id}-0`},{id:`${id}-1`}],
    orders:{baseline:{breakWork:'cooperate'},phases:[]}}));
  assert.deepEqual(selectRoadGroupPulls(groups,teams,21),['a-0','b-0']);
  const separated=[groups[0],
    {id:'road-3',riderIds:['b-0'],teamIds:['b'],gapSeconds:18},
    {id:'road-2',riderIds:['a-1'],teamIds:['a'],gapSeconds:12}];
  assert.deepEqual(selectRoadGroupPulls(separated,teams,21),['a-0','b-0']);
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

test('a second peloton move can form a third group behind an existing chase',()=>{
  const two=[
    {id:'road-1',riderIds:['a-0','a-1'],teamIds:['a'],gapSeconds:30},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:12},
  ];
  const three=formChasingRoadGroup(two,{riderIds:['c-0'],
    teamByRiderId:{'c-0':'c'},newGroupId:'road-3',gapSeconds:5});
  assert.deepEqual(three.map(group=>group.id),['road-1','road-2','road-3']);
  assert.equal(validateRoadGroupTransition(two,three,{
    joinedRiderIds:['c-0'],formedChaseGroupId:'road-3'}),true);
  const frontSplit=splitFrontRoadGroup(two,{riderId:'a-0',
    teamByRiderId:{'a-0':'a','a-1':'a','b-0':'b'},newGroupId:'road-3',attackSeconds:4});
  assert.deepEqual(frontSplit.map(group=>group.id),['road-3','road-1','road-2']);
  assert.equal(validateRoadGroupTransition(two,frontSplit,{splitRiderId:'a-0'}),true);
  assert.throws(()=>formChasingRoadGroup(two,{riderIds:['c-0'],
    teamByRiderId:{'c-0':'c'},newGroupId:'road-3',gapSeconds:13}),/chasing/);
});

test('a new chase remains valid when older road groups merge that kilometre',()=>{
  const previous=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:30},
    {id:'road-2',riderIds:['b-0'],teamIds:['b'],gapSeconds:20},
    {id:'road-3',riderIds:['c-0'],teamIds:['c'],gapSeconds:10},
  ];
  const moved=advanceRoadGroups(previous,{'road-1':-11,'road-2':0,'road-3':0});
  const current=formChasingRoadGroup(moved.groups,{riderIds:['d-0'],
    teamByRiderId:{'d-0':'d'},newGroupId:'road-4',gapSeconds:4});
  assert.deepEqual(current.map(group=>group.id),['road-2','road-3','road-4']);
  assert.equal(validateRoadGroupTransition(previous,current,{
    mergedGroupIds:moved.mergedGroupIds,joinedRiderIds:['d-0'],
    formedChaseGroupId:'road-4'}),true);
  assert.throws(()=>validateRoadGroupTransition(previous,current,{
    joinedRiderIds:['d-0'],formedChaseGroupId:'road-4'}),/disappeared/);
});

test('a rider may split from the leading group just after its road groups merge',()=>{
  const previous=[
    {id:'road-1',riderIds:['a-0','b-0'],teamIds:['a','b'],gapSeconds:30},
    {id:'road-2',riderIds:['c-0'],teamIds:['c'],gapSeconds:20},
  ];
  const moved=advanceRoadGroups(previous,{'road-1':-11,'road-2':0});
  const current=splitFrontRoadGroup(moved.groups,{riderId:'a-0',
    teamByRiderId:{'a-0':'a','b-0':'b','c-0':'c'},
    newGroupId:'road-3',attackSeconds:4});
  assert.deepEqual(current.map(group=>group.id),['road-3','road-2']);
  assert.equal(validateRoadGroupTransition(previous,current,{
    mergedGroupIds:['road-1'],splitRiderId:'a-0'}),true);
  assert.throws(()=>validateRoadGroupTransition(previous,current,{
    splitRiderId:'a-0'}),/disappeared/);
  const wrongSource=[
    {id:'road-3',riderIds:['c-0'],teamIds:['c'],gapSeconds:34},
    {...previous[0]},
  ];
  assert.throws(()=>validateRoadGroupTransition(previous,wrongSource,
    {splitRiderId:'c-0'}),/split/);
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
