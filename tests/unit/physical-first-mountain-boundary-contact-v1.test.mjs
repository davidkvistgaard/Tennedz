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
import {calibratePhysicalFirstFinishV1} from
  '../../lib/engine/v2/physical-first-finish-calibration-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  '../../lib/engine/v2/physical-first-whole-race-replay-v1.mjs';

test('committed 120 km mountain contact covers paid field',t=>{
  const settings={distanceKm:120,teamCount:20,
    terrain:'mountain',fatigue:0,attack:'none',
    chase:'selective',
    seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings)
    .teams.map(team=>({
      teamId:team.id,
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
  assert.equal(recording.frames.reduce((count,frame)=>
    count+frame.attackers.length,0),0);
  const {teams,rivalIntent}=recording.committedInputs;
  // Keep the early-drop case explicit: the newer planner otherwise
  // selects a weaker worker to avoid avoidable first-kilometre losses.
  teams.find(team=>team.id==='you')
    .orders.baseline.frontWorkRiderId='you-5';
  const kilometres=recording.route.kilometres;
  const riders=teams.flatMap(team=>team.riders.map(
    rider=>({
      riderId:rider.id,teamId:team.id,
      roadId:'peloton',distanceM:0,
      clockSeconds:0,
      reserve:replayRearEnergyCapV1({
        rider,kilometres,throughKm:0})
        .initialCap,quietKm:0})));
  const start={sourceKm:0,
    roads:[{roadId:'peloton',
      riderIds:riders.map(row=>row.riderId),
      clockSeconds:0}],riders};
  const race=runPhysicalFirstWholeRaceProbeV1({
    start,kilometres,teams,stakes:rivalIntent,
    raceSeed:recording.raceSeed});
  const replayInput={start,kilometres,teams,
    stakes:rivalIntent,raceSeed:recording.raceSeed};
  const replay=replayPhysicalFirstWholeRaceV1(
    replayInput,race);
  assert.equal(replay.validatedKm,120);
  assert.equal(replay.validatedRiderKm,19200);
  assert.deepEqual(replay.finalState,
    race.states.at(-1));
  assert.equal(race.completedThroughKm,120);
  assert.equal(race.states.at(-1).riders.length,160);
  assert.ok(race.states.at(-1).riders.every(row=>
    row.distanceM===120000));
  assert.equal(kilometres[0].terrain,'hill');
  assert.equal(race.steps[0].peloton.startDropEvents.length,66);
  assert.equal(race.states[1].roads.find(row=>
    row.roadId==='peloton').riderIds.length,94);
  assert.ok(race.steps[0].peloton.startDropEvents.every(
    row=>row.atDistanceM===0&&
      row.leaderRiderId==='you-5'&&
      row.perceivedShelterHoldAbility<row.leaderAbility));
  const decisions=race.steps.reduce((sum,step)=>
    sum+step.peloton.roads.reduce((count,road)=>
      count+road.riderDecisions.length,0)+
    step.otherSteps.reduce((count,other)=>
      count+(other.roads??[other.road]).reduce(
        (n,road)=>n+road.riderDecisions.length,0),0),0);
  assert.equal(decisions,19200);
  const contacts=race.steps.flatMap(step=>
    step.boundaryContactEvents);
  assert.equal(contacts.length,5);
  assert.ok(contacts.every(event=>
    event.recordedPaidContact&&
    event.approach.every(row=>row.paidFromReserve>0)&&
    event.leaderPlan.leaderRiderId));
  const changedContact=structuredClone(race);
  changedContact.steps.find(step=>
    step.boundaryContactEvents.length)
    .boundaryContactEvents[0].approach[0]
    .paidFromReserve+=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    replayInput,changedContact),
  /contact differs from paid approach/);
  const changedRear=structuredClone(race);
  changedRear.steps.find(step=>
    step.otherSteps.some(row=>
      row.leaderPlan)).otherSteps.find(row=>
    row.leaderPlan).finishes[0].energyAfter-=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    replayInput,changedRear),
  /rear work or reserve differs/);
  const calibration=calibratePhysicalFirstFinishV1(
    recording,race);
  t.diagnostic(`mountain relative finish:
    ${calibration.mismatchCount}/160 mismatches,
    max ${calibration.maxAbsoluteMismatchSeconds}s`);
  assert.equal(calibration.riderCount,160);
  assert.equal(calibration.officialResults,false);
});
