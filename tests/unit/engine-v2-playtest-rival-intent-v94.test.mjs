import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../../lib/engine/v2/tuning.mjs';

test('v94 rival intent is seeded, inspectable and leaves explicit orders intact',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4,
    seed:'intent-1',attack:'none',chase:'selective',
    managerTactics:[{effort:'hard',attack:'none',chase:'all'}],
    managerTacticOverrides:[{teamId:'rival-3',effort:'hard',
      attack:'repeated',chase:'all'}]});
  const before=structuredClone(prepared.teams);
  const first=prepareV94RivalIntent({prepared,format:'one_day'});
  const again=prepareV94RivalIntent({prepared,format:'one_day'});
  assert.deepEqual(first,again);
  assert.deepEqual(prepared.teams,before);
  assert.equal(first.intent.length,4);
  assert.equal(first.intent[0].role,'control');
  assert.deepEqual(first.intent[1],{teamId:'rival-1',role:'control',
    source:'manager',baseline:{effort:'hard',attack:'none',chase:'all'},
    specialistRiderId:null});
  assert.deepEqual(first.teams[1].orders.baseline,before[1].orders.baseline);
  assert.equal(first.intent[2].source,'generated');
  assert.deepEqual(first.intent[3],{teamId:'rival-3',role:'opportunistic',
    source:'manager',baseline:{effort:'hard',attack:'repeated',chase:'all'},
    specialistRiderId:null});
  assert.deepEqual(first.raceContext.teamRoles,
    Object.fromEntries(first.intent.map(row=>[row.teamId,row.role])));
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:first.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext:first.raceContext,
    rivalIntent:first.intent});
  assert.equal(validateRecordedTour(recording),true);
  assert.deepEqual(replayRaceDynamicsRecording(recording),recording);
  assert.deepEqual(recording.committedInputs.raceContext,first.raceContext);
  assert.equal(recording.committedInputs.rivalIntentVersion,2);
  assert.equal(recording.committedInputs.rivalIntent.find(row=>
    row.teamId==='rival-3').source,'manager');
  const forged=structuredClone(recording);
  forged.committedInputs.rivalIntent.find(row=>
    row.teamId==='rival-3').role='protect';
  assert.throws(()=>validateRecordedTour(forged),/intent manifest/);
  const committedRival=recording.committedInputs.teams.find(team=>
    team.id==='rival-1');
  for(const key of ['effort','attack','chase'])
    assert.equal(committedRival.orders.baseline[key],before[1].orders.baseline[key]);
});

test('a previously committed protective manager still source-replays',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4,
    seed:'prior-manager-protective-role',attack:'none',chase:'selective'});
  const plan=prepareV94RivalIntent({prepared,format:'stage',stageNumber:8});
  const priorContext={...plan.raceContext,
    teamRoles:{...plan.raceContext.teamRoles,you:'protect'}};
  const priorIntent=plan.intent.map(row=>row.teamId==='you'?
    {...row,role:'protect'}:row);
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:priorContext,rivalIntent:priorIntent});
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(replayRaceDynamicsRecording(race),race);
});

test('v94 rival intent rejects incomplete stage context',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4});
  assert.throws(()=>prepareV94RivalIntent({prepared,format:'stage'}),
    /Invalid race context/);
});

test('previous v94 intent manifest remains replayable without a specialist',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4,
    seed:'intent-v1-compatibility',attack:'none',chase:'ignore'});
  const plan=prepareV94RivalIntent({prepared,format:'stage',stageNumber:8});
  const oldIntent=plan.intent.map(({specialistRiderId,...row})=>row);
  const race=simulateTacticalTour({stage:prepared.stage,weather:prepared.weather,
    teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext:plan.raceContext,
    rivalIntent:oldIntent});
  assert.equal(race.committedInputs.rivalIntentVersion,1);
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(replayRaceDynamicsRecording(race),race);
});

