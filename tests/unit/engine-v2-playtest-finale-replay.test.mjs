import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidFinaleReplay,
  summarizeV91PaidNamedAttackApproach,
  summarizeV91PaidSoloApproach} from
  '../../lib/engine/v2/playtest-finale-replay.mjs';

const settings={distanceKm:40,terrain:'flat',teamCount:4,gender:'M',
  fatigue:0,effort:'steady',attack:'none',chase:'ignore',
  defaultRivalPlan:'chase',seed:'early-test'};

test('browser finale replay connects a paid bunch handoff to every crossing',()=>{
  const scenario={settings,finalePlans:[{teamId:'you',
    finisherId:'you-7',leadOutRiderId:'you-5'}]};
  const {summary,recording}=runV91IntegratedTestDrive(scenario,{full:true});
  const replay=summarizeV91PaidFinaleReplay(recording);
  assert.equal(replay.status,'complete_paid_trace');
  assert.equal(replay.handoffDistanceM,39_000);
  assert.equal(replay.lineDistanceM,40_000);
  assert.equal(replay.frames[0].riders.length,32);
  assert.equal(replay.frames.at(-1).riders.length,32);
  const finisher=summary.finale.lineTimes.find(row=>row.riderId==='you-7');
  const last=replay.frames.at(-1).riders.find(row=>row.riderId==='you-7');
  assert.equal(last.positionM,replay.lineDistanceM);
  assert.equal(last.elapsedToLineSeconds,
    finisher.elapsedSecondsFromLastKmStart);
  assert.equal(last.energyAfter,finisher.energyAtLine);
  assert.ok(replay.frames.some(frame=>frame.riders.some(row=>
    row.riderId==='you-5'&&row.role.startsWith('lead_out')&&
    row.energySpent>0)));
  assert.deepEqual(JSON.parse(JSON.stringify(replay)),replay);
  assert.equal(summarizeV91PaidSoloApproach(recording),null);
  recording.paidFinale.frames[1].riders[0].energyAtDecision+=1;
  assert.throws(()=>summarizeV91PaidFinaleReplay(recording),
    /lost rider travel or energy/);
});

test('a contact-only tail is not presented as a full final-kilometre replay',()=>{
  const scenario={settings:{...settings,seed:'integrated-probe',
    managerTactics:Array.from({length:3},()=>({effort:'steady',
      attack:'none',chase:'ignore'}))},
  attack:{teamId:'you',riderId:'you-0'},
  finalePlans:[{teamId:'rival-1',finisherId:'rival-1-7',
    leadOutRiderId:'rival-1-6'}]};
  const {summary,recording}=runV91IntegratedTestDrive(scenario,{full:true});
  assert.equal(summary.finale.lineTimes.length,32);
  assert.equal(summarizeV91PaidFinaleReplay(recording),null);
  const approach=summarizeV91PaidSoloApproach(recording);
  assert.deepEqual(Object.keys(approach),['version','attackRiderId',
    'handoffDistanceM','lastBoundaryM','frames']);
  assert.equal(approach.handoffDistanceM,39_000);
  assert.equal(approach.lastBoundaryM,39_500);
  assert.deepEqual(approach.frames.map(frame=>frame.distanceM),
    [39_250,39_500]);
  assert.deepEqual(approach.frames.map(frame=>frame.roadGroups[0]
    .riderIds),[['you-0'],['you-0']]);
  assert.ok(approach.frames.every(frame=>frame.riders.length===32));
  const first=approach.frames[0].riders.find(row=>row.riderId==='you-0');
  const second=approach.frames[1].riders.find(row=>row.riderId==='you-0');
  assert.equal(first.role,'attack');
  assert.equal(second.role,'front');
  assert.equal(first.energyAfter-second.energySpent,second.energyAfter);
  assert.deepEqual(JSON.parse(JSON.stringify(approach)),approach);
});

