import test from 'node:test';
import assert from 'node:assert/strict';
import {selectFinaleLeadOut,FINALE_LEAD_OUT_VERSION} from
  '../../lib/engine/v2/finale-lead-out.mjs';

const segment={terrain:'flat',surface:'road',exposed:false,
  weather:{temperatureC:18,windKph:8,rainMm:0}};
const riders=Array.from({length:8},(_,index)=>({id:`r-${index}`,
  flat:60,hills:60,mountain:60,cobbles:60,wind:60,endurance:60,
  strength:60,sprint:60,timetrial:60,
  positioning:index===1?95:55,acceleration:index===1?90:55}));
const team={riders,orders:{version:2,helperIds:['r-1','r-2']}};
const states=()=>riders.map(rider=>({riderId:rider.id,energy:80,
  roadGroupId:'peloton'}));
const choose=(changes={})=>selectFinaleLeadOut({team,finisherId:'r-0',
  riderStates:states(),segment,...changes});

test('a prepared specialist is selected without adding a finish bonus',()=>{
  const plan=choose();
  assert.equal(plan.version,FINALE_LEAD_OUT_VERSION);
  assert.equal(plan.status,'ready');
  assert.equal(plan.selectedRiderId,'r-1');
  assert.ok(plan.selectedScore>0&&plan.selectedWorkCostPerKm>0);
  assert.equal(Object.hasOwn(plan,'finishSeconds'),false);
});

test('a nominated rider in another group or exhausted uses an explicit fallback',()=>{
  const separated=states();
  separated[1].roadGroupId='road-1';
  const groupFallback=choose({nomineeId:'r-1',riderStates:separated});
  assert.equal(groupFallback.selectedRiderId,'r-2');
  assert.equal(groupFallback.fallbackReason,'different_road_group');
  separated[1].roadGroupId='peloton';
  separated[1].energy=19;
  const tiredFallback=choose({nomineeId:'r-1',riderStates:separated});
  assert.equal(tiredFallback.selectedRiderId,'r-2');
  assert.equal(tiredFallback.fallbackReason,'exhausted');
  separated[2].energy=19;
  assert.equal(choose({nomineeId:'r-1',riderStates:separated}).status,'unavailable');
});

test('a named, eligible non-helper can lead out, but cannot be the finisher',()=>{
  assert.equal(choose({nomineeId:'r-3'}).selectedRiderId,'r-3');
  assert.throws(()=>choose({nomineeId:'r-0'}),/distinct locked riders/);
  assert.throws(()=>choose({nomineeId:'outsider'}),/distinct locked riders/);
});

test('role quality combines placement, acceleration and endurance instead of sprint alone',()=>{
  const specialists=structuredClone(team);
  Object.assign(specialists.riders[1],{sprint:100,positioning:30,
    acceleration:40,endurance:35});
  Object.assign(specialists.riders[2],{sprint:45,positioning:80,
    acceleration:75,endurance:80});
  const fresh=choose({team:specialists});
  assert.equal(fresh.selectedRiderId,'r-2');
  const tired=states();
  tired[2].energy=21;
  assert.ok(choose({team:specialists,riderStates:tired,
    nomineeId:'r-2'}).selectedScore<fresh.selectedScore);
});

test('road-group eligibility and finite energy stay tied to the locked lineup',()=>{
  const dropped=states();
  dropped[0].roadGroupId='dropped';
  assert.equal(choose({riderStates:dropped}).status,'unavailable');
  const duplicated=states();
  duplicated[2].riderId='r-1';
  assert.throws(()=>choose({riderStates:duplicated}),/complete locked lineup/);
  const invalidEnergy=states();
  invalidEnergy[1].energy=101;
  assert.throws(()=>choose({riderStates:invalidEnergy}),/complete locked lineup/);
});