test('a declared rival goal commits a role and matching orders before racing',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4,
    seed:'intent-goal-94',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive'});
  const breakPlan=prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:[{teamId:'rival-1',role:'break'}]});
  const controlPlan=prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:[{teamId:'rival-1',role:'control'}]});
  assert.equal(breakPlan.intent[1].source,'manager_goal');
  assert.ok(breakPlan.intent[1].specialistRiderId);
  assert.notEqual(breakPlan.intent[1].specialistRiderId,
    breakPlan.teams[1].orders.captainId);
  assert.deepEqual(breakPlan.teams[1].orders.baseline,
    {effort:'steady',attack:'repeated',chase:'ignore'});
  assert.deepEqual(controlPlan.teams[1].orders.baseline,
    {effort:'steady',attack:'none',chase:'selective'});
  const race=plan=>simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext:plan.raceContext,
    rivalIntent:plan.intent});
  const breakRace=race(breakPlan),controlRace=race(controlPlan);
  assert.ok(breakRace.frames.some(frame=>frame.attackers.some(id=>
    id.startsWith('rival-1-'))));
  assert.ok(controlRace.frames.every(frame=>frame.attackers.every(id=>
    !id.startsWith('rival-1-'))));
  assert.equal(validateRecordedTour(breakRace),true);
  assert.equal(validateRecordedTour(controlRace),true);
  const opening=breakRace.frames.find(frame=>frame.attackers.some(id=>
    breakPlan.teams[1].riders.some(rider=>rider.id===id)));
  assert.ok(opening.attackers.includes(breakPlan.intent[1].specialistRiderId));
  const forged=structuredClone(breakRace);
  forged.committedInputs.rivalIntent[1].specialistRiderId=
    breakPlan.teams[1].orders.captainId;
  assert.throws(()=>validateRecordedTour(forged),/intent manifest/);
  assert.throws(()=>prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:[{teamId:'rival-1',role:'break'},
      {teamId:'rival-1',role:'control'}]}),/Invalid or conflicting/);
  const withTactic=prepareV91Playtest({distanceKm:40,teamCount:4,
    managerTactics:[{effort:'hard',attack:'none',chase:'all'}]});
  assert.throws(()=>prepareV94RivalIntent({prepared:withTactic,
    format:'one_day',rivalGoals:[{teamId:'rival-1',role:'break'}]}),
  /Invalid or conflicting/);
});

test('opt-in control tempo commits paid front work without changing explicit manager tactics',()=>{
  const prepared=prepareV91Playtest({distanceKm:120,teamCount:4,
    seed:'control-tempo-intent',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',managerTactics:[
      {effort:'hard',attack:'none',chase:'all'}]});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    controlTempoVersion:2,rivalGoals:[{teamId:'rival-2',role:'control'}]});
  assert.equal(plan.teams[1].orders.baseline.frontWork,undefined);
  assert.equal(plan.teams[2].orders.baseline.frontWork,'rotate');
  assert.equal(plan.intent[1].baseline.frontWork,null);
  assert.equal(plan.intent[2].baseline.frontWork,'rotate');
  const race=simulateTacticalTour({stage:prepared.stage,weather:prepared.weather,
    teams:plan.teams,seed:prepared.seed,motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:plan.raceContext,rivalIntent:plan.intent});
  assert.equal(race.committedInputs.rivalIntentVersion,3);
  assert.ok(race.frames.some(frame=>frame.paidBunchPace?.teamId==='rival-2'));
  assert.ok(race.frames.every(frame=>
    !(frame.chasers.includes('rival-2')&&
      frame.paidBunchPace?.teamId==='rival-2')));
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(replayRaceDynamicsRecording(race),race);
  const forged=structuredClone(race);
  forged.committedInputs.rivalIntent.find(row=>row.teamId==='rival-2')
    .baseline.frontWork=null;
  assert.throws(()=>validateRecordedTour(forged),/intent manifest/);
  assert.throws(()=>prepareV94RivalIntent({prepared,format:'one_day',
    controlTempoVersion:3}),/Invalid v94 rival intent inputs/);
});

