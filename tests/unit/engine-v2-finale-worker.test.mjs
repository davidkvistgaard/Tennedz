import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {buildFinaleWorkerPlan} from '../../lib/engine/v2/finale-worker.mjs';
import {simulateFinalePair,validateFinalePair} from
  '../../lib/engine/v2/finale-pair.mjs';

const route=buildKilometreRoute({distance_km:40,
  profile_points:[[0,100],[40,100]]},{seed:'worker'});
const riders=Array.from({length:8},(_,index)=>({id:`r${index}`,
  flat:index===0?90:50,timetrial:index===0?90:50,
  endurance:index===0?90:50,strength:index===0?90:50,
  form:50,fatigue:0}));
const team=(baseline={})=>({riders,orders:normalizeOrders({captainId:'r0',
  baseline},{riderIds:riders.map(rider=>rider.id),distanceKm:40})});
const plan=(options={})=>buildFinaleWorkerPlan({route,team:team(),riderId:'r0',
  energy:30,role:'front',...options});

test('a locked rider, road profile, energy and effort determine the entire pace plan',()=>{
  const strong=plan();
  assert.deepEqual(strong,plan());
  assert.equal(strong.steps.length,11);
  const weaker=plan({riderId:'r1'});
  assert.ok(strong.steps[0].speedKph>weaker.steps[0].speedKph);
  const tired=plan({energy:10});
  assert.ok(strong.steps[0].speedKph>tired.steps[0].speedKph);
  const fatigued={...team(),riders:riders.map(rider=>
    rider.id==='r0'?{...rider,fatigue:70}:rider)};
  assert.ok(strong.steps[0].speedKph>
    plan({team:fatigued}).steps[0].speedKph);
  const hard=plan({team:team({effort:'hard'})});
  assert.ok(hard.steps[0].speedKph>strong.steps[0].speedKph);
  assert.ok(hard.steps[0].workCostPerKm>strong.steps[0].workCostPerKm);
  const uphill=buildKilometreRoute({distance_km:40,
    profile_points:[[0,100],[35,100],[40,350]]},{seed:'worker'});
  assert.ok(strong.steps[0].speedKph>
    plan({route:uphill}).steps[0].speedKph);
});

test('the plan follows precommitted phase orders at the source kilometre',()=>{
  const ordered={riders,orders:normalizeOrders({captainId:'r0',
    baseline:{effort:'conserve'},phases:[{atKm:36,effort:'hard'}]},
  {riderIds:riders.map(rider=>rider.id),distanceKm:40,
    keypoints:[{km:36}]})};
  const phased=plan({team:ordered});
  assert.ok(phased.steps[0].speedKph<phased.steps[1].speedKph);
  assert.ok(phased.steps[0].workCostPerKm<phased.steps[1].workCostPerKm);
});

test('a rider outside the lineup, forbidden chase and unaffordable work fail closed',()=>{
  assert.throws(()=>plan({riderId:'visitor'}),/locked lineup/);
  assert.throws(()=>plan({energy:.01}),/cannot sustain/);
  assert.throws(()=>plan({role:'chase'}),/nominated helper/);
  assert.throws(()=>plan({role:'chase',riderId:'r1',
    team:team({chase:'ignore'})}),/does not permit/);
});

test('player-linked plans feed a replayable pair without changing the official result',()=>{
  const input={route,initialGapSeconds:10,
    front:plan(),rear:plan({riderId:'r1',role:'chase'})};
  const recording=simulateFinalePair(input);
  assert.equal(recording.frontRiderId,'r0');
  assert.equal(recording.rearRiderId,'r1');
  assert.equal(validateFinalePair(input,recording),true);
  assert.ok(recording.frames.length>0);
  assert.ok(recording.frames.every(frame=>frame.frontEnergy>=0&&frame.rearEnergy>=0));
});
