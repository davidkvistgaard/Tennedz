import test from 'node:test';
import assert from 'node:assert/strict';
import {SPORTING_SKILLS} from '../../lib/engine/v2/skills.mjs';
import {commitTeamChaseStakesV1,
  decideCommittedTeamChaseV1} from
  '../../lib/engine/v2/team-chase-stake-v1.mjs';
import {decideRoadGroupSprintChoiceV1} from
  '../../lib/engine/v2/road-group-sprint-choice-v1.mjs';
import {advanceIsolatedPaidControlRoadV1,
  validateIsolatedPaidControlRoadV1} from
  '../../lib/engine/v2/isolated-paid-control-road-v1.mjs';
import {runIsolatedPaidControlV1,
  validateIsolatedPaidControlRunV1} from
  '../../lib/engine/v2/isolated-paid-control-run-v1.mjs';
import {advanceIsolatedPaidCooperativeRoadV1,
  validateIsolatedPaidCooperativeRoadV1} from
  '../../lib/engine/v2/isolated-paid-cooperative-road-v1.mjs';
import {advancePaidControlChaseHandoffV1,
  validatePaidControlChaseHandoffV1} from
  '../../lib/engine/v2/isolated-paid-control-chase-handoff-v1.mjs';
import {runIsolatedPaidControlChaseV1,
  validateIsolatedPaidControlChaseRunV1} from
  '../../lib/engine/v2/isolated-paid-control-chase-run-v1.mjs';
import {auditIsolatedPaidRoadCoverageV1,
  requireFullPaidRiderCoverageV1} from
  '../../lib/engine/v2/isolated-paid-road-coverage-v1.mjs';

const team=(id,skill)=>{
  const riders=Array.from({length:8},(_,number)=>({
    id:`${id}-${number}`,form:50,fatigue:20,
    ...Object.fromEntries(SPORTING_SKILLS.map(key=>[key,skill]))}));
  return {id,riders,energy:Object.fromEntries(riders.map(row=>
    [row.id,80])),orders:{captainId:riders[0].id,
    helperIds:riders.slice(2).map(row=>row.id),
    baseline:{effort:'steady',chase:id==='observer'?'all':'ignore',
      attack:'none',
      breakWork:'cooperate',
      ...(id==='control'?{frontWork:'rotate',
        frontWorkRiderId:'control-2'}:{})},phases:[]}};
};
const teams=[team('front',70),team('observer',90),
  team('control',60)];
