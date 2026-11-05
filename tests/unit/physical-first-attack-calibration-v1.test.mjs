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

test('same-seed attack race stops at an unpaid solo crossing',t=>{
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
  assert.throws(()=>runPhysicalFirstWholeRaceProbeV1({
    start,kilometres,teams,stakes:rivalIntent,
    raceSeed:recording.raceSeed}),error=>{
    t.diagnostic(`physical-first attack race completed
      ${error.completedThroughKm}/40 km; next contact:
      ${error.sourceEvidence?.firstRoadId} and
      ${error.sourceEvidence?.secondRoadId}`);
    return error.completedThroughKm===6&&
      error.sourceKm===7&&
      /Road crossing needs recorded paid contact/
        .test(error.message)&&
      error.sourceEvidence?.firstRoadId?.startsWith(
        'solo:')&&
      error.sourceEvidence?.secondRoadId?.startsWith(
        'solo:');
  });
});
