import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {commitTeamChaseStakesV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {commitRearSoloPlanV1} from
  '../../lib/engine/v2/rear-solo-commitment-v1.mjs';
import {startPhysicalBunchV1,advancePhysicalStartBunchV1,
  validatePhysicalStartBunchV1,runPhysicalBunchV1,
  validatePhysicalBunchRunV1,runPhysicalBunchToPaceLossV1,
  validatePhysicalBunchPaceLossV1,
  runPhysicalBunchAfterPaceLossV1,
  validatePhysicalBunchAfterPaceLossV1} from
  '../../lib/engine/v2/physical-start-bunch-v1.mjs';
import {completePhysicalPaceLossKmV1,
  validatePhysicalPaceLossCompletionV1} from
  '../../lib/engine/v2/physical-pace-loss-completion-v1.mjs';
import {runPhysicalDetachedSoloV1,
  validatePhysicalDetachedSoloV1} from
  '../../lib/engine/v2/physical-detached-solo-run-v1.mjs';
import {contactPhysicalRearSolosV1,
  validatePhysicalRearSoloContactV1} from
  '../../lib/engine/v2/physical-rear-solo-contact-v1.mjs';
import {finishPhysicalRearContactKmV1,
  validatePhysicalRearContactRoadV1} from
  '../../lib/engine/v2/physical-rear-contact-road-v1.mjs';
import {priceRearEnergyDemandV1} from
  '../../lib/engine/v2/rear-energy-demand-v1.mjs';

const route=(terrain='flat')=>Array.from({length:20},(_,index)=>({
  km:index+1,terrain,gradientPct:terrain==='climb'?6:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const field=(fatigue=20)=>['control','sprint','other'].map(id=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue,
    ...Object.fromEntries(SPORTING_SKILLS.map(skill=>[skill,70]))}));
  return {id,riders,energy:Object.fromEntries(riders.map(rider=>
    [rider.id,100-fatigue*.4])),orders:{
    captainId:riders[0].id,helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',attack:'none',chase:'ignore',
      ...(id==='control'?{frontWork:'rotate',
        frontWorkRiderId:'control-2'}:{})},phases:[]}};
});
const source=(teams=field(),routeKilometres=route())=>{
  const commitment=commitTeamChaseStakesV1({teams,distanceKm:20,
    intentions:teams.map(team=>({teamId:team.id,
      baseline:{goal:team.id==='sprint'?'sprint_finish':'none',
        captainId:team.riders[0].id},phases:[]}))});
  const startInput={teams,routeKilometres,commitment,
    raceSeed:'physical-start-1'};
  const start=startPhysicalBunchV1(startInput);
  return {startInput,start,segment:routeKilometres[0]};
};

test('start line pays one named leader and all 23 sheltered riders',()=>{
  const input=source();
  const road=advancePhysicalStartBunchV1(input);
  assert.equal(road.leaderRiderId,'control-2');
  assert.equal(road.riderDecisions.length,24);
  assert.equal(road.riders.length,24);
  assert.equal(road.physicalGroup.riderIds.length,24);
  assert.equal(road.riders.filter(row=>row.role==='leader').length,1);
  assert.equal(road.riderDecisions.filter(row=>
    row.choice==='pull').length,1);
  assert.ok(road.riders.every(row=>row.energySpent>0&&
    row.energyAfter>=0));
  assert.ok(road.riders.find(row=>row.riderId==='control-2')
    .energySpent>road.riders.find(row=>row.riderId==='sprint-2')
      .energySpent);
  assert.equal(road.riderDecisions.find(row=>
    row.riderId==='sprint-0').goal,'sprint_finish');
  assert.equal(road.endDistanceM,1000);
  assert.ok(road.elapsedSeconds>0);
  assert.equal(validatePhysicalStartBunchV1(input,road),true);
  const forged=structuredClone(road);
  forged.riders[0].energySpent=0;
  assert.throws(()=>validatePhysicalStartBunchV1(input,forged),
    /differs/);
});

test('same-seed terrain and fatigue change paid start road',()=>{
  const flat=advancePhysicalStartBunchV1(source());
  const climbing=advancePhysicalStartBunchV1(
    source(field(),route('climb')));
  const tired=advancePhysicalStartBunchV1(
    source(field(70)));
  assert.ok(climbing.riders[0].energySpent>
    flat.riders[0].energySpent);
  assert.ok(tired.riders[0].energyBefore<
    flat.riders[0].energyBefore);
  assert.notEqual(tired.bunchSpeedKph,flat.bunchSpeedKph);
  assert.equal(climbing.riderDecisions.length,24);
  assert.equal(tired.riderDecisions.length,24);
});

