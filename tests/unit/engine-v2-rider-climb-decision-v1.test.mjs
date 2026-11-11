import test from 'node:test';
import assert from 'node:assert/strict';
import {decideRiderClimbV1,validateRiderClimbDecisionV1} from
  '../../lib/engine/v2/rider-climb-decision-v1.mjs';

const source={riderId:'you-8',stageNumber:18,stageCount:21,
  terrain:'climb',energy:40,projectedHoldCost:15,
  committedStagePlan:{riderId:'you-8',currentStageNumber:18,
    targetStageNumber:19,currentGoal:'finish_safely',
    futureGoal:'target_stage',reserveEnergy:30}};

test('voluntary climb release requires a committed future-stage reserve',()=>{
  const decision=decideRiderClimbV1(source);
  assert.equal(decision.choice,'release');
  assert.equal(validateRiderClimbDecisionV1(source,decision),true);
  assert.equal(decideRiderClimbV1({...source,
    committedStagePlan:null}).choice,'hold');
  assert.equal(decideRiderClimbV1({...source,
    teamOrder:'hold_position'}).choice,'hold');
});

test('physical inability is distinct and an order cannot overcome it',()=>{
  const input={...source,projectedHoldCost:41,teamOrder:'hold_position'};
  const decision=decideRiderClimbV1(input);
  assert.equal(decision.choice,'cannot_hold');
  assert.equal(decision.reason,'insufficient_energy_for_climb');
  const forged={...decision,reason:'committed_future_stage_reserve'};
  assert.throws(()=>validateRiderClimbDecisionV1(input,forged),/differs/);
});

test('a future-stage motive without a real future-stage target refuses',()=>{
  assert.throws(()=>decideRiderClimbV1({...source,
    committedStagePlan:{...source.committedStagePlan,
      targetStageNumber:18}}),/Invalid/);
});
