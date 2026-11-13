import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearUnpayableClimbV1,
  validateRearUnpayableClimbV1} from
  '../../lib/engine/v2/rear-unpayable-climb-v1.mjs';

const rider={id:'climber',mountain:65,flat:65,hills:65,
  sprint:50,cobbles:50,timetrial:35,endurance:70,
  strength:65,wind:50,form:50,fatigue:0};
const segment={km:12,terrain:'climb',surface:'road',
  gradientPct:6,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const plan=ability=>({status:'worked',leaderAbility:ability,
  turns:[{startM:0,endM:1000,ability}]});

test('a rider loses the paid bunch wheel when a hard climb is unaffordable',()=>{
  const input={rider,segment,energy:.16,bunchTurnPlan:plan(45),
    stageNumber:18,stageCount:21};
  const result=advanceRearUnpayableClimbV1(input);
  assert.equal(result.decision.choice,'cannot_hold');
  assert.equal(result.detachmentCause,'insufficient_hold_energy');
  assert.ok(result.splitDistanceM>11000&&
    result.splitDistanceM<12000);
  assert.equal(result.endDistanceM,12000);
  assert.ok(result.holdEnergySpent>0);
  assert.ok(result.soloSlices.every(row=>
    row.energySpent>0&&row.energy>=0));
  assert.ok(result.behindBunchSeconds>0);
  assert.equal(validateRearUnpayableClimbV1(input,result),true);
  const forged=structuredClone(result);
  forged.soloSlices[0].energySpent=0;
  assert.throws(()=>validateRearUnpayableClimbV1(input,
    forged),/differs/);
});

test('a faster bunch turn can cause an earlier physical split',()=>{
  const input={rider,segment,energy:.22,
    bunchTurnPlan:{status:'worked',leaderAbility:67.5,
      turns:[{startM:0,endM:500,ability:45},
        {startM:500,endM:1000,ability:90}]},
  stageNumber:18,stageCount:21};
  const result=advanceRearUnpayableClimbV1(input);
  assert.equal(result.detachmentCause,
    'cannot_match_bunch_turn');
  assert.equal(result.splitDistanceM,11500);
  assert.ok(result.energyAfter>=0);
  assert.throws(()=>advanceRearUnpayableClimbV1({...input,
    energy:.01}),/payable solo road/);
  assert.throws(()=>advanceRearUnpayableClimbV1({...input,
    energy:.4}),/failed hold/);
  assert.throws(()=>advanceRearUnpayableClimbV1({...input,
    energy:.3,committedStagePlan:{riderId:rider.id,
      currentStageNumber:18,targetStageNumber:19,
      currentGoal:'finish_safely',futureGoal:'target_stage',
      reserveEnergy:.2}}),/failed hold/);
});