test('unsupported orders and physical inability refuse before movement',()=>{
  const input=source();
  const noLeader=structuredClone(input.startInput.teams);
  delete noLeader[0].orders.baseline.frontWork;
  delete noLeader[0].orders.baseline.frontWorkRiderId;
  assert.throws(()=>advancePhysicalStartBunchV1(source(noLeader)),
    /one ordered front worker/);
  const attack=structuredClone(input.startInput.teams);
  attack[1].orders.baseline.attack='opportunistic';
  assert.throws(()=>advancePhysicalStartBunchV1(source(attack)),
    /one ordered front worker/);
  const weak=structuredClone(input.startInput.teams);
  for(const skill of SPORTING_SKILLS)weak[2].riders[3][skill]=10;
  assert.throws(()=>advancePhysicalStartBunchV1(source(weak)),
    /cannot hold paid pace/);
  const forged=structuredClone(input.start);
  forged.energyByRider['control-2']=100;
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    start:forged}),/replayed start source/);
  const changedRoute=structuredClone(input.startInput);
  changedRoute.routeKilometres[0].gradientPct=4;
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    startInput:changedRoute}),/replayed start source/);
  const changedOrders=structuredClone(input.startInput);
  changedOrders.teams[0].orders.baseline.effort='hard';
  assert.throws(()=>advancePhysicalStartBunchV1({...input,
    startInput:changedOrders}),/replayed start source/);
});

test('consecutive paid road rotates named leader and replays every rider',()=>{
  const teams=field();
  teams[0].orders.phases=[{atKm:1,frontWork:'sit_in'},
    {atKm:3,frontWork:'rotate',frontWorkRiderId:'control-3'}];
  teams[1].orders.phases=[{atKm:1,frontWork:'rotate',
    frontWorkRiderId:'sprint-2'},
  {atKm:3,frontWork:'sit_in'}];
  const input=source(teams);
  const road=runPhysicalBunchV1({...input,throughKm:5});
  assert.deepEqual(road.road.map(row=>row.leaderRiderId),
    ['control-2','sprint-2','sprint-2','control-3','control-3']);
  assert.deepEqual(road.road.map(row=>row.sourceKm),[1,2,3,4,5]);
  assert.equal(road.physicalGroup.atDistanceM,5000);
  assert.equal(road.road.reduce((sum,row)=>sum+
    row.riderDecisions.length,0),120);
  assert.ok(road.elapsedSeconds>road.road[0].elapsedSeconds);
  for(let index=1;index<road.road.length;index++)for(const rider of
    road.road[index].riders){
    assert.equal(rider.energyBefore,
      road.road[index-1].energyByRider[rider.riderId]);
  }
  assert.equal(validatePhysicalBunchRunV1({...input,
    throughKm:5},road),true);
  const forged=structuredClone(road);
  forged.road[2].riders[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalBunchRunV1({...input,
    throughKm:5},forged),/differs/);
});

test('early climb weakness records a paid partial solo and no rear group',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const input=source(teams,route('climb'));
  const loss=runPhysicalBunchToPaceLossV1({...input,lossKm:1});
  const split=loss.step.splits.find(row=>
    row.riderId==='other-3');
  const rider=loss.step.riders.find(row=>
    row.riderId==='other-3');
  assert.ok(split.atDistanceM>0&&split.atDistanceM<1000);
  assert.equal(rider.role,'solo_partial');
  assert.ok(rider.energySpent>0&&rider.energyAfter<
    rider.energyBefore);
  assert.equal(rider.recoveryAward,0);
  assert.ok(!loss.step.physicalGroup.riderIds.includes('other-3'));
  assert.ok(loss.step.rearSolos.some(row=>
    row.riderId==='other-3'&&
    row.atDistanceM===split.atDistanceM));
  assert.equal(loss.step.riderDecisions.length,24);
  assert.equal(validatePhysicalBunchPaceLossV1({...input,
    lossKm:1},loss),true);
  const forged=structuredClone(loss);
  forged.step.splits[0].atDistanceM+=1;
  assert.throws(()=>validatePhysicalBunchPaceLossV1({...input,
    lossKm:1},forged),/differs/);
});

test('former paid bunch worker can lose a later faster leader',()=>{
  const teams=field();
  teams[0].orders.phases=[{atKm:1,frontWork:'sit_in'}];
  teams[1].orders.phases=[{atKm:1,frontWork:'rotate',
    frontWorkRiderId:'sprint-2',effort:'hard'}];
  for(const skill of SPORTING_SKILLS)
    teams[1].riders[2][skill]=95;
  const input=source(teams);
  const loss=runPhysicalBunchToPaceLossV1({...input,lossKm:2});
  assert.equal(loss.priorRoad[0].leaderRiderId,'control-2');
  assert.ok(loss.step.splits.some(row=>row.riderId==='control-2'));
  assert.equal(loss.step.leaderRiderId,'sprint-2');
  assert.equal(loss.priorRoad[0].physicalGroup.riderIds.length,24);
  const completed=completePhysicalPaceLossKmV1({
    startInput:input.startInput,start:input.start,
    lossKm:2,loss,riderId:'control-2'});
  assert.equal(completed.sourceKm,2);
  assert.ok(completed.elapsedSeconds>loss.elapsedSeconds);
  teams[0].orders.phases.push({atKm:2,frontWork:'rotate',
    frontWorkRiderId:'control-2'});
  teams[1].orders.phases.push({atKm:2,frontWork:'sit_in'});
  const later=source(teams);
  assert.throws(()=>runPhysicalBunchAfterPaceLossV1({...later,
    lossKm:2,throughKm:3}),/no longer in bunch/);
});