const route=Array.from({length:21},(_,index)=>({km:index+10,
  terrain:'flat',gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const commitment=commitTeamChaseStakesV1({teams,
  distanceKm:30,intentions:teams.map(row=>({teamId:row.id,
    baseline:{goal:row.id==='observer'?'sprint_finish':'none',
      captainId:row.riders[0].id},phases:[]}))});
const group={id:'road-1',riderIds:['front-0'],
  teamIds:['front'],gapSeconds:5};
const committedChoiceInput={commitment,teams,
  roadGroups:[group],observerTeamId:'observer',
  raceSeed:'paid-watch-1',nominatedChaseTeamIds:['observer'],
  remainingSegments:route};
const committedChoice=decideCommittedTeamChaseV1(
  committedChoiceInput);
const frontChoiceInput={roadGroups:[group],groupId:'road-1',
  teams,riderGoals:[{riderId:'front-0',goal:'cooperate'}],
  km:10,distanceKm:30,raceSeed:'paid-watch-1'};
const frontChoice=decideRoadGroupSprintChoiceV1(frontChoiceInput);
const input={committedChoiceInput,committedChoice,
  frontChoiceInput,frontChoice,segment:route[0],
  controlTeamId:'control'};

test('one named control helper pays while the observer waits',()=>{
  assert.equal(committedChoice.choice.assessments[0].action,'watch');
  const road=advanceIsolatedPaidControlRoadV1(input);
  assert.equal(road.bunchLeaderRiderId,'control-2');
  assert.equal(road.frontLeaderRiderId,'front-0');
  assert.equal(road.riders.length,2);
  assert.ok(road.riders.every(row=>row.energySpent>0&&row.energy>=0));
  assert.equal(road.contact,null);
  assert.ok(road.gapSeconds>group.gapSeconds);
  assert.equal(road.endDistanceM,10000);
  assert.equal(road.officialResults,false);
  assert.ok(road.unmodeledRiderIds.includes('observer-2'));
  assert.equal(validateIsolatedPaidControlRoadV1(input,road),true);
  const forged=structuredClone(road);
  forged.riders[1].energySpent=0;
  assert.throws(()=>validateIsolatedPaidControlRoadV1(input,forged),
    /differs/);
  const noWorker=structuredClone(input);
  delete noWorker.committedChoiceInput.teams[2].orders.baseline
    .frontWorkRiderId;
  assert.throws(()=>advanceIsolatedPaidControlRoadV1(noWorker),
    /matching watched road decisions|named helper/);
});

test('a strong paid controller can make contact without observer chase',()=>{
  const fasterTeams=structuredClone(teams);
  for(const rider of fasterTeams[2].riders)for(const skill of SPORTING_SKILLS)
    rider[skill]=99;
  const closeGroup={...group,gapSeconds:.1};
  const choiceInput={...committedChoiceInput,teams:fasterTeams,
    roadGroups:[closeGroup]};
  const frontInput={...frontChoiceInput,teams:fasterTeams,
    roadGroups:[closeGroup]};
  const source={...input,
    committedChoiceInput:choiceInput,
    committedChoice:decideCommittedTeamChaseV1(choiceInput),
    frontChoiceInput:frontInput,
    frontChoice:decideRoadGroupSprintChoiceV1(frontInput)};
  assert.equal(source.committedChoice.choice.assessments[0].action,
    'watch');
  const road=advanceIsolatedPaidControlRoadV1(source);
  assert.equal(road.contact?.kind,'front_bunch_contact');
  assert.ok(road.contact.atDistanceM>9000&&
    road.contact.atDistanceM<10000);
  assert.ok(road.riders.every(row=>row.energySpent>0&&
    row.energySpent<1));
  assert.equal(validateIsolatedPaidControlRoadV1(source,road),true);
});

test('watched kilometres recompute uncertainty and carry paid energy',()=>{
  const runInput={commitment,teams,roadGroup:group,
    observerTeamId:'observer',controlTeamId:'control',
    raceSeed:'paid-watch-1',
    nominatedChaseTeamIds:['observer'],
    frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
    remainingSegments:route};
  const run=runIsolatedPaidControlV1(runInput);
  assert.ok(run.steps.length>1);
  assert.ok(run.steps.every(step=>
    validateIsolatedPaidControlRoadV1(step.paidInput,
      step.road)));
  assert.equal(run.steps[1].paidInput.committedChoiceInput
    .teams[2].energy['control-2'],
  run.steps[0].road.energyByRider['control-2']);
  assert.equal(run.steps[1].paidInput.committedChoiceInput
    .roadGroups[0].gapSeconds,
  run.steps[0].road.gapSeconds);
  assert.ok(run.finalGapSeconds>group.gapSeconds);
  assert.ok(run.handoff,JSON.stringify({
    paidKm:run.steps.length,gap:run.finalGapSeconds}));
  assert.equal(run.handoff.action,'commit_now');
  assert.equal(run.handoff.sourceKm,
    run.steps.at(-1).road.sourceKm+1);
  assert.equal(run.handoff.observedGapSeconds,
    run.finalGapSeconds);
  assert.equal(run.handoff.committedChoiceInput.teams[2]
    .energy['control-2'],
  run.finalTeams[2].energy['control-2']);
  assert.equal(run.officialResults,false);
  assert.equal(validateIsolatedPaidControlRunV1(runInput,run),true);
  const forged=structuredClone(run);
  forged.steps[0].road.riders[1].energySpent=0;
  assert.throws(()=>validateIsolatedPaidControlRunV1(
    runInput,forged),/differs/);
});

test('same-seed controller strength changes paid road outcome',()=>{
  const base={commitment,teams,roadGroup:group,
    observerTeamId:'observer',controlTeamId:'control',
    raceSeed:'paid-watch-1',
    nominatedChaseTeamIds:['observer'],
    frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
    remainingSegments:route};
  const weak=runIsolatedPaidControlV1(base);
  const fasterTeams=structuredClone(teams);
  for(const rider of fasterTeams[2].riders)for(const skill of SPORTING_SKILLS)
    rider[skill]=99;
  const strong=runIsolatedPaidControlV1({...base,teams:fasterTeams});
  const tiredTeams=structuredClone(fasterTeams);
  for(const rider of tiredTeams[2].riders){
    rider.fatigue=85;
    tiredTeams[2].energy[rider.id]=18;
  }
  const tired=runIsolatedPaidControlV1({...base,teams:tiredTeams});
  assert.equal(weak.handoff?.action,'commit_now');
  assert.equal(weak.contact,null);
  assert.equal(strong.contact?.kind,'front_bunch_contact');
  assert.ok(strong.steps.length<weak.steps.length);
  assert.equal(tired.contact?.kind,'front_bunch_contact');
  assert.ok(tired.contact.atDistanceM>
    strong.contact.atDistanceM);
  assert.ok(strong.steps.every(step=>
    validateIsolatedPaidControlRoadV1(step.paidInput,step.road)));
  assert.ok(tired.steps.every(step=>
    validateIsolatedPaidControlRoadV1(step.paidInput,step.road)));
  assert.equal(validateIsolatedPaidControlRunV1(
    {...base,teams:tiredTeams},tired),true);
});

test('control and new chase helpers share one exposed bunch position',()=>{
  const controlRunInput={
    commitment,teams,roadGroup:group,
    observerTeamId:'observer',controlTeamId:'control',
    raceSeed:'paid-watch-1',
    nominatedChaseTeamIds:['observer'],
    frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
    remainingSegments:route};
  const watched=runIsolatedPaidControlV1(controlRunInput);
  const handoff=watched.handoff;
  assert.equal(handoff.action,'commit_now');
  const frontInput={roadGroups:handoff.committedChoiceInput.roadGroups,
    groupId:'road-1',teams:handoff.committedChoiceInput.teams,
    riderGoals:[{riderId:'front-0',goal:'cooperate'}],
    km:handoff.sourceKm,distanceKm:30,
    raceSeed:'paid-watch-1'};
  const source={committedChoiceInput:handoff.committedChoiceInput,
    committedChoice:handoff.committedChoice,
    frontChoiceInput:frontInput,
    frontChoice:decideRoadGroupSprintChoiceV1(frontInput),
    segment:route[handoff.sourceKm-10],
    controlTeamId:'control'};
  const road=advanceIsolatedPaidCooperativeRoadV1(source);
  assert.ok(road.turns.some(row=>
    row.leaderRiderId==='control-2'));
  assert.ok(road.turns.some(row=>
    row.workKind==='chase'));
  assert.equal(road.turns[0].startM,0);
  assert.equal(road.turns.at(-1).endM,1000);
  assert.ok(road.slices.every(slice=>
    slice.riders.filter(row=>row.role==='bunch_leader').length===1&&
    slice.riders.filter(row=>row.role==='front_leader').length===1&&
    slice.riders.every(row=>row.energySpent>0&&row.energy>=0)));
  const controllerTurns=road.slices.map(slice=>({
    metres:slice.endDistanceM-slice.startDistanceM,
    rider:slice.riders.find(row=>row.riderId==='control-2')}));
  assert.equal(controllerTurns.filter(row=>
    row.rider.role==='bunch_leader').length,1);
  assert.ok(controllerTurns.find(row=>
    row.rider.role==='bunch_leader').rider.energySpent/
    controllerTurns.find(row=>
      row.rider.role==='bunch_leader').metres>
    controllerTurns.find(row=>
      row.rider.role==='sheltered').rider.energySpent/
      controllerTurns.find(row=>
        row.rider.role==='sheltered').metres);
  assert.equal(road.contact,null);
  assert.equal(road.officialResults,false);
  assert.equal(validateIsolatedPaidCooperativeRoadV1(source,road),true);
  const forged=structuredClone(road);
  forged.slices[0].riders[1].energySpent=0;
  assert.throws(()=>validateIsolatedPaidCooperativeRoadV1(
    source,forged),/differs/);
  const linkedInput={controlRunInput,controlRun:watched};
  const linked=advancePaidControlChaseHandoffV1(linkedInput);
  assert.deepEqual(linked.cooperativeRoad,road);
  assert.equal(linked.finalTeams[2].energy['control-2'],
    road.energyByRider['control-2']);
  assert.equal(linked.officialResults,false);
  assert.equal(validatePaidControlChaseHandoffV1(
    linkedInput,linked),true);
  const forgedControl=structuredClone(watched);
  forgedControl.finalTeams[2].energy['control-2']+=1;
  assert.throws(()=>advancePaidControlChaseHandoffV1({
    controlRunInput,controlRun:forgedControl}),/replayed paid control/);
});

test('the same road redecides control or chase every kilometre',()=>{
  const source={commitment,teams,roadGroup:group,
    observerTeamId:'observer',controlTeamId:'control',
    raceSeed:'paid-watch-1',
    nominatedChaseTeamIds:['observer'],
    frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
    remainingSegments:route};
  const run=runIsolatedPaidControlChaseV1(source);
  assert.ok(run.steps.some(step=>step.action==='watch'));
  assert.ok(run.steps.some(step=>step.action==='commit_now'));
  assert.ok(run.unresolved,JSON.stringify({
    steps:run.steps.length,gap:run.finalGapSeconds}));
  assert.equal(run.unresolved.action,'capacity_shortfall');
  assert.equal(run.contact,null);
  assert.equal(run.unresolved.sourceKm,
    run.steps.at(-1).road.sourceKm+1);
  assert.ok(run.steps.every(step=>step.action==='watch'?
    validateIsolatedPaidControlRoadV1(step.paidInput,
      step.road):
    validateIsolatedPaidCooperativeRoadV1(step.paidInput,
      step.road)));
  for(let index=1;index<run.steps.length;index++){
    const prior=run.steps[index-1].road;
    const current=run.steps[index].paidInput.committedChoiceInput;
    assert.equal(current.roadGroups[0].gapSeconds,
      prior.gapSeconds);
    for(const [id,energy] of Object.entries(prior.energyByRider)){
      const team=current.teams.find(row=>
        row.riders.some(rider=>rider.id===id));
      assert.equal(team.energy[id],energy);
    }
  }
  assert.equal(run.officialResults,false);
  assert.equal(validateIsolatedPaidControlChaseRunV1(source,run),true);
  const forged=structuredClone(run);
  forged.steps[1].road.gapSeconds+=1;
  assert.throws(()=>validateIsolatedPaidControlChaseRunV1(
    source,forged),/differs/);
});

test('flat and mountain control/chase traces replay fresh and tired',()=>{
  for(const terrain of ['flat','climb'])for(const fatigue of [20,75]){
    const variantTeams=structuredClone(teams);
    for(const team of variantTeams)for(const rider of team.riders){
      rider.fatigue=fatigue;
      if(fatigue>20)team.energy[rider.id]=45;
    }
    const variantRoute=route.map(segment=>({...segment,
      terrain,gradientPct:terrain==='climb'?7:0}));
    const source={commitment,teams:variantTeams,
      roadGroup:group,observerTeamId:'observer',
      controlTeamId:'control',raceSeed:'paid-watch-1',
      nominatedChaseTeamIds:['observer'],
      frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
      remainingSegments:variantRoute};
    const run=runIsolatedPaidControlChaseV1(source);
    assert.ok(run.steps.length>0,
      `${terrain}/${fatigue}`);
    assert.ok(run.steps.every(step=>step.action==='watch'?
      validateIsolatedPaidControlRoadV1(step.paidInput,
        step.road):
      validateIsolatedPaidCooperativeRoadV1(step.paidInput,
        step.road)),`${terrain}/${fatigue}`);
    assert.equal(validateIsolatedPaidControlChaseRunV1(
      source,run),true);
    assert.equal(run.officialResults,false);
  }
});

test('a later chase turn does not erase unpaid earlier rider kilometres',()=>{
  const runInput={commitment,teams,roadGroup:group,
    observerTeamId:'observer',controlTeamId:'control',
    raceSeed:'paid-watch-1',
    nominatedChaseTeamIds:['observer'],
    frontRiderGoals:[{riderId:'front-0',goal:'cooperate'}],
    remainingSegments:route};
  const run=runIsolatedPaidControlChaseV1(runInput);
  const audit=auditIsolatedPaidRoadCoverageV1({runInput,run});
  assert.equal(audit.rosterRiders,24);
  assert.equal(audit.roadKilometres,run.steps.length);
  assert.equal(audit.allRiderKilometresPaid,false);
  assert.ok(audit.missingRiderKilometres>0);
  assert.ok(audit.perKilometre[0].unmodeledRiderIds
    .includes('observer-2'));
  assert.ok(audit.perKilometre.some(row=>
    row.action==='commit_now'&&
    row.modeledRiderIds.includes('observer-2')));
  assert.throws(()=>requireFullPaidRiderCoverageV1({runInput,run}),
    /coverage is incomplete/);
  const forged=structuredClone(run);
  forged.steps[0].road.energyByRider['observer-2']=80;
  assert.throws(()=>auditIsolatedPaidRoadCoverageV1({
    runInput,run:forged}),/replayed paid road run/);
});
