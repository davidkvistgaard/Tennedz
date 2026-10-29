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
