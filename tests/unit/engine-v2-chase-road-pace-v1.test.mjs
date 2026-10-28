import test from 'node:test';
import assert from 'node:assert/strict';
import {planChaseTurnsV1} from
  '../../lib/engine/v2/chase-turns-v1.mjs';
import {planChaseRoadPaceV1} from
  '../../lib/engine/v2/chase-road-pace-v1.mjs';

const segment={terrain:'flat',surface:'road',exposed:false,
  weather:{rainMm:0,windKph:0,temperatureC:18}};
const rider=(id,flat)=>({id,flat,sprint:flat,hills:flat,mountain:flat,
  cobbles:flat,timetrial:flat,endurance:flat,strength:flat,wind:flat,
  form:50,fatigue:0});
const teams=[{id:'a',riders:[rider('a-1',80)],energy:{'a-1':50}},
  {id:'b',riders:[rider('b-1',60)],energy:{'b-1':70}}];
const turnPlan=planChaseTurnsV1({km:1,candidates:[
  {teamId:'a',riderId:'a-1',capacity:20,costPerKm:.5,energy:50},
  {teamId:'b',riderId:'b-1',capacity:10,costPerKm:.5,energy:70},
]});

test('named chase leaders set only their own exposed road ability',()=>{
  const plan=planChaseRoadPaceV1({turnPlan,teams,segment});
  assert.equal(plan.status,'worked');
  assert.equal(plan.turns.length,2);
  assert.equal(plan.turns[0].endM,plan.turns[1].startM);
  assert.equal(plan.turns[1].endM,1000);
  assert.equal(plan.leaderAbility,
    +(plan.turns[0].ability*.5+plan.turns[1].ability*.5).toFixed(3));
  assert.ok(plan.turns[0].ability>plan.turns[1].ability);
});

test('committed source energy and rider identity are required',()=>{
  assert.throws(()=>planChaseRoadPaceV1({turnPlan,
    teams:[{...teams[0],energy:{'a-1':49}},teams[1]],segment}),
  /committed source/);
  assert.throws(()=>planChaseRoadPaceV1({turnPlan,
    teams:[{...teams[0],riders:[]},teams[1]],segment}),
  /committed source/);
});

test('no paid leader supplies no road pace',()=>{
  const empty=planChaseTurnsV1({km:1,candidates:[]});
  assert.deepEqual(planChaseRoadPaceV1({turnPlan:empty,teams,segment}),{
    version:'v2-chase-road-pace-1',status:'no_chase',turns:[],
    leaderAbility:null});
});
