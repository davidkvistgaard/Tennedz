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
import {advanceRearGroupSoloJoinV1,validateRearGroupSoloJoinV1} from
  '../../lib/engine/v2/rear-group-solo-join-v1.mjs';
import {runRearSoloSourceV1,validateRearSoloSourceRunV1} from
  '../../lib/engine/v2/rear-solo-source-run-v1.mjs';
import {continueRearJoinedGroupV1,validateRearJoinedGroupV1} from
  '../../lib/engine/v2/rear-joined-group-continuation-v1.mjs';
import {advanceRearGroupSourceStepV2,
  validateRearGroupSourceStepV2} from
  '../../lib/engine/v2/rear-group-source-step-v2.mjs';
import {runRearGroupAfterJoinV1,validateRearGroupAfterJoinV1} from
  '../../lib/engine/v2/rear-group-after-join-run-v1.mjs';

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

test('a third rider joins only at calculated paid rear contact',()=>{
  const c={...rider('c',100),mountain:15,flat:100};
  const extendedTeams=[...teams,{id:'team-c',riders:[c],orders:{
    baseline:{effort:'hard',breakWork:'cooperate'},phases:[]}}];
  const extendedChoiceInput={...priorChoiceInput,teams:extendedTeams};
  const extendedChoice=decideRearGroupChoiceV2(extendedChoiceInput);
  const joinBunchTurnPlan={status:'worked',leaderAbility:40,
    turns:[{startM:0,endM:1000,ability:40}]};
  const kilometre={segment:nextSegment,bunchTurnPlan:joinBunchTurnPlan,
    teams:extendedTeams,rearGoals,roadGroups:[],
    stageNumber:18,stageCount:21};
  const priorRunInput={initialChoiceInput:extendedChoiceInput,
    initialChoice:extendedChoice,kilometres:[kilometre]};
  const priorRun=runRearGroupSourceV1(priorRunInput);
  const soloInitialInput={rider:c,segment:priorSegment,energy:40,
    bunchTurnPlan:priorPlan,stageNumber:18,stageCount:21};
  const soloInitial=advanceRearDetachmentV1(soloInitialInput);
  const priorSoloRunInput={initialInput:soloInitialInput,
    initial:soloInitial,steps:[
      {rider:c,segment,bunchTurnPlan:contactInput.bunchTurnPlan,
        effort:'conserve',reason:'finish_safely'},
      {rider:c,segment:nextSegment,bunchTurnPlan:joinBunchTurnPlan,
        effort:'conserve',reason:'finish_safely'}]};
  const priorSoloRun=runRearSoloSourceV1(priorSoloRunInput);
  const joinInput={priorRunInput,priorRun,priorSoloRunInput,priorSoloRun,
    soloRider:c,segment:{...nextSegment,km:15,
      terrain:'flat',gradientPct:0},
    bunchTurnPlan,teams:extendedTeams,rearGoals,
    roadGroups:[],stageNumber:18,stageCount:21,
    soloEffort:'hard',soloReason:'rejoin_bunch'};
  assert.equal(validateRearSoloSourceRunV1(priorSoloRunInput,
    priorSoloRun),true);
  const joined=advanceRearGroupSoloJoinV1(joinInput);
  assert.equal(joined.event.kind,'join_rear_group');
  assert.equal(joined.joinedGroup.riderIds.length,3);
  assert.ok(joined.atDistanceM>14000&&joined.atDistanceM<15000);
  assert.deepEqual(joined.riders.map(row=>row.role),
    ['leader','sheltered','solo']);
  assert.ok(joined.riders.every(row=>row.energySpent>0));
  assert.ok(joined.riders.every(row=>row.energy>=0));
  assert.equal(joined.joinedGroup.atDistanceM,joined.event.atDistanceM);
  assert.equal(validateRearGroupSoloJoinV1(joinInput,joined),true);
  const forged=structuredClone(joined);
  forged.joinedGroup.energyByRider.c=100;
  assert.throws(()=>validateRearGroupSoloJoinV1(joinInput,forged),
  /differs/);
  const forgedSolo=structuredClone(priorSoloRun);
  forgedSolo.finalSolo.energyAfter=100;
  assert.throws(()=>advanceRearGroupSoloJoinV1({...joinInput,
    priorSoloRun:forgedSolo}),/replayed paid solo/);
  assert.throws(()=>advanceRearGroupSoloJoinV1({...joinInput,
    soloRider:{...c,flat:90}}),/distinct paid solo/);
  assert.throws(()=>advanceRearGroupSoloJoinV1({...joinInput,
    segment:{...joinInput.segment,terrain:'climb',gradientPct:6}}),
  /does not reach/);
  const continuationInput={joinInput,join:joined,
    rearGoals:[...rearGoals,{riderId:'c',goal:'rejoin_bunch',
      rearWork:'cooperate'}]};
  const continuation=continueRearJoinedGroupV1(continuationInput);
  assert.equal(continuation.leaderRiderId,'b');
  assert.notEqual(continuation.leaderRiderId,
    joined.groupPlan.road.leaderRiderId);
  assert.equal(continuation.startDistanceM,joined.atDistanceM);
  assert.equal(continuation.endDistanceM,15000);
  assert.equal(continuation.riders.length,3);
  assert.equal(continuation.riders.filter(row=>
    row.role==='leader').length,1);
  assert.ok(continuation.riders.every(row=>row.energySpent>0));
  assert.ok(continuation.riders.every(row=>row.energy>=0));
  assert.ok(continuation.riders.find(row=>row.role==='leader').energySpent>
    continuation.riders.find(row=>row.role==='sheltered').energySpent);
  assert.equal(validateRearJoinedGroupV1(continuationInput,
    continuation),true);
  const forgedTurn=structuredClone(continuation);
  forgedTurn.riders[0].energySpent=0;
  assert.throws(()=>validateRearJoinedGroupV1(continuationInput,
    forgedTurn),/differs/);
  assert.throws(()=>continueRearJoinedGroupV1({...continuationInput,
    rearGoals:continuationInput.rearGoals.map(row=>({...row,
      rearWork:'sit_on'}))}),/No rear rider/);
  const threeInput={group:continuation.rearGroup,
    lastLeaderRiderId:continuation.leaderRiderId,
    segment:{...joinInput.segment,km:16},bunchTurnPlan,
    teams:extendedTeams,rearGoals:continuationInput.rearGoals,
    roadGroups:[],stageNumber:18,stageCount:21};
  const three=advanceRearGroupSourceStepV2(threeInput);
  assert.equal(three.leaderRiderId,'c');
  assert.equal(three.startDistanceM,15000);
  assert.equal(three.endDistanceM,16000);
  assert.equal(three.riders.filter(row=>row.role==='leader').length,1);
  assert.ok(three.riders.every(row=>row.energySpent>0));
  assert.equal(validateRearGroupSourceStepV2(threeInput,three),true);
  const next=advanceRearGroupSourceStepV2({...threeInput,
    group:three.rearGroup,lastLeaderRiderId:three.leaderRiderId,
    segment:{...joinInput.segment,km:17},
    rearGoals:continuationInput.rearGoals.map(row=>
      row.riderId==='c'?{...row,rearWork:'sit_on'}:row)});
  assert.equal(next.leaderRiderId,'a');
  const forgedStep=structuredClone(three);
  forgedStep.riders[0].energySpent=0;
  assert.throws(()=>validateRearGroupSourceStepV2(threeInput,
    forgedStep),/differs/);
  const afterInput={continuationInput,continuation,kilometres:[
    {segment:threeInput.segment,bunchTurnPlan,teams:extendedTeams,
      rearGoals:continuationInput.rearGoals,roadGroups:[],
      stageNumber:18,stageCount:21},
    {segment:{...joinInput.segment,km:17},bunchTurnPlan,
      teams:extendedTeams,rearGoals:continuationInput.rearGoals.map(row=>
        row.riderId==='c'?{...row,rearWork:'sit_on'}:row),
      roadGroups:[],stageNumber:18,stageCount:21}]};
  const after=runRearGroupAfterJoinV1(afterInput);
  assert.deepEqual(after.steps.map(step=>step.leaderRiderId),
    ['c','a']);
  assert.equal(after.finalRearGroup.atDistanceM,17000);
  assert.equal(validateRearGroupAfterJoinV1(afterInput,after),true);
  const forgedAfter=structuredClone(after);
  forgedAfter.steps[1].riders[0].energy=100;
  assert.throws(()=>validateRearGroupAfterJoinV1(afterInput,
    forgedAfter),/differs/);
  assert.throws(()=>runRearGroupAfterJoinV1({...afterInput,
    kilometres:[afterInput.kilometres[0],
      {...afterInput.kilometres[1],segment:{...joinInput.segment,
        km:18}}]}),/consecutive/);
  assert.throws(()=>advanceRearGroupSourceStepV2({...threeInput,
    group:{...continuation.rearGroup,
      energyByRider:{...continuation.rearGroup.energyByRider,
        c:.01}}}),/cannot pay/);
  const bunchCatch=advanceRearGroupSourceStepV2({...threeInput,
    group:{...continuation.rearGroup,behindBunchSeconds:.2},
    bunchTurnPlan:{status:'worked',leaderAbility:20,
      turns:[{startM:0,endM:1000,ability:20}]}});
  assert.equal(bunchCatch.event?.kind,'rejoin_bunch');
  assert.ok(bunchCatch.endDistanceM>15000&&
    bunchCatch.endDistanceM<16000);
  assert.equal(bunchCatch.rearGroup,null);
});