test('pace-loss branch refuses a fictional split or incomplete route',()=>{
  const input=source();
  assert.throws(()=>runPhysicalBunchToPaceLossV1({...input,
    lossKm:1}),/no physical pace loss/);
  const changed=structuredClone(input.startInput);
  changed.routeKilometres[0].weather.windKph=Number.NaN;
  assert.throws(()=>startPhysicalBunchV1(changed),
    /committed field and route/);
});

test('detached rider pays remaining climb road and finishes kilometre late',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const input=source(teams,route('climb'));
  const loss=runPhysicalBunchToPaceLossV1({...input,lossKm:1});
  const completionInput={startInput:input.startInput,
    start:input.start,lossKm:1,loss,riderId:'other-3'};
  const completed=completePhysicalPaceLossKmV1(completionInput);
  assert.equal(completed.endDistanceM,1000);
  assert.ok(completed.elapsedSeconds>loss.elapsedSeconds);
  assert.ok(completed.gapSecondsToBunch>0);
  assert.ok(completed.energySpent>0);
  assert.ok(completed.totalKmEnergySpent>
    completed.energySpent);
  assert.equal(completed.physicalGroup.riderIds.length,1);
  assert.equal(completed.recoveryAward,0);
  assert.equal(validatePhysicalPaceLossCompletionV1(
    completionInput,completed),true);
  const forged=structuredClone(completed);
  forged.gapSecondsToBunch=0;
  assert.throws(()=>validatePhysicalPaceLossCompletionV1(
    completionInput,forged),/differs/);
  assert.throws(()=>completePhysicalPaceLossKmV1({...completionInput,
    riderId:'other-2'}),/detached source rider/);
});

test('surviving bunch pays later leaders without reclaiming detached rider',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const input=source(teams,route('climb'));
  const continued=runPhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3});
  assert.equal(continued.road.length,2);
  assert.deepEqual(continued.road.map(row=>row.sourceKm),[2,3]);
  assert.ok(!continued.physicalGroup.riderIds.includes('other-3'));
  assert.ok(!Object.hasOwn(continued.bunchEnergyByRider,'other-3'));
  assert.equal(continued.road[0].riderDecisions.length,
    continued.loss.step.physicalGroup.riderIds.length);
  assert.ok(continued.elapsedSeconds>
    continued.loss.elapsedSeconds);
  assert.equal(validatePhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3},continued),true);
  const forged=structuredClone(continued);
  forged.road[0].physicalGroup.riderIds.push('other-3');
  assert.throws(()=>validatePhysicalBunchAfterPaceLossV1({...input,
    lossKm:1,throughKm:3},forged),/differs/);
});

test('detached rider follows pre-race solo plan with paid later road',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const initial=source(teams,route('climb'));
  const plan=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:1,
    baseline:{goal:'finish_safely',effort:'conserve'}});
  const startInput={...initial.startInput,
    soloCommitments:[plan]};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,lossKm:1,
    throughKm:3,riderId:'other-3'};
  const run=runPhysicalDetachedSoloV1(input);
  assert.deepEqual(run.steps.map(row=>row.sourceKm),[2,3]);
  assert.ok(run.steps.every(row=>
    row.decision.goal==='finish_safely'&&
    row.energySpent>0&&row.recoveryAward===0&&
    row.gapSecondsToBunch>0));
  assert.equal(run.physicalGroup.riderIds[0],'other-3');
  assert.ok(run.elapsedSeconds>
    run.steps.at(-1).bunchElapsedSeconds);
  assert.equal(validatePhysicalDetachedSoloV1(input,run),true);
  const forged=structuredClone(run);
  forged.steps[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalDetachedSoloV1(input,forged),
    /differs/);
  const changed=structuredClone(startInput);
  changed.soloCommitments[0].baseline.effort='hard';
  assert.throws(()=>runPhysicalDetachedSoloV1({...input,
    startInput:changed}),/replayed committed start/);
  const phased=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:1,
    baseline:{goal:'finish_safely',effort:'conserve'},
    phases:[{atKm:5,goal:'rejoin_bunch',effort:'steady'}]});
  const phasedInput={...initial.startInput,
    soloCommitments:[phased]};
  const changedGoal=runPhysicalDetachedSoloV1({
    startInput:phasedInput,start:startPhysicalBunchV1(phasedInput),
    lossKm:1,throughKm:6,riderId:'other-3'});
  assert.equal(changedGoal.steps[3].decision.goal,'finish_safely');
  assert.equal(changedGoal.steps[4].decision.goal,'rejoin_bunch');
});

