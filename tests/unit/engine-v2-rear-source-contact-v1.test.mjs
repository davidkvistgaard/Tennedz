import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearSourceContactV1,validateRearSourceContactV1} from
  '../../lib/engine/v2/rear-source-contact-v1.mjs';
import {advanceRearDetachmentV1} from
  '../../lib/engine/v2/rear-detachment-v1.mjs';
import {continueRearContactV1} from
  '../../lib/engine/v2/rear-contact-continuation-v1.mjs';
import {continueRearSourceGroupV1,validateRearSourceGroupV1} from
  '../../lib/engine/v2/rear-source-group-v1.mjs';

const segment={km:13,terrain:'climb',surface:'road',gradientPct:6,
  exposed:false,weather:{temperatureC:16,windKph:0,rainMm:0}};
const bunchTurnPlan={status:'worked',leaderAbility:90,
  turns:[{startM:0,endM:1000,ability:90}]};
const rider=(id,timetrial)=>({id,mountain:65,flat:65,hills:65,
  timetrial,endurance:70,strength:70,form:50,fatigue:0});
const priorSegment={...segment,km:12};
const frontRider=rider('a',35),rearRider=rider('b',95);
const frontSource={rider:frontRider,segment:priorSegment,energy:40,
  bunchTurnPlan:{status:'worked',leaderAbility:77,
    turns:[{startM:0,endM:1000,ability:77}]},
  stageNumber:18,stageCount:21};
const rearSource={...frontSource,rider:rearRider,
  committedStagePlan:{riderId:'b',currentStageNumber:18,
    targetStageNumber:19,currentGoal:'finish_safely',
    futureGoal:'target_stage',reserveEnergy:39.9}};
const frontPrior=advanceRearDetachmentV1(frontSource);
const rearPrior=advanceRearDetachmentV1(rearSource);
const input={segment,bunchTurnPlan,
  front:{prior:frontPrior,priorSource:frontSource,rider:frontRider,
    effort:'conserve',reason:'finish_safely'},
  rear:{prior:rearPrior,priorSource:rearSource,rider:rearRider,
    effort:'hard',reason:'rejoin_bunch'}};

test('source-derived speeds and paid energy form a physical rear contact',()=>{
  assert.ok(frontPrior.behindBunchSeconds<rearPrior.behindBunchSeconds,
    JSON.stringify({frontPrior,rearPrior}));
  const result=advanceRearSourceContactV1(input);
  assert.equal(result.contact.event.kind,'rear_contact');
  assert.ok(result.contact.endDistanceM>12000&&
    result.contact.endDistanceM<13000);
  assert.equal(result.contact.riders.length,2);
  assert.ok(result.contact.riders.every(row=>row.energySpent>0));
  const group=continueRearContactV1({soloInput:result.soloInput,
    groupId:'rear-1',leaderRiderId:'b',groupSpeedKph:36,
    leadCostPerKm:1,shelteredCostPerKm:.2});
  assert.equal(group.contact.event.atDistanceM,
    result.contact.event.atDistanceM);
  assert.equal(group.rearGroup.riderIds.length,2);
  assert.equal(validateRearSourceContactV1(input,result),true);
  const forged=structuredClone(result);
  forged.contact.event.atDistanceM=13000;
  assert.throws(()=>validateRearSourceContactV1(input,forged),/differs/);
});

test('ordering, unpayable work and forged bunch plan refuse',()=>{
  assert.throws(()=>advanceRearSourceContactV1({...input,
    rear:{...input.rear,prior:{...rearPrior,
      behindBunchSeconds:frontPrior.behindBunchSeconds}}}),/ordered/);
  assert.throws(()=>advanceRearSourceContactV1({...input,
    rear:{...input.rear,prior:{...rearPrior,energyAfter:0}}}),
  /differs/);
  assert.throws(()=>advanceRearSourceContactV1({...input,
    bunchTurnPlan:{...bunchTurnPlan,leaderAbility:80}}),/differs/);
});

const groupInput={contactInput:input,groupId:'rear-1',
  leaderRiderId:'b',memberDecisions:[
    {riderId:'a',choice:'sit_in',effort:'conserve',reason:'save_energy'},
    {riderId:'b',choice:'pull',effort:'hard',reason:'rejoin_bunch'}]};

test('after paid contact a willing leader pulls and the other rider shelters',()=>{
  const result=continueRearSourceGroupV1(groupInput);
  assert.equal(result.continuation.contact.event.kind,'rear_contact');
  assert.equal(result.continuation.leaderRiderId,'b');
  const byId=new Map(result.continuation.riders.map(row=>[row.riderId,row]));
  assert.equal(byId.get('b').role,'leader');
  assert.equal(byId.get('a').role,'sheltered');
  assert.ok(byId.get('b').energySpent>byId.get('a').energySpent);
  assert.equal(validateRearSourceGroupV1(groupInput,result),true);
  const forged=structuredClone(result);
  forged.continuation.riders[0].energySpent=0;
  assert.throws(()=>validateRearSourceGroupV1(groupInput,forged),/differs/);
});

test('group cannot start without an agreed paid pull or genuine contact',()=>{
  assert.throws(()=>continueRearSourceGroupV1({...groupInput,
    memberDecisions:groupInput.memberDecisions.map(row=>({...row,
      choice:'sit_in'}))}),/willing leader/);
  assert.throws(()=>continueRearSourceGroupV1({...groupInput,
    contactInput:{...input,front:{...input.front,
      prior:{...frontPrior,energyAfter:0}}}}),/differs/);
});
