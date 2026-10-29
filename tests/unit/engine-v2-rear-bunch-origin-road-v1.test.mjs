import test from 'node:test';
import assert from 'node:assert/strict';
import {runRearBunchOriginRoadV1,
  validateRearBunchOriginRoadV1} from
  '../../lib/engine/v2/rear-bunch-origin-road-v1.mjs';

const rider={id:'r',mountain:20,flat:90,hills:70,timetrial:70,
  endurance:70,strength:70,form:50,fatigue:30};
const routeKilometres=[1,2,3].map(km=>({km,
  terrain:km===3?'climb':'flat',surface:'road',
  gradientPct:km===3?8:0,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const bunchTurnPlans=[50,50,100].map((ability,index)=>({
  status:'worked',leaderAbility:ability,
  turns:[{startM:0,endM:1000,ability,
    leaderRiderId:index===1?'r':'leader'}]}));
const orders={baseline:{effort:'conserve'},phases:[]};
const choices=[1,2,3].map(km=>({riderId:'r',km,
  effort:'conserve',action:'hold_wheel',reason:'follow_order'}));
const input={rider,orders,routeKilometres,bunchTurnPlans,choices,
  stageNumber:1,stageCount:3};

test('physical bunch origin pays wheels before a climb pace split',()=>{
  const road=runRearBunchOriginRoadV1(input);
  assert.equal(road.status,'wheel_lost');
  assert.equal(road.steps.length,3);
  assert.equal(road.steps[2].split.kind,'physical_pace_loss');
  assert.equal(road.steps[2].split.atDistanceM,2000);
  assert.deepEqual(road.steps.slice(0,2).map(step=>
    step.slices[0].role),['sheltered','leader']);
  assert.ok(road.steps[0].slices[0].energySpent>0);
  assert.ok(road.steps[1].slices[0].energySpent>0);
  assert.equal(road.steps[2].energyAfter,road.steps[1].energyAfter);
  assert.equal(validateRearBunchOriginRoadV1(input,road),true);
  const forged=structuredClone(road);
  forged.steps[1].slices[0].energySpent=0;
  assert.throws(()=>validateRearBunchOriginRoadV1(input,forged),
    /differs/);
  assert.throws(()=>runRearBunchOriginRoadV1({...input,
    choices:[choices[0],{...choices[1],effort:'hard'},choices[2]]}),
  /explicit ordered decision/);
});

test('deliberate release needs an explicit future-stage commitment',()=>{
  const release=[choices[0],{...choices[1],
    action:'release_wheel',
    reason:'committed_future_stage_reserve'},choices[2]];
  assert.throws(()=>runRearBunchOriginRoadV1({...input,
    choices:release}),/explicit ordered decision/);
  const committedStagePlan={riderId:'r',currentStageNumber:1,
    targetStageNumber:2,currentGoal:'finish_safely',
    futureGoal:'target_stage',reserveEnergy:50};
  const road=runRearBunchOriginRoadV1({...input,
    choices:release,committedStagePlan});
  assert.equal(road.status,'wheel_released');
  assert.equal(road.steps.length,2);
  assert.equal(road.steps[1].split.atDistanceM,1000);
  assert.equal(road.steps[1].slices.length,0);
  assert.equal(road.energyAfter,road.steps[0].energyAfter);
});
