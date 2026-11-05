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
  const catchResult=full.steps[8]
    .withinKmContactEvents[0];
  assert.ok(catchResult.event.atDistanceM>8000&&
    catchResult.event.atDistanceM<9000);
  assert.equal(catchResult.event.recordedPaidContact,
    true);
  const falseCatch=structuredClone(full);
  falseCatch.steps[8].withinKmContactEvents[0]
    .finish.energyAfter-=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    fullInput,falseCatch),
  /within-km contact differs/);
  const calibration=calibratePhysicalFirstFinishV1(
    recording,full);
  t.diagnostic(`40 km attack finish mismatches:
    ${calibration.mismatchCount}/32; maximum
    ${calibration.maxAbsoluteMismatchSeconds}s;
    bunch catch: ${catchResult.event.choice}`);
  assert.equal(calibration.validatedKm,40);
  assert.equal(calibration.riderCount,32);
});
