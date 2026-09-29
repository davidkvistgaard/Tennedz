import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {evaluateBreakAttack} from '../../lib/engine/v2/break-attack.mjs';

const route=buildKilometreRoute({distance_km:40,profile_points:[[0,100],[40,100]]},
  {seed:'break-split'});
const segment=route.kilometres[20];
const group={id:'road-1',riderIds:['a-0','a-1','b-0'],teamIds:['a','b'],gapSeconds:20};
function team(id,{attack=false,cooperate=true,energy=80,skill=60}={}){
  const riderIds=Array.from({length:8},(_,index)=>`${id}-${index}`);
  const orders=normalizeOrders({captainId:riderIds[0],roadCaptainId:riderIds[1],
    preset:'balanced',baseline:{attack:'none',breakWork:cooperate?'cooperate':'sit_on'},
    phases:attack?[{atKm:20,breakAttackRiderId:riderIds[0]}]:[]},
  {riderIds,distanceKm:40});
  return {id,orders,energy:Object.fromEntries(riderIds.map(riderId=>[riderId,energy])),
    attackLoad:Object.fromEntries(riderIds.map(riderId=>[riderId,0])),
    riders:riderIds.map(riderId=>({id:riderId,gender:'M',flat:skill,hills:skill,
      acceleration:skill,strength:skill,endurance:skill,sprint:skill}))};
}

test('a committed break attack costs energy and opponents decide whether to chase',()=>{
  const attacker=team('a',{attack:true,skill:90});
  const opponent=team('b',{cooperate:true,skill:60});
  const working=evaluateBreakAttack({group,teams:[attacker,opponent],teamId:'a',km:21,segment});
  const sitting=evaluateBreakAttack({group,teams:[attacker,team('b',{cooperate:false,skill:60})],
    teamId:'a',km:21,segment});
  assert.equal(working.status,'split');
  assert.ok(working.attackSeconds>0&&working.attackSeconds<sitting.attackSeconds);
  assert.deepEqual(working.defenderRiderIds,['b-0']);
  assert.deepEqual(sitting.defenderRiderIds,[]);
  assert.deepEqual(working.energyCosts.map(cost=>cost.riderId),['a-0','b-0']);
  assert.equal(evaluateBreakAttack({group,teams:[attacker,opponent],teamId:'a',km:22,
    segment:route.kilometres[21]}),null);
});

test('a teammate will not chase its own rider while a tired attacker cannot split',()=>{
  const attacker=team('a',{attack:true,skill:90});
  const teammateOnly={...group,riderIds:['a-0','a-1'],teamIds:['a']};
  const own=evaluateBreakAttack({group:teammateOnly,teams:[attacker],teamId:'a',km:21,segment});
  assert.deepEqual(own.defenderRiderIds,[]);
  const tired=team('a',{attack:true,energy:0,skill:90});
  assert.equal(evaluateBreakAttack({group,teams:[tired,team('b')],teamId:'a',km:21,
    segment}).status,'exhausted');
});

test('a defender with a teammate farther up the road sits on during another attack',()=>{
  const attacker=team('a',{attack:true,skill:90});
  const opponent=team('b',{cooperate:true,skill:60});
  const withoutTeammateAhead=evaluateBreakAttack({group,teams:[attacker,opponent],
    teamId:'a',km:21,segment});
  const withTeammateAhead=evaluateBreakAttack({group,teams:[attacker,opponent],
    teamId:'a',km:21,segment,teamIdsAhead:['b']});
  assert.deepEqual(withoutTeammateAhead.defenderRiderIds,['b-0']);
  assert.deepEqual(withTeammateAhead.defenderRiderIds,[]);
  assert.ok(withTeammateAhead.attackSeconds>withoutTeammateAhead.attackSeconds);
  assert.deepEqual(withTeammateAhead.energyCosts.map(cost=>cost.riderId),['a-0']);
});
