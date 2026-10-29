import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearDetachmentV1} from
  '../../lib/engine/v2/rear-detachment-v1.mjs';
import {decideRearGroupChoiceV2} from
  '../../lib/engine/v2/rear-group-choice-v2.mjs';
import {advanceRearGroupFollowerSplitV2} from
  '../../lib/engine/v2/rear-group-follower-split-v2.mjs';
import {advanceRearSplitSoloContactV1,
  validateRearSplitSoloContactV1} from
  '../../lib/engine/v2/rear-split-solo-contact-v1.mjs';
import {runRearSplitSoloV2} from
  '../../lib/engine/v2/rear-split-solo-run-v2.mjs';
import {commitRearGoalsV1} from
  '../../lib/engine/v2/rear-goal-commitment-v1.mjs';
import {continueRearSplitContactV1,
  validateRearSplitContactContinuationV1} from
  '../../lib/engine/v2/rear-split-contact-continuation-v1.mjs';

const rider=(id,mountain,timetrial)=>({id,mountain,flat:65,hills:65,
  timetrial,endurance:70,strength:70,form:50,fatigue:0});
const a={...rider('a',65,35),flat:100};
const b={...rider('b',65,95),flat:15};
const terrain=(km,gradientPct=6)=>({km,terrain:gradientPct?'climb':'flat',
  surface:'road',gradientPct,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}});
const priorSegment=terrain(12);
const sourceA={rider:a,segment:priorSegment,energy:40,
  bunchTurnPlan:{status:'worked',leaderAbility:77,
    turns:[{startM:0,endM:1000,ability:77}]},
  stageNumber:18,stageCount:21};
const sourceB={...sourceA,rider:b,
  committedStagePlan:{riderId:'b',currentStageNumber:18,
    targetStageNumber:19,currentGoal:'finish_safely',
    futureGoal:'target_stage',reserveEnergy:39.9}};
const contactInput={segment:terrain(13),bunchTurnPlan:{status:'worked',
  leaderAbility:90,turns:[{startM:0,endM:1000,ability:90}]},
front:{prior:advanceRearDetachmentV1(sourceA),priorSource:sourceA,
  rider:a,effort:'conserve',reason:'finish_safely'},
rear:{prior:advanceRearDetachmentV1(sourceB),priorSource:sourceB,
  rider:b,effort:'hard',reason:'rejoin_bunch'}};
const teams=[{id:'team-a',riders:[a],orders:{baseline:{
  effort:'conserve',breakWork:'sit_on'},phases:[]}},
{id:'team-b',riders:[b],orders:{baseline:{
  effort:'hard',breakWork:'cooperate'},phases:[]}}];
const rearGoals=[{riderId:'a',goal:'finish_safely',rearWork:'cooperate'},
  {riderId:'b',goal:'rejoin_bunch',rearWork:'cooperate'}];
const priorChoiceInput={contactInput,teams,rearGoals,roadGroups:[],
  groupId:'rear-1',stageNumber:18,stageCount:21};
const priorChoice=decideRearGroupChoiceV2(priorChoiceInput);
const splitInput={priorChoiceInput,priorChoice,segment:terrain(14),
  bunchTurnPlan:contactInput.bunchTurnPlan,teams,rearGoals,
  roadGroups:[],stageNumber:18,stageCount:21,
  routeKilometres:Array.from({length:17},(_,index)=>
    terrain(index+1,index>=14?0:6))};
const split=advanceRearGroupFollowerSplitV2(splitInput);

