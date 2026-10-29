import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearPaceClimbSplitV1,
  validateRearPaceClimbSplitV1} from
  '../../lib/engine/v2/rear-pace-climb-split-v1.mjs';
import {advanceRearPaceClimbSplitV2,
  validateRearPaceClimbSplitV2} from
  '../../lib/engine/v2/rear-pace-climb-split-v2.mjs';

const rider={id:'climber',mountain:65,flat:65,hills:65,
  sprint:50,cobbles:50,timetrial:35,endurance:70,
  strength:65,wind:50,form:50,fatigue:0};
const segment={km:12,terrain:'climb',surface:'road',
  gradientPct:6,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const turnPlan={status:'worked',leaderAbility:67.5,
  turns:[{startM:0,endM:500,ability:45},
    {startM:500,endM:1000,ability:90}]};

test('a stronger paid bunch turn makes an attempted climber lose the wheel',()=>{
  const input={rider,segment,energy:40,bunchTurnPlan:turnPlan,
    stageNumber:18,stageCount:21,
    soloEffort:'conserve',soloReason:'finish_safely'};
  const result=advanceRearPaceClimbSplitV1(input);
  assert.equal(result.decision.choice,'hold');
  assert.equal(result.splitDistanceM,11500);
  assert.equal(result.soloSlices.length,1);
  assert.ok(result.holdEnergySpent>0);
  assert.ok(result.soloSlices[0].energySpent>0);
  assert.ok(result.behindBunchSeconds>0);
  assert.equal(validateRearPaceClimbSplitV1(input,result),true);
  const forged=structuredClone(result);
  forged.soloSlices[0].energySpent=0;
  assert.throws(()=>validateRearPaceClimbSplitV1(input,forged),
    /differs/);
});

test('matchable, unpaid and future-stage release paths refuse',()=>{
  const input={rider,segment,energy:40,bunchTurnPlan:turnPlan,
    stageNumber:18,stageCount:21,
    soloEffort:'conserve',soloReason:'finish_safely'};
  assert.throws(()=>advanceRearPaceClimbSplitV1({...input,
    bunchTurnPlan:{status:'worked',leaderAbility:45,
      turns:[{startM:0,endM:1000,ability:45}]}}),
  /match every/);
  assert.throws(()=>advanceRearPaceClimbSplitV1({...input,
    energy:.1}),/hard hold attempt/);
  assert.throws(()=>advanceRearPaceClimbSplitV1({...input,
    energy:.3,committedStagePlan:{riderId:rider.id,
      currentStageNumber:18,targetStageNumber:19,
      currentGoal:'finish_safely',futureGoal:'target_stage',
      reserveEnergy:.2}}),/hard hold attempt/);
  assert.throws(()=>advanceRearPaceClimbSplitV1({...input,
    soloEffort:'hard',energy:.26}),/chosen solo work/);
});

test('first-turn loss pays terrain work across every subsequent bunch turn',()=>{
  const paidTurns={status:'worked',leaderAbility:90,
    turns:[{startM:0,endM:500,ability:90},
      {startM:500,endM:1000,ability:90}]};
  const routeKilometres=Array.from({length:12},(_,index)=>({
    ...segment,km:index+1}));
  for(const fatigue of [0,30]){
    const input={rider:{...rider,fatigue},segment,energy:40,
      bunchTurnPlan:paidTurns,routeKilometres,
      stageNumber:18,stageCount:21,
      soloEffort:'conserve',soloReason:'finish_safely'};
    const old=advanceRearPaceClimbSplitV1(input);
    const result=advanceRearPaceClimbSplitV2(input);
    assert.equal(result.splitDistanceM,11000);
    assert.equal(result.soloSlices.length,2);
    assert.ok(result.soloSlices.every(row=>row.energySpent>0&&
      row.behindBunchSeconds>0));
    assert.ok(result.energyAfter<old.energyAfter);
    assert.equal(result.soloSlices[1].energyBefore,
      result.soloSlices[0].energyAfter);
    assert.equal(validateRearPaceClimbSplitV2(input,result),true);
    const forged=structuredClone(result);
    forged.soloSlices[1].energySpent=0;
    assert.throws(()=>validateRearPaceClimbSplitV2(input,forged),
      /differs/);
  }
  const broken=routeKilometres.map(row=>({...row}));
  broken[11].gradientPct=0;
  assert.throws(()=>advanceRearPaceClimbSplitV2({
    rider,segment,energy:40,bunchTurnPlan:paidTurns,
    routeKilometres:broken,stageNumber:18,stageCount:21,
    soloEffort:'conserve',soloReason:'finish_safely'}),
  /route-bound/);
});