test('coordinated chase catches the same named solo on a fixed route and roster',()=>{
  const shared={distanceKm:120,terrain:'rolling',teamCount:15,
    gender:'F',fatigue:15,effort:'steady',attack:'none',chase:'ignore',
    seed:'integrated-probe'};
  const scenario=defaultRivalPlan=>({settings:{...shared,
    defaultRivalPlan},attack:{teamId:'you',riderId:'you-0'}});
  const passive=runV91IntegratedTestDrive(scenario('passive'),{full:true});
  const chase=runV91IntegratedTestDrive(scenario('chase'),{full:true});
  assert.deepEqual(passive.recording.recording.committedInputs.teams
    .map(team=>team.riders),chase.recording.recording.committedInputs.teams
    .map(team=>team.riders));
  assert.equal(passive.recording.roadDecision.branch,'solo');
  assert.equal(chase.recording.roadDecision.branch,'caught');
  const caughtApproach=summarizeV91PaidNamedAttackApproach(
    chase.recording);
  assert.equal(caughtApproach.branch,'caught');
  assert.deepEqual(caughtApproach.frames.map(frame=>frame.distanceM),
    [119_250,119_500]);
  assert.deepEqual(caughtApproach.frames.map(frame=>
    frame.roadGroups.length),[1,0]);
  assert.ok(caughtApproach.frames[1].catchDistanceM>119_250);
  assert.ok(caughtApproach.frames[1].catchDistanceM<119_500);
  assert.ok(caughtApproach.frames.every(frame=>frame.riders.length===120));
  assert.equal(caughtApproach.frames[1].pelotonRiderCount,120);
  assert.equal(summarizeV91PaidSoloApproach(chase.recording),null);
  assert.equal(passive.summary.finale.lineTimes.length,120);
  assert.equal(chase.summary.finale.lineTimes.length,120);
  const own=output=>output.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7');
  assert.notEqual(own(passive).elapsedSecondsFromLastKmStart,
    own(chase).elapsedSecondsFromLastKmStart);
  assert.equal(passive.summary.pointsStatus,'withheld');
  assert.equal(chase.summary.pointsStatus,'withheld');
});

test('a nominated helper pays for a lead-out after the same named solo is caught',()=>{
  const settings={distanceKm:120,terrain:'rolling',teamCount:15,
    gender:'F',fatigue:15,effort:'steady',attack:'none',chase:'ignore',
    defaultRivalPlan:'chase',seed:'integrated-probe'};
  const base={settings,attack:{teamId:'you',riderId:'you-0'}};
  const without=runV91IntegratedTestDrive(base,{full:true});
  const withHelper=runV91IntegratedTestDrive({...base,finalePlans:[{
    teamId:'you',finisherId:'you-7',leadOutRiderId:'you-5'}]},
  {full:true});
  assert.equal(without.recording.roadDecision.branch,'caught');
  assert.equal(withHelper.recording.roadDecision.branch,'caught');
  assert.deepEqual(without.recording.recording.committedInputs.teams
    .map(team=>team.riders),withHelper.recording.recording.committedInputs.teams
    .map(team=>team.riders));
  const helperWork=withHelper.summary.finale.leadOutWork.filter(row=>
    row.riderId==='you-5');
  assert.ok(helperWork.length>0);
  assert.ok(helperWork.every(row=>row.energySpent>0));
  const approach=summarizeV91PaidNamedAttackApproach(withHelper.recording);
  const atHandoff=new Map(approach.frames.at(-1).riders.map(row=>
    [row.riderId,row.energyAfter]));
  assert.ok(withHelper.recording.paidFinale.frames[0].riders.every(row=>
    Math.abs(row.energyAtDecision-atHandoff.get(row.riderId))<1e-6));
  withHelper.recording.paidFinale.frames[0].riders[0].energyAtDecision+=1;
  assert.throws(()=>summarizeV91PaidNamedAttackApproach(
    withHelper.recording),/missed the finale handoff/);
  assert.equal(withHelper.summary.finale.lineTimes.length,120);
  const finisher=output=>output.summary.finale.lineTimes.find(row=>
    row.riderId==='you-7');
  assert.notEqual(finisher(without).elapsedSecondsFromLastKmStart,
    finisher(withHelper).elapsedSecondsFromLastKmStart);
  assert.equal(withHelper.summary.pointsStatus,'withheld');
});