test('opt-in opportunistic specialist preserves captains and old manifests',()=>{
  const prepared=prepareV91Playtest({distanceKm:120,teamCount:4,
    seed:'opportunistic-specialist-94',attack:'none',chase:'ignore',
    defaultRivalPlan:'passive',managerTactics:[
      {effort:'steady',attack:'selective',chase:'ignore'}]});
  const plan=prepareV94RivalIntent({prepared,format:'stage',stageNumber:8,
    opportunisticSpecialistVersion:2,rivalGoals:[
      {teamId:'rival-2',role:'opportunistic'}]});
  assert.equal(plan.intent[1].source,'manager');
  assert.equal(plan.intent[1].specialistRiderId,null);
  assert.equal(plan.intent[2].source,'manager_goal');
  assert.ok(plan.intent[2].specialistRiderId);
  assert.notEqual(plan.intent[2].specialistRiderId,
    plan.teams[2].orders.captainId);
  assert.ok(plan.intent.every(row=>row.specialistPolicyVersion===2));
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext:plan.raceContext,
    rivalIntent:plan.intent});
  assert.equal(race.committedInputs.rivalIntentVersion,4);
  const first=race.frames.find(frame=>frame.attackers.some(id=>
    id.startsWith('rival-2-')));
  assert.ok(first?.attackers.includes(plan.intent[2].specialistRiderId));
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(replayRaceDynamicsRecording(race),race);
  const forged=structuredClone(race);
  forged.committedInputs.rivalIntent[2].specialistPolicyVersion=1;
  assert.throws(()=>validateRecordedTour(forged),/intent manifest/);
});

test('a paid control chase lets non-working peloton teams rest without easing road pace',()=>{
  const prepared=prepareV91Playtest({distanceKm:260,terrain:'flat',teamCount:20,
    fatigue:0,attack:'none',chase:'ignore',seed:'manager-goal-1',
    defaultRivalPlan:'passive'});
  const plan=prepareV94RivalIntent({prepared,format:'one_day',
    rivalGoals:[{teamId:'rival-1',role:'control'}]});
  const race=simulateTacticalTour({stage:prepared.stage,weather:prepared.weather,
    teams:plan.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext:plan.raceContext,
    rivalIntent:plan.intent});
  const frame=race.frames[99];
  assert.ok(frame.chasers.includes('rival-1'));
  assert.deepEqual(frame.bunchEaseTeamIds,[]);
  assert.ok(frame.pelotonRestTeamIds.length>=10);
  assert.ok(frame.pelotonRestTeamIds.every(id=>!frame.chasers.includes(id)));
  assert.equal(validateRecordedTour(race),true);
  const forged=structuredClone(race);
  forged.frames[99].pelotonRestTeamIds=[];
  assert.throws(()=>validateRecordedTour(forged),/peloton rest/);
});

test('explicit V94 sporting stakes commit every named captain without changing old intent',()=>{
  const settings={distanceKm:40,teamCount:4,
    seed:'explicit-stakes-1',attack:'none',chase:'selective'};
  const prepared=prepareV91Playtest(settings);
  const sportingStakes=prepared.teams.map((team,index)=>({
    teamId:team.id,
    goal:index===0?'sprint_finish':
      index===1?'summit_attack':'none',
    captainId:team.orders.captainId}));
  const input={prepared,format:'one_day',
    controlTempoVersion:2,
    opportunisticSpecialistVersion:2};
  const historical=prepareV94RivalIntent(input);
  const plan=prepareV94RivalIntent({
    ...input,sportingStakes});
  assert.deepEqual(plan.teams,historical.teams);
  assert.ok(historical.intent.every(row=>
    !Object.hasOwn(row,'sportingGoal')));
  assert.deepEqual(plan.intent.map(row=>({
    teamId:row.teamId,goal:row.sportingGoal,
    captainId:row.sportingCaptainId})),
  sportingStakes);
  assert.throws(()=>prepareV94RivalIntent({
    ...input,sportingStakes:sportingStakes.slice(1)}),
  /every team/);
  assert.throws(()=>prepareV94RivalIntent({
    ...input,sportingStakes:[{...sportingStakes[0],
      captainId:'absent'},...sportingStakes.slice(1)]}),
  /named captain/);
  const race=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:plan.teams,
    seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,
    raceContext:plan.raceContext,rivalIntent:plan.intent});
  assert.equal(race.committedInputs.rivalIntentVersion,5);
  assert.equal(validateRecordedTour(race),true);
  assert.deepEqual(replayRaceDynamicsRecording(race),race);
  const forged=structuredClone(race);
  forged.committedInputs.rivalIntent[0]
    .sportingCaptainId='absent';
  assert.throws(()=>validateRecordedTour(forged),
    /intent manifest/);
  const {recording,preview}=
    createV94RaceDynamicsPreview({
      settings,format:'one_day',
      sportingStakes});
  assert.equal(recording.committedInputs
    .rivalIntentVersion,5);
  assert.equal(preview.policy.rivalIntentVersion,5);
  assert.equal(preview.teamPlans.find(row=>
    row.teamId==='you').sportingGoal,
  'sprint_finish');
});