test('detached solo respects team effort and future-stage reserve',()=>{
  const teams=field();
  for(const skill of SPORTING_SKILLS)teams[2].riders[3][skill]=10;
  const initial=source(teams,route('climb'));
  const runWithPlan=plan=>{
    const startInput={...initial.startInput,
      soloCommitments:[plan]};
    return runPhysicalDetachedSoloV1({startInput,
      start:startPhysicalBunchV1(startInput),
      lossKm:1,throughKm:2,riderId:'other-3'});
  };
  const tooHard=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:1,
    baseline:{goal:'rejoin_bunch',effort:'hard'}});
  assert.throws(()=>runWithPlan(tooHard),/exceeds the team effort/);
  const save=commitRearSoloPlanV1({riderId:'other-3',
    distanceKm:20,stageNumber:1,stageCount:2,
    baseline:{goal:'save_for_stage',effort:'conserve',
      committedStagePlan:{riderId:'other-3',
        currentStageNumber:1,targetStageNumber:2,
        currentGoal:'finish_safely',futureGoal:'target_stage',
        reserveEnergy:95}}});
  assert.throws(()=>runWithPlan(save),/future-stage reserve/);
});

test('two paid rear solos meet on changed terrain before a group forms',()=>{
  const teams=field();
  const ahead=teams[2].riders[3];
  const catching=teams[2].riders[4];
  for(const skill of SPORTING_SKILLS){
    ahead[skill]=50;
    catching[skill]=50;
  }
  ahead.mountain=55;
  ahead.flat=20;
  ahead.timetrial=40;
  catching.mountain=10;
  catching.flat=90;
  catching.timetrial=65;
  const kilometres=route('flat');
  kilometres[0].terrain='climb';
  kilometres[0].gradientPct=6;
  const initial=source(teams,kilometres);
  const plans=[['other-3','conserve'],
    ['other-4','steady']].map(([riderId,effort])=>
    commitRearSoloPlanV1({riderId,distanceKm:20,
      stageNumber:1,stageCount:1,
      baseline:{goal:'finish_safely',effort}}));
  const startInput={...initial.startInput,
    soloCommitments:plans};
  const start=startPhysicalBunchV1(startInput);
  const input={startInput,start,lossKm:1,contactKm:2,
    riderIds:['other-3','other-4']};
  const contact=contactPhysicalRearSolosV1(input);
  assert.equal(contact.catchingRiderId,'other-4');
  assert.equal(contact.aheadRiderId,'other-3');
  assert.ok(contact.contactAtDistanceM>1000&&
    contact.contactAtDistanceM<2000);
  assert.ok(contact.behindBunchSeconds>0);
  assert.equal(contact.physicalGroup.riderIds.length,2);
  assert.ok(contact.riders.every(row=>row.energySpent>0));
  assert.equal(validatePhysicalRearSoloContactV1(input,contact),true);
  const forged=structuredClone(contact);
  forged.contactClockSeconds+=1;
  assert.throws(()=>validatePhysicalRearSoloContactV1(input,forged),
    /differs/);
  assert.throws(()=>contactPhysicalRearSolosV1({...input,
    contactKm:3}),/met before requested contact/);
  const groupInput={...input,contact};
  const group=finishPhysicalRearContactKmV1(groupInput);
  assert.equal(group.leaderRiderId,'other-3');
  assert.equal(group.endDistanceM,2000);
  assert.equal(group.physicalGroup.riderIds.length,2);
  assert.ok(group.gapSecondsToBunch>0);
  const sheltered=group.riders.find(row=>
    row.riderId==='other-4');
  assert.equal(sheltered.role,'sheltered');
  const soloQuote=priceRearEnergyDemandV1({
    rider:catching,segment:kilometres[1],
    energyBefore:sheltered.energyBefore,
    effort:sheltered.decision.effort,role:'solo',
    distanceM:group.endDistanceM-group.startDistanceM});
  assert.ok(sheltered.energySpent<soloQuote.energyDemand);
  assert.equal(validatePhysicalRearContactRoadV1(
    groupInput,group),true);
  const falseGroup=structuredClone(group);
  falseGroup.riders[0].energyAfter+=1;
  assert.throws(()=>validatePhysicalRearContactRoadV1(
    groupInput,falseGroup),/differs/);
});
