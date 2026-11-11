import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {orderAt} from '../../lib/engine/v2/orders.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';
import {validateRecordedTour} from
  '../../lib/engine/v2/recording.mjs';
import {V94_ROAD_GROUP_RIDER_DECISIONS_VERSION} from
  '../../lib/engine/v2/v94-road-group-rider-decisions-v1.mjs';

test('opt-in forward choices replay committed mixed stakes and orders',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'flat',fatigue:0,
    attack:'none',chase:'selective',seed:'preview-recorded-road-1'};
  const goals=['sprint_finish','break_stage','summit_attack','none'];
  const sportingStakes=prepareV91Playtest(settings).teams.map(
    (team,index)=>({teamId:team.id,goal:goals[index%goals.length],
      captainId:team.orders.captainId}));
  const options={format:'one_day',settings,sportingStakes,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
    roadGroupRiderDecisionVersion:1};
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,sportingStakes:null}),/experimental race settings/);
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,roadGroupPaceVersion:2}),/experimental race settings/);
  const {recording}=createV94RaceDynamicsPreview(options);
  const teams=new Map(recording.committedInputs.teams.map(row=>
    [row.id,row]));
  const stakes=new Map(sportingStakes.map(row=>[row.teamId,row]));
  const choices=recording.frames.flatMap(frame=>
    frame.roadGroupRiderDecisions);
  assert.ok(choices.length>0);
  assert.ok(new Set(choices.map(row=>row.goal)).size>=3);
  for(const frame of recording.frames){
    const prior=recording.frames[frame.km-2];
    for(const choice of frame.roadGroupRiderDecisions){
      const stake=stakes.get(choice.teamId);
      const order=orderAt(teams.get(choice.teamId).orders,frame.km-1);
      assert.equal(choice.version,
        V94_ROAD_GROUP_RIDER_DECISIONS_VERSION);
      assert.equal(choice.sourceKm,frame.km);
      assert.equal(choice.goal,stake.goal);
      assert.equal(choice.sportingCaptainId,stake.captainId);
      assert.equal(choice.teamOrderEffort,order.effort);
      assert.equal(choice.teamOrderBreakWork,order.breakWork);
      assert.ok(Number.isFinite(choice.perceivedAbility));
      assert.ok(prior);
      assert.equal(choice.energyBefore,prior.riderGroups.find(row=>
        row.id===choice.riderId)?.energy);
    }
  }
  assert.deepEqual(replayRaceDynamicsRecording(recording),recording);
  const forged=structuredClone(recording);
  forged.frames.find(frame=>frame.roadGroupRiderDecisions.length)
    .roadGroupRiderDecisions[0].goal='forged_goal';
  assert.throws(()=>replayRaceDynamicsRecording(forged),/differ|invalid/i);
  const historic=createV94RaceDynamicsPreview({
    ...options,roadGroupRiderDecisionVersion:0}).recording;
  assert.ok(historic.frames.flatMap(frame=>
    frame.roadGroupRiderDecisions).every(row=>!Object.hasOwn(row,'version')));
});

test('strict caught-break contact refuses checkpoint and finish catches',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'flat',fatigue:0,
    attack:'none',chase:'selective',seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'sprint_finish',captainId:team.orders.captainId}));
  const options={format:'one_day',settings,sportingStakes,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1};
  const historic=createV94RaceDynamicsPreview(options).recording;
  assert.ok(historic.frames.some(frame=>
    frame.caughtBreakawayRiderIds.length>0));
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,caughtBreakContactVersion:1}),error=>{
    assert.match(error.message,/Unresolved caught-break contact/);
    assert.ok(error.sourceKm>0);
    assert.ok(error.sourceEvidence.caughtRiderIds.length>0);
    assert.ok(error.sourceEvidence.caughtRiderIds.every(id=>
      Number.isFinite(error.sourceEvidence.priorEnergyByRider[id])));
    return true;
  });
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,roadGroupPaceVersion:2,caughtBreakContactVersion:1}),
  /valid experimental race settings/);
  const forged=structuredClone(historic);
  forged.committedInputs.raceContext.caughtBreakContactVersion=1;
  assert.throws(()=>validateRecordedTour(forged),
    /Recorded caught-break event lacks paid contact/);
  const finishSettings={...settings,terrain:'mountain'};
  const finishStakes=prepareV91Playtest(finishSettings).teams.map(team=>({
    teamId:team.id,goal:'sprint_finish',captainId:team.orders.captainId}));
  const finishOptions={...options,settings:finishSettings,
    sportingStakes:finishStakes,protectorSportingPursuitVersion:1,
    protectorPursuitTimingVersion:1};
  assert.equal(createV94RaceDynamicsPreview(finishOptions)
    .recording.frames.at(-1).finishLineCatch,true);
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...finishOptions,caughtBreakContactVersion:1}),error=>{
    assert.match(error.message,/Unresolved caught-break contact/);
    assert.equal(error.sourceKm,finishSettings.distanceKm);
    assert.equal(error.sourceEvidence.finishLineCatch,true);
    assert.ok(error.sourceEvidence.priorRoadGroups.length>0);
    assert.ok(error.sourceEvidence.caughtRiderIds.every(id=>
      Number.isFinite(error.sourceEvidence.finishEnergyByRider[id])));
    return true;
  });
});
