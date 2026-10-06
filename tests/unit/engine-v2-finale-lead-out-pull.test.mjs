import test from 'node:test';
import assert from 'node:assert/strict';
import {recordFinaleLeadOutPull,validateFinaleLeadOutPull} from
  '../../lib/engine/v2/finale-lead-out-pull.mjs';

const route={version:2,distanceKm:10,kilometres:Array.from({length:10},(_,index)=>({
  km:index+1,terrain:'flat',surface:'road',exposed:false,
  weather:{temperatureC:18,windKph:8,rainMm:0},
}))};
const riders=Array.from({length:8},(_,index)=>({id:`r-${index}`,
  flat:60,hills:60,mountain:60,cobbles:60,wind:60,endurance:60,
  strength:60,sprint:60,timetrial:60,positioning:index===1?85:55,
  acceleration:index===1?80:55}));
const team={riders,orders:{version:2,helperIds:['r-1','r-2']}};
const states=()=>riders.map(rider=>({riderId:rider.id,energy:80,
  roadGroupId:'peloton'}));
const input=(changes={})=>({route,team,finisherId:'r-0',
  nomineeId:'r-1',riderStates:states(),launchIntent:'standard',...changes});

test('a standard launch records finite work from 750 to 300 metres remaining',()=>{
  const plan=input();
  const recording=recordFinaleLeadOutPull(plan);
  assert.equal(recording.outcome,'completed');
  assert.equal(recording.workerRiderId,'r-1');
  assert.equal(recording.frames[0].startDistanceM,9250);
  assert.equal(recording.frames.at(-1).endDistanceM,9700);
  assert.deepEqual(recording.frames.map(frame=>frame.phase),
    ['approach','finish','finish']);
  assert.equal(recording.frames.at(-1).event,'pull_complete');
  assert.ok(recording.frames.every(frame=>frame.energySpent>0&&
    frame.workerEnergy>=0&&frame.roadGroupId==='peloton'));
  const spent=recording.frames.reduce((sum,frame)=>sum+frame.energySpent,0);
  assert.ok(Math.abs(80-spent-recording.frames.at(-1).workerEnergy)<1e-9);
  assert.equal(validateFinaleLeadOutPull(plan,recording),true);
  assert.equal(Object.hasOwn(recording,'finishBonusSeconds'),false);
});

test('early and late intents change paid distance, not a free finish position',()=>{
  const early=recordFinaleLeadOutPull(input({launchIntent:'early'}));
  const late=recordFinaleLeadOutPull(input({launchIntent:'late'}));
  assert.equal(early.frames[0].startDistanceM,9000);
  assert.equal(late.frames[0].startDistanceM,9500);
  assert.ok(early.frames.reduce((sum,frame)=>sum+frame.energySpent,0)>
    late.frames.reduce((sum,frame)=>sum+frame.energySpent,0));
  assert.equal(early.frames.at(-1).endDistanceM,late.frames.at(-1).endDistanceM);
});

test('an exhausted worker stops part-way and cannot spend more energy',()=>{
  const depleted=structuredClone(team);
  depleted.riders[1].endurance=0;
  const arrival=states();
  arrival[1].energy=20;
  const recording=recordFinaleLeadOutPull(input({team:depleted,
    riderStates:arrival,launchIntent:'early'}));
  assert.equal(recording.outcome,'exhausted');
  assert.equal(recording.frames.at(-1).event,'worker_exhausted');
  assert.ok(recording.frames.at(-1).endDistanceM<9700);
  assert.equal(recording.frames.at(-1).workerEnergy,0);
  assert.ok(Math.abs(recording.frames.reduce((sum,frame)=>sum+frame.energySpent,0)-20)<1e-9);
});

test('a separated nominee yields an explicit fallback or no pull',()=>{
  const separated=states();
  separated[1].roadGroupId='road-1';
  const fallback=recordFinaleLeadOutPull(input({riderStates:separated}));
  assert.equal(fallback.workerRiderId,'r-2');
  assert.equal(fallback.fallbackReason,'different_road_group');
  separated[2].roadGroupId='road-1';
  const unavailable=recordFinaleLeadOutPull(input({riderStates:separated}));
  assert.equal(unavailable.outcome,'unavailable');
  assert.deepEqual(unavailable.frames,[]);
});

test('the work trace rejects an unknown launch and tampering',()=>{
  assert.throws(()=>recordFinaleLeadOutPull(input({launchIntent:'teleport'})),
    /early, standard or late/);
  const plan=input();
  const changed=recordFinaleLeadOutPull(plan);
  changed.frames[0].energySpent=0;
  assert.throws(()=>validateFinaleLeadOutPull(plan,changed),/differs/);
});
