import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearDetachmentV1,validateRearDetachmentV1} from
  '../../lib/engine/v2/rear-detachment-v1.mjs';

const rider={id:'you-8',mountain:38,flat:60,hills:48,
  timetrial:50,endurance:65,strength:58,form:50,fatigue:0};
const segment={km:12,startM:120,endM:190,
  terrain:'climb',surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const paidPlan=ability=>({status:'worked',leaderAbility:ability,
  turns:[{startM:0,endM:1000,ability}]});
const source={rider,segment,energy:40,bunchTurnPlan:paidPlan(72),
  stageNumber:18,stageCount:21};
const plan={riderId:'you-8',currentStageNumber:18,
  targetStageNumber:19,currentGoal:'finish_safely',
  futureGoal:'target_stage',reserveEnergy:39.9};

test('a rider can try and be physically distanced on a climb',()=>{
  const entry=advanceRearDetachmentV1(source);
  assert.equal(entry.decision.choice,'hold');
  assert.equal(entry.decision.reason,'can_hold_current_group');
  assert.equal(entry.status,'solo_behind');
  assert.equal(entry.startDistanceM,11000);
  assert.equal(entry.endDistanceM,12000);
  assert.ok(entry.behindBunchSeconds>0);
  assert.ok(entry.energySpent>0);
  assert.equal(validateRearDetachmentV1(source,entry),true);
  assert.throws(()=>validateRearDetachmentV1(source,{...entry,
    behindBunchSeconds:0}),/differs/);
});

test('saving energy for a later stage requires a committed target',()=>{
  const release=advanceRearDetachmentV1({...source,
    committedStagePlan:plan});
  const hold=advanceRearDetachmentV1(source);
  assert.equal(release.decision.choice,'release');
  assert.equal(release.decision.reason,'committed_future_stage_reserve');
  assert.ok(release.energySpent<hold.energySpent);
  assert.ok(release.behindBunchSeconds>=hold.behindBunchSeconds);
  assert.equal(advanceRearDetachmentV1({...source,
    committedStagePlan:plan,teamOrder:'hold_position'}).decision.choice,'hold');
  assert.throws(()=>advanceRearDetachmentV1({...source,
    committedStagePlan:{...plan,targetStageNumber:18}}),/Invalid/);
});

test('an unaffordable hold refuses before claiming a rear position',()=>{
  assert.throws(()=>advanceRearDetachmentV1({...source,energy:0}),
    /within-kilometre coast clock/);
  const strong=advanceRearDetachmentV1({...source,
    rider:{...rider,mountain:95},bunchTurnPlan:paidPlan(40)});
  assert.equal(strong.status,'bunch_contact');
  assert.equal(strong.behindBunchSeconds,0);
  const smallGap=advanceRearDetachmentV1({...source,
    bunchTurnPlan:paidPlan(52)});
  assert.equal(smallGap.status,'wheel_gap_unresolved');
  assert.ok(smallGap.behindBunchSeconds>0);
  assert.throws(()=>advanceRearDetachmentV1({...source,
    bunchTurnPlan:{...source.bunchTurnPlan,leaderAbility:80}}),
  /differs from paid turns/);
});
