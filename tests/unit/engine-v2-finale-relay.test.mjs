import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {normalizeOrders} from '../../lib/engine/v2/orders.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {simulateFinaleRelay,validateFinaleRelay} from
  '../../lib/engine/v2/finale-relay.mjs';

const route=buildKilometreRoute({distance_km:40,
  profile_points:[[0,100],[40,100]]},{seed:'relay'});
function team(id,skill,effort='steady',chase='selective'){
  const riders=Array.from({length:8},(_,index)=>({id:`${id}-${index}`,
    flat:skill,hills:skill,mountain:skill,timetrial:skill,
    strength:skill,endurance:skill,form:50,fatigue:0}));
  return {id,riders,orders:normalizeOrders({captainId:riders[0].id,
    baseline:{effort,chase}},{riderIds:riders.map(rider=>rider.id),distanceKm:40})};
}
const rotation=finaleDistanceGrid(route).map((_,index)=>
  index%2?'c-2':'b-2');
const input={route,initialGapSeconds:10,
  front:{team:team('a',75),riderId:'a-0',energy:35},
  chasers:[
    {team:team('b',65),riderId:'b-2',energy:35},
    {team:team('c',75),riderId:'c-2',energy:35},
  ],rotation};

test('a locked rotation records each pull and charges sheltered helpers too',()=>{
  const recording=simulateFinaleRelay(input);
  assert.equal(recording.frames.length,11);
  assert.deepEqual(recording.frames.map(frame=>frame.pullRiderId),rotation);
  assert.ok(recording.frames.every(frame=>frame.chaseWorkers.length===2&&
    frame.chaseWorkers.filter(worker=>worker.pulling).length===1&&
    frame.chaseWorkers.every(worker=>worker.energySpent>0)));
  const first=recording.frames[0];
  assert.ok(first.chaseWorkers[0].energySpent>first.chaseWorkers[1].energySpent);
  assert.ok(recording.frames.every((frame,index)=>index===0||
    frame.frontElapsedSeconds>recording.frames[index-1].frontElapsedSeconds&&
    frame.chaseElapsedSeconds>recording.frames[index-1].chaseElapsedSeconds));
  assert.equal(validateFinaleRelay(input,recording),true);
  const forged=structuredClone(recording);
  forged.frames[1].pullRiderId='b-2';
  assert.throws(()=>validateFinaleRelay(input,forged),/differs/);
});

test('the committed pull schedule changes the gap and who spends energy',()=>{
  const weak=simulateFinaleRelay({...input,rotation:rotation.map(()=>'b-2')});
  const strong=simulateFinaleRelay({...input,rotation:rotation.map(()=>'c-2')});
  assert.ok(strong.finishGapSeconds<weak.finishGapSeconds);
  assert.ok(weak.frames.at(-1).chaseWorkers[0].energy<
    strong.frames.at(-1).chaseWorkers[0].energy);
  assert.ok(strong.frames.at(-1).chaseWorkers[1].energy<
    weak.frames.at(-1).chaseWorkers[1].energy);
});

test('a catch ends the relay within the actual slice and charges only ridden work',()=>{
  const fast={...input,initialGapSeconds:3,
    chasers:[{...input.chasers[0],team:team('b',95,'hard','all')},
      {...input.chasers[1],team:team('c',95,'hard','all')}]};
  const recording=simulateFinaleRelay(fast);
  assert.equal(recording.outcome,'caught');
  assert.ok(recording.frames.length<11);
  const last=recording.frames.at(-1);
  assert.equal(last.event,'catch');
  assert.equal(last.gapSeconds,0);
  assert.ok(Math.abs(last.frontElapsedSeconds-last.chaseElapsedSeconds)<1e-9);
  assert.ok(last.endDistanceM<finaleDistanceGrid(route)[recording.frames.length-1].endDistanceM);
  assert.equal(validateFinaleRelay(fast,recording),true);
});

test('foreign workers, forbidden chase and exhausted helpers fail closed',()=>{
  assert.throws(()=>simulateFinaleRelay({...input,rotation:rotation.slice(1)}),
    /full rotation/);
  assert.throws(()=>simulateFinaleRelay({...input,rotation:['foreign',...rotation.slice(1)]}),
    /two distinct helpers/);
  assert.throws(()=>simulateFinaleRelay({...input,chasers:[input.chasers[0],
    {...input.chasers[1],riderId:'c-0'}]}),/nominated helper/);
  assert.throws(()=>simulateFinaleRelay({...input,chasers:[
    {...input.chasers[0],team:team('b',65,'steady','ignore')},input.chasers[1]]}),
  /does not permit/);
  assert.throws(()=>simulateFinaleRelay({...input,chasers:[
    {...input.chasers[0],energy:.01},input.chasers[1]]}),
  /cannot spend energy/);
});
