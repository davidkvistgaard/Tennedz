import test from 'node:test';
import assert from 'node:assert/strict';
import {runV91IntegratedTestDrive} from
  '../../scripts/engine-v2-test-drive.mjs';
import {summarizeV91PaidFinaleReplay,
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
