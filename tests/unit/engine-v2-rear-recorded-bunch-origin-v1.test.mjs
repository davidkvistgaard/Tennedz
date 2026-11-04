import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {runRearRecordedBunchOriginV1,
  validateRearRecordedBunchOriginV1,
  runRearRecordedBunchOriginV2,
  validateRearRecordedBunchOriginV2,
  runRearRecordedBunchOriginV3,
  validateRearRecordedBunchOriginV3} from
  '../../lib/engine/v2/rear-recorded-bunch-origin-v1.mjs';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';

test('V94 paid bunch turn can anchor a separate physical start road',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    roadGroupPaceVersion:3,bunchFrontTurnVersion:1,
    chaseTurnVersion:1,pelotonFrontTurnVersion:1,
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,
      fatigue:30,attack:'none',chase:'selective',
      seed:'preview-recorded-road-1'}});
  const turn=recording.frames[0].pelotonFrontTurnPlan.turns[0];
  const riderId=turn.leaderRiderId;
  const team=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const choices=Array.from({length:5},(_,index)=>({riderId,
    km:index+1,effort:orderAt(team.orders,index).effort,
    action:'hold_wheel',reason:'follow_order'}));
  const input={recording,riderId,throughKm:5,choices};
  const source=runRearRecordedBunchOriginV1(input);
  assert.equal(source.road.steps.length,5);
  assert.equal(source.road.steps[0].slices[0].role,'leader');
  assert.equal(source.checkpointGroupIsPhysicalPosition,false);
  assert.equal(validateRearRecordedBunchOriginV1(input,source),true);
  const forged=structuredClone(source);
  forged.road.steps[0].slices[0].energySpent=0;
  assert.throws(()=>validateRearRecordedBunchOriginV1(input,forged),
    /differs/);
  const changed=structuredClone(recording);
  changed.frames[0].pelotonFrontTurnPlan.turns[0].ability+=1;
  assert.throws(()=>runRearRecordedBunchOriginV1({...input,
    recording:changed}),/differs|replay|recorded|turn/);
  const weakerId='rival-1-0';
  const weakerTeam=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===weakerId));
  assert.throws(()=>runRearRecordedBunchOriginV1({
    recording,riderId:weakerId,throughKm:1,
    choices:[{riderId:weakerId,km:1,
      effort:orderAt(weakerTeam.orders,0).effort,
      action:'hold_wheel',reason:'follow_order'}]}),
  /uncalibrated physical pace loss/);
});

test('recorded stage number cannot invent a future-stage schedule',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'stage',
    roadGroupPaceVersion:3,bunchFrontTurnVersion:1,
    chaseTurnVersion:1,pelotonFrontTurnVersion:1,
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,
      fatigue:30,attack:'none',chase:'selective',
      seed:'stage-plan-context'}});
  const riderId=recording.frames[0].pelotonFrontTurnPlan.
    turns[0].leaderRiderId;
  const team=recording.committedInputs.teams.find(row=>
    row.riders.some(rider=>rider.id===riderId));
  const choice={riderId,km:1,
    effort:orderAt(team.orders,0).effort,
    action:'hold_wheel',reason:'follow_order'};
  const road=runRearRecordedBunchOriginV1({recording,riderId,
    throughKm:1,choices:[choice]});
  assert.equal(road.road.status,'bunch');
  const stageNumber=recording.committedInputs.raceContext.stageNumber;
  assert.throws(()=>runRearRecordedBunchOriginV1({
    recording,riderId,throughKm:1,stageCount:stageNumber+1,
    committedStagePlan:{riderId,
      currentStageNumber:stageNumber,
      targetStageNumber:stageNumber+1,
      currentGoal:'finish_safely',futureGoal:'target_stage',
      reserveEnergy:50},
    choices:[{...choice,action:'release_wheel',
      reason:'committed_future_stage_reserve'}]}),
  /no committed future-stage schedule/);
});

test('V94 recorded follower work anchors a separate paid physical road',()=>{
  const settings={distanceKm:120,terrain:'flat',teamCount:20,
    fatigue:0,attack:'none',chase:'selective',
    seed:'chase-turn-holdout-1-flat-0'};
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'sprint_finish',
    captainId:team.orders.captainId}));
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings,sportingStakes,roadGroupPaceVersion:3,
    bunchFrontTurnVersion:1,chaseTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,pelotonDropContactVersion:1,
    pelotonFollowerDecisionVersion:2});
  const riderId=recording.frames[0].pelotonFrontTurnPlan.turns[0]
    .leaderRiderId;
  const input={recording,riderId,throughKm:1};
  const result=runRearRecordedBunchOriginV2(input);
  assert.equal(result.version,'v2-rear-recorded-bunch-work-2');
  assert.equal(result.road.status,'bunch');
  assert.equal(result.road.steps[0].slices[0].role,'leader');
  assert.equal(result.checkpointGroupIsPhysicalPosition,false);
  assert.equal(validateRearRecordedBunchOriginV2(input,result),true);
  const reconciled=runRearRecordedBunchOriginV3(input);
  assert.equal(reconciled.version,'v2-rear-recorded-bunch-energy-3');
  assert.equal(reconciled.sourceEnergyReconciliation.length,1);
  assert.ok(Math.abs(reconciled.sourceEnergyReconciliation[0]
    .sourcePaid-reconciled.sourceEnergyReconciliation[0]
    .physicalPaid)<=.001);
  assert.equal(validateRearRecordedBunchOriginV3(input,reconciled),true);
  const forgedEnergy=structuredClone(reconciled);
  forgedEnergy.sourceEnergyReconciliation[0].sourcePaid=0;
  assert.throws(()=>validateRearRecordedBunchOriginV3(
    input,forgedEnergy),/differs/);
  const full=runRearRecordedBunchOriginV3({recording,
    riderId:'rival-1-5',throughKm:120});
  assert.equal(full.road.status,'bunch');
  assert.equal(full.sourceEnergyReconciliation.length,120);
  assert.ok(full.road.steps.some(step=>
    step.effortSource==='recorded_peloton_rest'));
  const forged=structuredClone(result);
  forged.road.steps[0].slices[0].energySpent=0;
  assert.throws(()=>validateRearRecordedBunchOriginV2(
    input,forged),/differs/);
  const changed=structuredClone(recording);
  changed.frames[0].pelotonFrontTurnPlan.extraEnergyCosts[0]
    .extraCost=0;
  assert.throws(()=>runRearRecordedBunchOriginV2({...input,
    recording:changed}),/differ|replay|source|turn/);
});
