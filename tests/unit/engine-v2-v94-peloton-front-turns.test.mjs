import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {decideV94PaidBunchWorkersV1} from
  '../../lib/engine/v2/v94-paid-bunch-worker-decisions-v1.mjs';

const settings={distanceKm:120,teamCount:20,terrain:'flat',fatigue:0,
  attack:'none',chase:'selective',seed:'chase-turn-holdout-1-flat-0'};

test('opt-in shared bunch front pays one leader on every road metre',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1});
  assert.equal(recording.frames.length,120);
  assert.ok(recording.frames.some(frame=>
    frame.chaseTurnPlan.status==='worked'&&frame.paidBunchPace));
  for(const frame of recording.frames){
    const plan=frame.pelotonFrontTurnPlan;
    assert.equal(plan.status,'worked');
    assert.equal(plan.turns[0].startM,0);
    assert.equal(plan.turns.at(-1).endM,1000);
    assert.equal(plan.extraEnergyCosts.reduce((sum,row)=>
      sum+row.leadingM,0),1000);
    assert.ok(Math.abs(plan.chasePower-frame.chasePower)<1e-8);
  }
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
  const forged=structuredClone(recording);
  forged.frames.find(frame=>frame.pelotonFrontTurnPlan.turns.length>0)
    .pelotonFrontTurnPlan.turns[0].ability=100;
  assert.throws(()=>replayRaceDynamicsRecording(forged),/differ|invalid/i);
});

test('explicit V94 stakes source-replay named paid bunch worker choices',()=>{
  const sportingStakes=prepareV91Playtest(settings).teams.map(
    (team,index)=>({teamId:team.id,
      goal:index===0?'sprint_finish':'none',
      captainId:team.orders.captainId}));
  const options={format:'one_day',settings,sportingStakes,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1};
  const {recording}=createV94RaceDynamicsPreview(options);
  assert.equal(recording.committedInputs.rivalIntentVersion,5);
  assert.ok(recording.frames.every(frame=>
    frame.pelotonRiderDecisions.length===
    frame.pelotonFrontTurnPlan.turns.length));
  for(const frame of recording.frames){
    for(const choice of frame.pelotonRiderDecisions){
      const turn=frame.pelotonFrontTurnPlan.turns.find(row=>
        row.leaderRiderId===choice.riderId);
      assert.equal(choice.sourceKm,frame.km);
      assert.equal(choice.teamId,turn.teamId);
      assert.equal(choice.startM,turn.startM);
      assert.equal(choice.endM,turn.endM);
      assert.equal(choice.goal,sportingStakes.find(row=>
        row.teamId===choice.teamId).goal);
      assert.ok(choice.paidExtraCost>0);
    }
  }
  assert.deepEqual(replayRaceDynamicsRecording(recording),recording);
  const forged=structuredClone(recording);
  forged.frames[0].pelotonRiderDecisions[0].goal='summit_attack';
  assert.throws(()=>replayRaceDynamicsRecording(forged),
    /paid worker choices differ/);
  const chaseFrame=recording.frames.find(frame=>
    frame.pelotonFrontTurnPlan.turns.some(turn=>
      turn.workKind==='chase'));
  assert.ok(chaseFrame);
  assert.throws(()=>decideV94PaidBunchWorkersV1({
    plan:chaseFrame.pelotonFrontTurnPlan,
    teams:recording.committedInputs.teams,
    intent:recording.committedInputs.rivalIntent,
    chaseContributions:[],km:chaseFrame.km}),
  /Paid worker choice differs/);
  const historical=createV94RaceDynamicsPreview({
    ...options,sportingStakes:null}).recording;
  assert.ok(historical.frames.every(frame=>
    !Object.hasOwn(frame,'pelotonRiderDecisions')));
});

test('opt-in peloton draft lowers sourced follower base cost',()=>{
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'none',
    captainId:team.orders.captainId}));
  const options={format:'one_day',settings,sportingStakes,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1};
  const historical=createV94RaceDynamicsPreview(options).recording;
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,sportingStakes:null,pelotonDraftCostVersion:1}),
  /valid experimental race settings/);
  const drafted=createV94RaceDynamicsPreview({
    ...options,pelotonDraftCostVersion:1}).recording;
  const frame=drafted.frames[0];
  assert.equal(frame.pelotonFrontTurnPlan.status,'worked');
  const follower=frame.pelotonDraftCosts.find(row=>
    row.leadingM===0&&!frame.breakawayRiderIds.includes(row.riderId));
  assert.ok(follower);
  assert.equal(follower.sourceKm,1);
  assert.equal(follower.baseCostFraction,.8);
  const cost=frame.energyLedger.find(row=>
    row.riderId===follower.riderId).requestedWorkDemand;
  const oldCost=historical.frames[0].energyLedger.find(row=>
    row.riderId===follower.riderId).requestedWorkDemand;
  assert.ok(cost<oldCost);
  assert.ok(frame.pelotonDraftCosts.some(row=>
    row.leadingM>0&&row.baseCostFraction>.8));
  assert.deepEqual(replayRaceDynamicsRecording(drafted),drafted);
  const forged=structuredClone(drafted);
  forged.frames[0].pelotonDraftCosts.find(row=>
    row.riderId===follower.riderId).baseCostFraction=1;
  assert.throws(()=>replayRaceDynamicsRecording(forged),
    /draft costs differ/);
  assert.ok(historical.frames.every(row=>
    !Object.hasOwn(row,'pelotonDraftCosts')));
});

