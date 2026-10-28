import test from 'node:test';
import assert from 'node:assert/strict';
import {explainRoadGroupParticipation} from
  '../../lib/engine/v2/road-group-participation.mjs';
import {decideRoadGroupWork,selectRoadGroupWork} from
  '../../lib/engine/v2/road-groups.mjs';

function team(id,count,breakWork='cooperate',reserve=100){
  const riders=Array.from({length:count},(_,index)=>({id:`${id}-${index}`}));
  return {id,riders,energy:Object.fromEntries(riders.map(rider=>
    [rider.id,reserve])),orders:{baseline:{breakWork},phases:[]}};
}

test('separate groups preserve teammate-ahead, sitter and reciprocal motives',()=>{
  const teams=[team('a',2),team('b',1,'sit_on'),team('c',1),
    team('d',1,'drive'),team('e',1,'cooperate',0)];
  const groups=[
    {id:'road-1',riderIds:['a-0'],teamIds:['a'],gapSeconds:20},
    {id:'road-2',riderIds:['a-1','b-0','c-0','d-0','e-0'],
      teamIds:['a','b','c','d','e'],gapSeconds:10},
  ];
  const result=explainRoadGroupParticipation(groups,teams,1);
  const reasons=Object.fromEntries(result.groups.flatMap(group=>
    group.riders.map(row=>[row.riderId,row.reason])));
  assert.deepEqual(reasons,{'a-0':'selected_pull',
    'a-1':'teammate_further_ahead','b-0':'ordered_sit_on',
    'c-0':'reciprocal_hold','d-0':'selected_pull',
    'e-0':'insufficient_energy'});
  assert.deepEqual(result.pullRiderIds,['a-0','d-0']);
  assert.equal(result.groups[0].pullerCount,1);
  assert.equal(result.groups[1].pullerCount,1);
  const governing=decideRoadGroupWork(groups,teams,1);
  assert.deepEqual(governing.riderDecisions.map(row=>row.riderId),
    groups.flatMap(group=>group.riderIds));
  assert.deepEqual(governing.riderDecisions.filter(row=>row.choice==='pull')
    .map(row=>row.riderId),selectRoadGroupWork(groups,teams,1).pullRiderIds);
});

test('a recorded GC hold withdraws only that team from the pull roster',()=>{
  const teams=[team('a',1),team('b',1)];
  const groups=[{id:'road-1',riderIds:['a-0','b-0'],
    teamIds:['a','b'],gapSeconds:10}];
  const shared=explainRoadGroupParticipation(groups,teams,1);
  assert.equal(shared.groups[0].pullerCount,2);
  const held=explainRoadGroupParticipation(groups,teams,1,
    {holdTeamIds:['b']});
  assert.deepEqual(held.pullRiderIds,['a-0']);
  assert.equal(held.groups[0].riders[1].reason,
    'held_by_committed_response');
});
