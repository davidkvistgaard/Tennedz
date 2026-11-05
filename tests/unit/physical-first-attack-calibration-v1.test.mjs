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

test('same-seed attack pays solo contact then stops at bunch catch',t=>{
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
  const eight={start,kilometres:
    kilometres.slice(0,8),teams,
    stakes:rivalIntent,raceSeed:recording.raceSeed};
  const paid=runPhysicalFirstWholeRaceProbeV1(eight);
  assert.equal(paid.completedThroughKm,8);
  const contact=paid.steps[6]
    .withinKmContactEvents[0];
  assert.equal(contact.atDistanceM,6098.75);
  assert.equal(contact.road.riderIds.length,2);
  assert.equal(contact.road.riderDecisions.filter(
    row=>row.role==='leader').length,1);
  assert.equal(replayPhysicalFirstWholeRaceV1(
    eight,paid).validatedRiderKm,256);
  const altered=structuredClone(paid);
  altered.steps[6].withinKmContactEvents[0]
    .finishes[0].energyAfter-=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    eight,altered),/within-km contact differs/);
  assert.throws(()=>runPhysicalFirstWholeRaceProbeV1({
    start,kilometres,teams,stakes:rivalIntent,
    raceSeed:recording.raceSeed}),error=>{
    t.diagnostic(`physical-first attack race completed
      ${error.completedThroughKm}/40 km; next contact:
      ${error.sourceEvidence?.firstRoadId} and
      ${error.sourceEvidence?.secondRoadId} at
      ${error.sourceEvidence?.projectedMeeting
        ?.atDistanceM} m`);
    return error.completedThroughKm===8&&
      error.sourceKm===9&&
      /Road crossing needs recorded paid contact/
        .test(error.message)&&
      error.sourceEvidence?.projectedMeeting
        ?.atDistanceM>8000&&
      error.sourceEvidence?.projectedMeeting
        ?.atDistanceM<9000&&
      error.sourceEvidence?.firstRoadId===
        'peloton'&&
      error.sourceEvidence?.secondRoadId?.startsWith(
        'solo:');
  });
});
