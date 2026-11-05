import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  '../../lib/engine/v2/physical-first-whole-race-replay-v1.mjs';
import {calibratePhysicalFirstFinishV1} from
  '../../lib/engine/v2/physical-first-finish-calibration-v1.mjs';

test('same-seed attack pays contact and reaches a replayed finish',t=>{
  const settings={distanceKm:40,teamCount:4,
    terrain:'flat',fatigue:0,attack:'none',
    chase:'selective',seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings)
    .teams.map(team=>({teamId:team.id,
      goal:team.id==='rival-1'?'break_stage':
        'sprint_finish',
      captainId:team.orders.captainId}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    rivalGoals:[
      {teamId:'rival-1',role:'break'},
      {teamId:'rival-2',role:'protect'},
      {teamId:'rival-3',role:'protect'}],
    ownFrontWork:'rotate',roadGroupPaceVersion:3,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,
    roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1});
  const {teams,rivalIntent}=recording.committedInputs;
  const kilometres=recording.route.kilometres;
  const riders=teams.flatMap(team=>team.riders.map(
    rider=>({riderId:rider.id,teamId:team.id,
      roadId:'peloton',distanceM:0,
      clockSeconds:0,reserve:replayRearEnergyCapV1({
        rider,kilometres,throughKm:0}).initialCap,
      quietKm:0})));
  const start={sourceKm:0,
    roads:[{roadId:'peloton',
      riderIds:riders.map(row=>row.riderId),
      clockSeconds:0}],riders};
  assert.equal(recording.frames.reduce((sum,frame)=>
    sum+frame.attackers.length,0),1);
  const fullInput={
    start,kilometres,teams,stakes:rivalIntent,
    raceSeed:recording.raceSeed};
  const full=runPhysicalFirstWholeRaceProbeV1(
    fullInput);
  assert.equal(full.completedThroughKm,40);
  assert.equal(full.states.at(-1).riders.length,32);
  assert.ok(full.states.at(-1).riders.every(row=>
    row.distanceM===40000));
  assert.equal(replayPhysicalFirstWholeRaceV1(
    fullInput,full).validatedRiderKm,1280);
  assert.equal(full.steps.reduce((sum,step)=>
    sum+step.attackSteps.length,0),1);
  assert.equal(full.steps[9].attackChoices.find(row=>
    row.teamId==='rival-1').choice,
  'hold_unhelpful_forward_bridge');
  const calibration=calibratePhysicalFirstFinishV1(
    recording,full);
  t.diagnostic(`40 km attack finish mismatches:
    ${calibration.mismatchCount}/32; maximum
    ${calibration.maxAbsoluteMismatchSeconds}s;
    paid attacks: ${full.steps.reduce((sum,step)=>
      sum+step.attackSteps.length,0)};
    mismatch riders: ${calibration.comparisons
      .filter(row=>Math.abs(
        row.claimedMinusPaidSeconds)>.002)
      .map(row=>row.riderId).join(', ')}`);
  assert.equal(calibration.validatedKm,40);
  assert.equal(calibration.riderCount,32);
  assert.equal(calibration.mismatchCount,1);
  assert.ok(calibration.maxAbsoluteMismatchSeconds<61);
});

test('same-seed mountain attack replays every rider-kilometre',t=>{
  const settings={distanceKm:120,teamCount:20,
    terrain:'mountain',fatigue:0,attack:'selective',
    chase:'selective',seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings)
    .teams.map(team=>({teamId:team.id,
      goal:team.id==='you'?'summit_attack':'none',
      captainId:team.orders.captainId}));
  const rivalGoals=Array.from({length:19},
    (_,index)=>({teamId:`rival-${index+1}`,
      role:'protect'}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    rivalGoals,ownFrontWork:'rotate',
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,
    pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,
    roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1});
  const {teams,rivalIntent}=recording.committedInputs;
  const kilometres=recording.route.kilometres;
  const riders=teams.flatMap(team=>team.riders.map(
    rider=>({riderId:rider.id,teamId:team.id,
      roadId:'peloton',distanceM:0,clockSeconds:0,
      reserve:replayRearEnergyCapV1({
        rider,kilometres,throughKm:0}).initialCap,
      quietKm:0})));
  const start={sourceKm:0,
    roads:[{roadId:'peloton',
      riderIds:riders.map(row=>row.riderId),
      clockSeconds:0}],riders};
  const input={start,kilometres,teams,
    stakes:rivalIntent,raceSeed:recording.raceSeed};
  const race=runPhysicalFirstWholeRaceProbeV1(input);
  assert.equal(race.completedThroughKm,120);
  assert.equal(race.states.at(-1).riders.length,160);
  assert.ok(race.states.at(-1).riders.every(row=>
    row.distanceM===120000));
  assert.equal(recording.frames.reduce((sum,frame)=>
    sum+frame.attackers.length,0),1);
  assert.equal(race.steps.reduce((sum,step)=>
    sum+step.attackSteps.length,0),1);
  const replay=replayPhysicalFirstWholeRaceV1(
    input,race);
  assert.equal(replay.validatedRiderKm,19200);
  assert.deepEqual(replay.finalState,
    race.states.at(-1));
  const calibration=calibratePhysicalFirstFinishV1(
    recording,race);
  t.diagnostic(`120 km mountain attack finish mismatches:
    ${calibration.mismatchCount}/160; maximum
    ${calibration.maxAbsoluteMismatchSeconds}s`);
  assert.equal(calibration.validatedKm,120);
  assert.equal(calibration.riderCount,160);
  assert.equal(calibration.mismatchCount,67);
  assert.ok(calibration.maxAbsoluteMismatchSeconds<420);
  assert.equal(calibration.officialResults,false);
});
