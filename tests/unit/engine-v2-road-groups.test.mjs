import test from 'node:test';
import assert from 'node:assert/strict';
import {splitFrontRoadGroup,advanceRoadGroups,
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