test('opt-in protector pursuit requires a named sprint stake still in the bunch',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'flat',fatigue:0,
    attack:'none',chase:'selective',seed:'chase-turn-holdout-1-flat-0'};
  const prepared=prepareV91Playtest(settings);
  const stakes=goal=>prepared.teams.map(team=>({teamId:team.id,goal,
    captainId:team.orders.captainId}));
  const options={format:'one_day',settings,roadGroupPaceVersion:3,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,protectorSportingPursuitVersion:1};
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,sportingStakes:null}),/experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,roadGroupPaceVersion:2,
    sportingStakes:stakes('sprint_finish')}),
  /experimental race settings/);
  const historic=createV94RaceDynamicsPreview({
    ...options,protectorSportingPursuitVersion:0,
    sportingStakes:stakes('none')}).recording;
  const noStake=createV94RaceDynamicsPreview({
    ...options,sportingStakes:stakes('none')}).recording;
  const sprint=createV94RaceDynamicsPreview({
    ...options,sportingStakes:stakes('sprint_finish')}).recording;
  const protectChoices=race=>race.frames.flatMap(frame=>
    frame.chaseReasons.filter(row=>row.reason===
      'one_day_captain_pursuit'));
  assert.ok(protectChoices(historic).length>0);
  assert.equal(protectChoices(noStake).length,0);
  assert.ok(noStake.frames.some(frame=>frame.chasePower>0));
  assert.ok(protectChoices(sprint).length>0);
  assert.equal(validateRecordedTour(noStake),true);
  assert.deepEqual(replayRaceDynamicsRecording(sprint),sprint);
  const forged=structuredClone(sprint);
  const pursuing=protectChoices(forged)[0].teamId;
  forged.committedInputs.rivalIntent.find(row=>
    row.teamId===pursuing).sportingGoal='none';
  assert.throws(()=>validateRecordedTour(forged),
    /chase reason|source|recording/i);
});

test('opt-in protector timing uses observed paid front pace and own helpers',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'flat',fatigue:0,
    attack:'none',chase:'selective',seed:'chase-turn-holdout-1-flat-0'};
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'sprint_finish',
    captainId:team.orders.captainId}));
  const options={format:'one_day',settings,sportingStakes,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
    protectorSportingPursuitVersion:1};
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,protectorSportingPursuitVersion:0,
    protectorPursuitTimingVersion:1}),
  /experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,format:'stage',protectorPursuitTimingVersion:1}),
  /experimental race settings/);
  const earlier=createV94RaceDynamicsPreview(options).recording;
  const timed=createV94RaceDynamicsPreview({
    ...options,protectorPursuitTimingVersion:1}).recording;
  assert.equal(earlier.frames.find(frame=>frame.chasePower>0).km,70);
  assert.ok(timed.frames.find(frame=>frame.chasePower>0).km<70);
  const choices=timed.frames.flatMap(frame=>
    frame.protectorPursuitDecisions);
  assert.ok(choices.length>0);
  assert.ok(choices.some(row=>row.choice==='chase'&&
    row.observedFrontLeadAbility!==null&&
    row.ownHelpers.length>0));
  assert.equal(validateRecordedTour(timed),true);
  assert.deepEqual(replayRaceDynamicsRecording(timed),timed);
  const forged=structuredClone(timed);
  forged.frames.find(frame=>frame.protectorPursuitDecisions.length)
    .protectorPursuitDecisions[0].ownLeadAbility=0;
  assert.throws(()=>validateRecordedTour(forged),
    /protector timing/);
});
