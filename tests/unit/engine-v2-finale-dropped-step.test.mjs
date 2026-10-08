import test from 'node:test';
import assert from 'node:assert/strict';
import {buildKilometreRoute} from '../../lib/engine/v2/route.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleDroppedStep,validateFinaleDroppedStep,
  FINALE_DROPPED_STEP_VERSION} from
  '../../lib/engine/v2/finale-dropped-step.mjs';

const route=buildKilometreRoute({distance_km:40,
  profile_points:[[0,100],[40,100]]},{seed:'dropped-step',
  weather:{temp_c:15,wind_kph:8,precipitation_mm:0}});
const slice=finaleDistanceGrid(route,{remainingKm:1})[0];
const segment=route.kilometres[slice.sourceKm-1];
const rider=(id,flat)=>({id,gender:'F',flat,strength:flat,
  timetrial:flat,endurance:70,sprint:flat,wind:50});
const ridersById=new Map([rider('slow',35),rider('fast',85)]
  .map(row=>[row.id,row]));
const input={slice,segment,bunchElapsedSeconds:22,
  droppedRiders:[{riderId:'slow',deficitSeconds:45,energy:30},
    {riderId:'fast',deficitSeconds:40,energy:25}],ridersById};

test('dropped riders independently pay and carry source time losses',()=>{
  const recorded=advanceFinaleDroppedStep(input);
  assert.equal(recorded.version,FINALE_DROPPED_STEP_VERSION);
  assert.equal(recorded.startDistanceM,39000);
  assert.equal(recorded.endDistanceM,39250);
  assert.deepEqual(recorded.riders.map(row=>row.riderId),
    ['slow','fast']);
  for(const row of recorded.riders){
    assert.ok(row.energySpent>0);
    assert.ok(Math.abs(row.energyBefore-row.energyAfter-
      row.energySpent)<1e-10);
    assert.ok(Math.abs(row.deficitSecondsAfter-
      (row.deficitSecondsBefore+row.elapsedSeconds-22))<1e-10);
    assert.ok(row.deficitSecondsAfter>0);
  }
  assert.notEqual(recorded.riders[0].elapsedSeconds,
    recorded.riders[1].elapsedSeconds);
  assert.equal(recorded.resultStatus,'unclassified');
  assert.equal(recorded.pointsStatus,'withheld');
  assert.equal(validateFinaleDroppedStep(input,
    structuredClone(recorded)),true);
  const forged=structuredClone(recorded);
  forged.riders[0].energySpent=0;
  assert.throws(()=>validateFinaleDroppedStep(input,forged),
    /differs from its source/);
});

test('a dropped rider cannot coast for free or silently rejoin the bunch',()=>{
  assert.throws(()=>advanceFinaleDroppedStep({...input,
    droppedRiders:[{...input.droppedRiders[0],energy:0}]}),
  /cannot pay for travel/);
  assert.throws(()=>advanceFinaleDroppedStep({...input,
    bunchElapsedSeconds:100,droppedRiders:[input.droppedRiders[0]]}),
  /needs recorded bunch contact/);
  assert.throws(()=>advanceFinaleDroppedStep({...input,
    droppedRiders:[input.droppedRiders[0],input.droppedRiders[0]]}),
  /complete source riders/);
});
