import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../../lib/engine/v2/playtest-rival-intent-v94.mjs';
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