test('strict draft refuses a rider lost during discounted kilometre',()=>{
  const longSettings={...settings,distanceKm:260};
  const sportingStakes=prepareV91Playtest(longSettings).teams.map(
    team=>({teamId:team.id,goal:'none',
      captainId:team.orders.captainId}));
  assert.throws(()=>createV94RaceDynamicsPreview({
    format:'one_day',settings:longSettings,sportingStakes,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:2}),
  error=>{
    assert.match(error.message,/Unresolved peloton draft contact/);
    assert.equal(error.sourceKm,140);
    assert.equal(error.sourceEvidence.riderId,'rival-14-0');
    assert.equal(error.sourceEvidence.priorGroup,'peloton');
    assert.equal(error.sourceEvidence.finalGroup,'dropped');
    return true;
  });
});

test('strict peloton loss refuses a drop without paid within-km contact',()=>{
  const longSettings={...settings,distanceKm:260};
  assert.throws(()=>createV94RaceDynamicsPreview({
    format:'one_day',settings:longSettings,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
    pelotonDropContactVersion:1}),error=>{
    assert.match(error.message,/Unresolved peloton drop contact/);
    assert.equal(error.sourceEvidence.priorGroup,'peloton');
    assert.equal(error.sourceEvidence.finalGroup,'dropped');
    assert.ok(error.sourceEvidence.finalDeficitSeconds>
      error.sourceEvidence.priorDeficitSeconds);
    assert.equal(error.sourceEvidence.energyLedger.riderId,
      error.sourceEvidence.riderId);
    return true;
  });
  assert.throws(()=>createV94RaceDynamicsPreview({
    format:'one_day',settings:longSettings,
    pelotonDropContactVersion:1}),
  /valid experimental race settings/);
});

test('fresh paid attackers receive source-replayed launch choices',()=>{
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'none',
    captainId:team.orders.captainId}));
  const options={format:'one_day',settings,sportingStakes,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
    freshAttackDecisionVersion:1};
  const {recording}=createV94RaceDynamicsPreview(options);
  const launches=recording.frames.filter(frame=>
    frame.attackers.length);
  assert.ok(launches.length>0);
  for(const frame of recording.frames){
    assert.equal(frame.freshAttackRiderDecisions.length,
      frame.attackers.length);
    for(const row of frame.freshAttackRiderDecisions){
      assert.equal(row.sourceKm,frame.km);
      assert.ok(frame.attackers.includes(row.riderId));
      assert.equal(row.choice,'launch_paid_attack');
      assert.ok(row.paidExtraCost>0);
      assert.ok(row.attackPressure>0);
    }
  }
  assert.deepEqual(replayRaceDynamicsRecording(recording),recording);
  const forged=structuredClone(recording);
  forged.frames.find(frame=>frame.attackers.length)
    .freshAttackRiderDecisions[0].goal='break_stage';
  assert.throws(()=>replayRaceDynamicsRecording(forged),
    /fresh attack choices differ/);
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,sportingStakes:null}),
  /valid experimental race settings/);
});

test('historical opt-in chase version retains its separate road contract',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
    chaseTurnVersion:1,bunchFrontTurnVersion:1});
  assert.equal(recording.frames.length,120);
  assert.ok(recording.frames.every(frame=>
    !Object.hasOwn(frame,'pelotonFrontTurnPlan')));
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
});

test('simultaneous attack and paid pursuit refuses with source facts',()=>{
  const mountain={distanceKm:120,teamCount:20,
    terrain:'mountain',fatigue:30,
    attack:'none',chase:'selective',
    seed:'chase-turn-holdout-1-mountain-30'};
  assert.throws(()=>createV94RaceDynamicsPreview({
    format:'one_day',settings:mountain,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1}),
  error=>{
    assert.match(error.message,
      /Combined fresh attack and paid pursuit/);
    assert.equal(error.sourceKm,80);
    const evidence=error.sourceEvidence;
    assert.equal(evidence.segment.km,80);
    assert.ok(evidence.attackers.length>0);
    assert.ok(evidence.attackers.every(row=>
      row.riderId&&row.teamId&&
      Number.isFinite(row.energyBefore)&&
      Number.isFinite(row.abstractPressure)&&
      row.teamOrderEffort));
    assert.equal(evidence.paidBunchTurns[0].startM,0);
    assert.equal(evidence.paidBunchTurns.at(-1).endM,
      1000);
    assert.ok(evidence.paidBunchTurns.some(row=>
      row.workKind==='chase'));
    return true;
  });
});
