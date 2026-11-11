import test from 'node:test';
import assert from 'node:assert/strict';
import {planChaseTurnsV1} from
  '../../lib/engine/v2/chase-turns-v1.mjs';
import {planPelotonFrontTurnsV1} from
  '../../lib/engine/v2/peloton-front-turns-v1.mjs';
import {riderKilometreEffect} from
  '../../lib/engine/v2/physiology.mjs';
import {TUNING} from '../../lib/engine/v2/tuning.mjs';

const segment={km:1,terrain:'flat',surface:'road',exposed:false,
  weather:{rainMm:0,windKph:0,temperatureC:18}};
const rider=(id,flat)=>({id,flat,sprint:flat,hills:flat,mountain:flat,
  cobbles:flat,timetrial:flat,endurance:flat,strength:flat,wind:flat,
  form:50,fatigue:0});
const teams=[{id:'chase',riders:[rider('c-1',80)],
  energy:{'c-1':60}},
{id:'front',riders:[rider('f-1',75),rider('f-2',70)],
  energy:{'f-1':70,'f-2':70}}];
const cruise=(id)=>riderKilometreEffect(teams[1].riders.find(row=>
  row.id===id),segment,{phase:'cruise',energy:70,exposed:false}).ability;
const paidPace={teamId:'front',effort:'steady',riderIds:['f-1','f-2'],
  ability:(cruise('f-1')+cruise('f-2'))/2+
    TUNING.groups.frontPaceAdjustmentPoints.steady};
const chaseTurnPlan=planChaseTurnsV1({km:1,candidates:[{
  teamId:'chase',riderId:'c-1',capacity:20,costPerKm:.6,energy:60}]});

test('chase and committed front workers share one paid leader position',()=>{
  const plan=planPelotonFrontTurnsV1({chaseTurnPlan,paidPace,teams,
    segment,km:1});
  assert.equal(plan.status,'worked');
  assert.equal(plan.turns.length,3);
  assert.deepEqual(plan.turns.map(row=>row.workKind),
    ['chase','front','front']);
  assert.deepEqual(plan.turns.map(row=>[row.startM,row.endM]),
    [[0,334],[334,667],[667,1000]]);
  assert.equal(plan.extraEnergyCosts.reduce((sum,row)=>
    sum+row.leadingM,0),1000);
  assert.ok(Math.abs(plan.chasePower-20*.334)<1e-8);
  assert.equal(plan.leaderAbility,+(plan.turns.reduce((sum,row)=>
    sum+row.ability*(row.endM-row.startM),0)/1000).toFixed(3));
});

test('changed source energy refuses the whole group clock',()=>{
  const weak=[{...teams[0],energy:{'c-1':.1}},teams[1]];
  assert.throws(()=>planPelotonFrontTurnsV1({chaseTurnPlan,
    paidPace,teams:weak,segment,km:1}),/committed source/);
});

test('no committed road work grants no paid front pace',()=>{
  const empty=planChaseTurnsV1({km:1,candidates:[]});
  assert.deepEqual(planPelotonFrontTurnsV1({chaseTurnPlan:empty,
    paidPace:null,teams,segment,km:1}),{
    version:'v2-peloton-front-turns-1',status:'no_front',turns:[],
    extraEnergyCosts:[],leaderAbility:null,chasePower:0});
});