test('source-replayed rear solos only form a group at paid contact',()=>{
  assert.deepEqual(split.solos.map(row=>row.riderId),['b','a']);
  const bunchTurnPlan={status:'worked',leaderAbility:90,
      turns:[{startM:0,endM:500,ability:90},
        {startM:500,endM:1000,ability:90}]};
  const soloChoices=[{riderId:'b',effort:'conserve',
    reason:'finish_safely'},
  {riderId:'a',effort:'hard',reason:'rejoin_bunch'}];
  const priorRunInput={splitInput,split,kilometres:[{
    segment:terrain(15,0),bunchTurnPlan,soloChoices},
  {segment:terrain(16,0),bunchTurnPlan,soloChoices}]};
  const priorRun=runRearSplitSoloV2(priorRunInput);
  const input={splitInput,split,priorRunInput,priorRun,
    segment:terrain(17,0),bunchTurnPlan,soloChoices};
  const contact=advanceRearSplitSoloContactV1(input);
  assert.equal(contact.event.kind,'rear_contact');
  assert.ok(contact.atDistanceM>16000&&contact.atDistanceM<17000);
  assert.ok(contact.paid.every(row=>row.energySpent>0));
  assert.ok(contact.paid[0].energySpent!==contact.paid[1].energySpent);
  assert.equal(contact.rearGroup.atDistanceM,contact.atDistanceM);
  assert.equal(contact.remainingKmUnsettled,true);
  assert.equal(validateRearSplitSoloContactV1(input,contact),true);
  const strategies=rearGoals.map(row=>({riderId:row.riderId,
    baseline:{goal:row.goal,rearWork:row.rearWork},phases:[]}));
  const baselineCommitment=commitRearGoalsV1({
    riderIds:['b','a'],strategies,distanceKm:20,
    keypoints:[{km:16}],stageNumber:18,stageCount:21});
  assert.throws(()=>continueRearSplitContactV1({
    contactInput:input,contact,commitment:baselineCommitment}),
  /cannot hold/);
  const commitment=commitRearGoalsV1({
    riderIds:['b','a'],strategies:strategies.map(row=>
      row.riderId==='a'?{...row,phases:[{atKm:16,
        goal:'finish_safely',rearWork:'sit_on'}]}:row),
    distanceKm:20,keypoints:[{km:16}],
    stageNumber:18,stageCount:21});
  const joinedInput={contactInput:input,contact,
    commitment};
  const joined=continueRearSplitContactV1(joinedInput);
  assert.equal(joined.startDistanceM,contact.atDistanceM);
  assert.equal(joined.endDistanceM,17000);
  assert.equal(joined.leaderRiderId,'b');
  assert.equal(joined.slices[0].riders.filter(row=>
    row.role==='leader').length,1);
  assert.ok(joined.slices.every(slice=>slice.riders.every(row=>
    row.energySpent>0)));
  assert.ok(joined.slices.every(slice=>
    slice.riders.find(row=>row.role==='sheltered').energySpent<
      slice.riders.find(row=>row.role==='leader').energySpent));
  assert.ok(joined.slices.every(slice=>
    slice.holdChecks.every(row=>row.canHold)));
  assert.ok(joined.settlement.every(row=>row.recoveryAward===0&&
    row.cap===100));
  assert.equal(joined.rearGroup.atDistanceM,17000);
  assert.equal(validateRearSplitContactContinuationV1(
    joinedInput,joined),true);
  const forgedJoin=structuredClone(joined);
  forgedJoin.rearGroup.energyByRider.a=100;
  assert.throws(()=>validateRearSplitContactContinuationV1(
    joinedInput,forgedJoin),/differs/);
  const wrongCommitment=structuredClone(commitment);
  wrongCommitment.strategies[0].baseline.rearWork='sit_on';
  assert.throws(()=>continueRearSplitContactV1({...joinedInput,
    commitment:wrongCommitment}),/prior commitment/);
  const forged=structuredClone(contact);
  forged.paid[1].energySpent=0;
  assert.throws(()=>validateRearSplitSoloContactV1(input,forged),/differs/);
  const altered=structuredClone(priorRun);
  altered.finalSoloStates[1].behindBunchSeconds+=.01;
  assert.throws(()=>advanceRearSplitSoloContactV1({...input,
    priorRun:altered}),/replayed sources/);
  assert.throws(()=>advanceRearSplitSoloContactV1({...input,
    priorRun:null}),/replayed sources/);
  assert.throws(()=>advanceRearSplitSoloContactV1({...input,
    priorRunInput:null,priorRun:null,segment:terrain(15,0)}),
  /did not make paid contact/);
});
