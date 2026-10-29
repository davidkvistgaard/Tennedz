import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceRearDetachmentV1} from
  '../../lib/engine/v2/rear-detachment-v1.mjs';
import {decideRearGroupChoiceV2} from
  '../../lib/engine/v2/rear-group-choice-v2.mjs';
import {advanceRearGroupSourceRoadV1,validateRearGroupSourceRoadV1} from
  '../../lib/engine/v2/rear-group-source-road-v1.mjs';
import {runRearGroupSourceV1,validateRearGroupSourceRunV1} from
  '../../lib/engine/v2/rear-group-source-run-v1.mjs';

const rider=(id,timetrial)=>({id,mountain:65,flat:65,hills:65,
  timetrial,endurance:70,strength:70,form:50,fatigue:0});
const a=rider('a',35),b=rider('b',95);
const segment={km:13,terrain:'climb',surface:'road',gradientPct:6,
  exposed:false,weather:{temperatureC:16,windKph:0,rainMm:0}};
const priorSegment={...segment,km:12};
const priorPlan={status:'worked',leaderAbility:77,
  turns:[{startM:0,endM:1000,ability:77}]};
const sourceA={rider:a,segment:priorSegment,energy:40,
  bunchTurnPlan:priorPlan,stageNumber:18,stageCount:21};
const sourceB={...sourceA,rider:b,
  committedStagePlan:{riderId:'b',currentStageNumber:18,
    targetStageNumber:19,currentGoal:'finish_safely',
    futureGoal:'target_stage',reserveEnergy:39.9}};
const contactInput={segment,bunchTurnPlan:{status:'worked',
  leaderAbility:90,turns:[{startM:0,endM:1000,ability:90}]},
front:{prior:advanceRearDetachmentV1(sourceA),priorSource:sourceA,
  rider:a,effort:'conserve',reason:'finish_safely'},
rear:{prior:advanceRearDetachmentV1(sourceB),priorSource:sourceB,
  rider:b,effort:'hard',reason:'rejoin_bunch'}};
const teams=[{id:'team-a',riders:[a],orders:{baseline:{
  effort:'conserve',breakWork:'sit_on'},phases:[]}},
{id:'team-b',riders:[b],orders:{baseline:{
  effort:'hard',breakWork:'cooperate'},phases:[]}}];
const rearGoals=[{riderId:'a',goal:'finish_safely',
  rearWork:'cooperate'},
{riderId:'b',goal:'rejoin_bunch',rearWork:'cooperate'}];
const priorChoiceInput={contactInput,teams,rearGoals,
  roadGroups:[],groupId:'rear-1',stageNumber:18,stageCount:21};
const priorChoice=decideRearGroupChoiceV2(priorChoiceInput);
const nextSegment={...segment,km:14};
const bunchTurnPlan={status:'worked',leaderAbility:90,
  turns:[{startM:0,endM:1000,ability:90}]};
const input={priorChoiceInput,priorChoice,segment:nextSegment,
  bunchTurnPlan,teams,rearGoals,roadGroups:[],
  stageNumber:18,stageCount:21};

test('next rear kilometre reselects a paid leader from rider decisions',()=>{
  const result=advanceRearGroupSourceRoadV1(input);
  assert.equal(result.road.leaderRiderId,'b');
  assert.equal(result.road.startDistanceM,13000);
  assert.equal(result.road.endDistanceM,14000);
  assert.equal(result.road.riders.length,2);
  assert.equal(result.road.riders.filter(row=>row.role==='leader').length,1);
  assert.ok(result.road.riders.every(row=>row.energySpent>0));
  assert.ok(result.road.riders.find(row=>row.role==='leader').energySpent>
    result.road.riders.find(row=>row.role==='sheltered').energySpent);
  assert.equal(validateRearGroupSourceRoadV1(input,result),true);
  const forged=structuredClone(result);
  forged.road.riders[0].energySpent=0;
  assert.throws(()=>validateRearGroupSourceRoadV1(input,forged),/differs/);
});

test('each kilometre can change willingness, but no leader refuses',()=>{
  const one={...input,rearGoals:[rearGoals[0],
    {...rearGoals[1],rearWork:'sit_on'}]};
  assert.equal(advanceRearGroupSourceRoadV1(one).road.leaderRiderId,'a');
  assert.throws(()=>advanceRearGroupSourceRoadV1({...input,
    rearGoals:rearGoals.map(row=>({...row,rearWork:'sit_on'}))}),
  /No rear rider/);
});

test('prior group, roster and bunch turn source cannot be forged',()=>{
  const changed=structuredClone(priorChoice);
  changed.group.continuation.rearGroup.energyByRider.a=100;
  assert.throws(()=>advanceRearGroupSourceRoadV1({...input,
    priorChoice:changed}),/replayed/);
  assert.throws(()=>advanceRearGroupSourceRoadV1({...input,
    segment:{...nextSegment,km:15}}),/next exact/);
  assert.throws(()=>advanceRearGroupSourceRoadV1({...input,
    teams:[{...teams[0],riders:[{...a,mountain:100}]},teams[1]]}),
  /next exact/);
  assert.throws(()=>advanceRearGroupSourceRoadV1({...input,
    bunchTurnPlan:{...bunchTurnPlan,leaderAbility:80}}),/differs/);
});

test('consecutive rear kilometres choose and pay fresh turns each time',()=>{
  const kilometre={segment:nextSegment,bunchTurnPlan,teams,
    rearGoals,roadGroups:[],stageNumber:18,stageCount:21};
  const next={...kilometre,segment:{...nextSegment,km:15},
    rearGoals:[{...rearGoals[0],rearWork:'sit_on'},rearGoals[1]]};
  const runInput={initialChoiceInput:priorChoiceInput,initialChoice:priorChoice,
    kilometres:[kilometre,next]};
  const result=runRearGroupSourceV1(runInput);
  assert.equal(result.steps.length,2);
  assert.equal(result.steps[0].sourceKm,14);
  assert.equal(result.steps[1].sourceKm,15);
  assert.equal(result.steps[0].road.leaderRiderId,'b');
  assert.equal(result.steps[1].road.leaderRiderId,'b');
  assert.equal(result.steps[1].memberDecisions[0].choice,'sit_in');
  assert.ok(result.steps[1].road.riders.every(row=>row.energySpent>0));
  assert.equal(validateRearGroupSourceRunV1(runInput,result),true);
  const tampered=structuredClone(result);
  tampered.steps[1].road.riders[1].energySpent=0;
  assert.throws(()=>validateRearGroupSourceRunV1(runInput,tampered),
  /differs/);
  assert.throws(()=>runRearGroupSourceV1({...runInput,kilometres:[
    kilometre,{...next,segment:{...next.segment,km:16}}]}),
  /consecutive/);
  assert.throws(()=>runRearGroupSourceV1({...runInput,kilometres:[
    kilometre,{...next,group:{...result.steps[0].road.rearGroup,
      energyByRider:{a:100,b:100}}}]}),
  /consecutive|differs|road/);
});
