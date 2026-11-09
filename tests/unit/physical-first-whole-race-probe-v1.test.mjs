import test from 'node:test';
import assert from 'node:assert/strict';
import {runPhysicalFirstWholeRaceProbeV1} from
  '../../lib/engine/v2/physical-first-whole-race-probe-v1.mjs';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRearEnergyCapV1} from
  '../../lib/engine/v2/rear-energy-cap-source-v1.mjs';
import {calibratePhysicalFirstFinishV1} from
  '../../lib/engine/v2/physical-first-finish-calibration-v1.mjs';
import {replayPhysicalFirstWholeRaceV1} from
  '../../lib/engine/v2/physical-first-whole-race-replay-v1.mjs';
import {recordPhysicalFirstRaceV1,
  PHYSICAL_FIRST_RACE_RECORD_VERSION} from
  '../../lib/engine/v2/physical-first-race-record-v1.mjs';

const segments=[1,2].map(km=>({km,terrain:'flat',
  gradientPct:0,surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const rider=(id,flat)=>({id,flat,hills:flat,
  mountain:flat,endurance:65,form:50,fatigue:0});
const input=(followerAbility=65)=>({
  raceSeed:'fixture-two-km',
  start:{sourceKm:0,roads:[{roadId:'peloton',
    riderIds:['a','b'],clockSeconds:0}],
  riders:['a','b'].map(riderId=>({riderId,
    teamId:riderId,roadId:'peloton',distanceM:0,
    clockSeconds:0,reserve:80,quietKm:0}))},
  kilometres:segments,
  teams:[['a',65],['b',followerAbility]].map(
    ([id,ability])=>({id,riders:[rider(id,ability)],
      orders:{helperIds:[id],baseline:{effort:'steady',
        chase:'selective',attack:'none',
        frontWork:id==='a'?'rotate':'sit_in',
        frontWorkRiderId:id==='a'?id:null},
      phases:[]}})),
  stakes:['a','b'].map(teamId=>({teamId,
    sportingGoal:'sprint_finish',
    sportingCaptainId:teamId}))});

test('physical-first probe covers every rider and kilometre',()=>{
  const race=runPhysicalFirstWholeRaceProbeV1(input());
  assert.equal(race.completedThroughKm,2);
  assert.equal(race.states.length,3);
  assert.equal(race.steps.length,2);
  assert.ok(race.steps.every(step=>
    step.peloton.finishes.length===2&&
    step.peloton.leaderPlan.leaderRiderId==='a'));
  assert.ok(race.states[2].riders.every(row=>
    row.distanceM===2000&&Number.isFinite(row.reserve)));
  assert.equal(race.states[2].sourceGapUsed,false);
  assert.equal(race.officialResults,false);
});

test('source-independent race record validates complete measured finish',()=>{
  const committed=input(0);
  for(const row of committed.start.riders){
    const source=committed.teams.find(team=>team.id===row.teamId)
      .riders[0];
    row.reserve=replayRearEnergyCapV1({rider:source,
      kilometres:committed.kilometres,
      throughKm:0}).initialCap;
  }
  const result=recordPhysicalFirstRaceV1(committed);
  assert.equal(result.version,PHYSICAL_FIRST_RACE_RECORD_VERSION);
  assert.equal(result.replay.validatedRiderKm,4);
  assert.equal(result.finishCrossings.length,2);
  assert.ok(result.finishCrossings.every(row=>
    row.clockSeconds>0&&row.roadId));
  assert.equal(result.officialResults,false);
  assert.deepEqual(recordPhysicalFirstRaceV1(committed,
    {recording:result.recording}).finishCrossings,
  result.finishCrossings);
  const changed=input(0);
  changed.teams[0].riders[0].flat=90;
  assert.throws(()=>recordPhysicalFirstRaceV1(changed,
    {recording:result.recording}),
  /same committed recording/);
  const tampered=structuredClone(result.recording);
  tampered.states[2].riders[0].clockSeconds+=1;
  assert.throws(()=>recordPhysicalFirstRaceV1(committed,
    {recording:tampered}),
  /boundary or finish differs/);
});

test('physical-first probe carries detached solo through all km',()=>{
  const race=runPhysicalFirstWholeRaceProbeV1(input(0));
  assert.equal(race.completedThroughKm,2);
  assert.equal(race.steps[0].peloton.startDropEvents[0]
    .riderId,'b');
  assert.equal(race.steps[1].soloSteps.length,1);
  assert.equal(race.states[2].roads.length,2);
  assert.ok(race.states[2].riders.every(row=>
    row.distanceM===2000));
  assert.ok(race.states[2].roads.find(row=>
    row.roadId==='solo:b').clockSeconds>
    race.states[2].frontClockSeconds);
});

test('physical-first probe refuses a missing ordered leader',()=>{
  const request=input();
  request.teams[0].orders.baseline.frontWork='sit_in';
  assert.throws(()=>runPhysicalFirstWholeRaceProbeV1(request),
    error=>error.sourceKm===1&&
      /No ordered payable bunch leader/.test(error.message));
});

test('ordered attacker pays one full road while the bunch moves',()=>{
  const request=input(75);
  request.kilometres=segments.slice(0,1);
  request.start.riders.forEach(row=>{row.reserve=100;});
  request.teams[1].orders.baseline.attack='selective';
  request.teams[1].orders.baseline.attackRiderId='b';
  request.stakes[1].sportingGoal='break_stage';
  const result=runPhysicalFirstWholeRaceProbeV1(request);
  assert.equal(result.completedThroughKm,1);
  assert.equal(result.steps[0].attackChoices[1].choice,
    'attempt_paid_attack');
  assert.equal(result.steps[0].attackSteps.length,1);
  assert.equal(result.steps[0].attackSteps[0]
    .launchEvent.atClockSeconds,0);
  assert.equal(result.states[1].riders.length,2);
  assert.deepEqual(result.states[1].riders.map(row=>
    row.distanceM),[1000,1000]);
  assert.equal(replayPhysicalFirstWholeRaceV1(request,
    result).validatedRiderKm,2);
  const tampered=structuredClone(result);
  tampered.steps[0].attackSteps[0].finishes[0]
    .energyAfter-=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    request,tampered),/attack road or reserve differs/);
  const changedChoice=structuredClone(result);
  changedChoice.steps[0].attackChoices[1]
    .sportingGoal='none';
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    request,changedChoice),/attack choices differ from order/);
});

test('committed 40 km control covers each rider and audits source finish',t=>{
  const settings={distanceKm:40,teamCount:4,terrain:'flat',
    fatigue:0,attack:'none',chase:'selective',
    seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings).teams.map(
    team=>({teamId:team.id,goal:'sprint_finish',
      captainId:team.orders.captainId}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    rivalGoals:[1,2,3].map(number=>({
      teamId:`rival-${number}`,role:'protect'})),
    ownFrontWork:'rotate',roadGroupPaceVersion:3,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,
    pelotonFrontTurnVersion:1,pelotonDraftCostVersion:1,
    pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,
    roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1});
  const {teams,rivalIntent}=recording.committedInputs;
  const kilometres=recording.route.kilometres;
  assert.equal(recording.frames.reduce((count,frame)=>
    count+frame.attackers.length,0),0);
  const riders=teams.flatMap(team=>team.riders.map(rider=>({
    riderId:rider.id,teamId:team.id,roadId:'peloton',
    distanceM:0,clockSeconds:0,
    reserve:replayRearEnergyCapV1({rider,kilometres,
      throughKm:0}).initialCap,quietKm:0})));
  const start={sourceKm:0,roads:[{roadId:'peloton',
    riderIds:riders.map(row=>row.riderId),
    clockSeconds:0}],riders};
  const result=runPhysicalFirstWholeRaceProbeV1({
    start,kilometres,teams,stakes:rivalIntent,
    raceSeed:recording.raceSeed});
  const replayInput={start,kilometres,teams,
    stakes:rivalIntent,raceSeed:recording.raceSeed};
  const replay=replayPhysicalFirstWholeRaceV1(
    replayInput,result);
  assert.equal(replay.validatedKm,40);
  assert.equal(replay.validatedRiderKm,1280);
  assert.deepEqual(replay.finalState,
    result.states.at(-1));
  assert.equal(result.completedThroughKm,40);
  assert.equal(result.steps.reduce((count,step)=>
    count+step.peloton.roads.reduce((sum,road)=>
      sum+road.riderDecisions.length,0)+
    step.soloSteps.reduce((sum,solo)=>
      sum+solo.road.riderDecisions.length,0),0),1280);
  assert.equal(result.states.at(-1).riders.length,32);
  assert.ok(result.states.at(-1).riders.every(row=>
    row.distanceM===40000));
  assert.ok(result.states.every(state=>state.sourceGapUsed===
    false||state.sourceKm===0));
  const calibration=calibratePhysicalFirstFinishV1(
    recording,result);
  assert.equal(calibration.validatedKm,40);
  assert.equal(calibration.riderCount,32);
  assert.equal(calibration.comparisons.length,32);
  assert.equal(calibration.officialResults,false);
  assert.equal(calibration.mismatchCount,0);
  assert.equal(result.steps.reduce((count,step)=>
    count+step.peloton.startDropEvents.length,0),0);
  t.diagnostic(`40 km same-seed finish mismatches:
    ${calibration.mismatchCount}/32; maximum
    ${calibration.maxAbsoluteMismatchSeconds}s`);
  assert.throws(()=>calibratePhysicalFirstFinishV1({
    ...recording,raceSeed:'different-seed'},result),
  /same committed full race/);
  const changedStart=structuredClone(result);
  changedStart.states[0].riders[0].reserve-=1;
  assert.throws(()=>calibratePhysicalFirstFinishV1(
    recording,changedStart),
  /committed starting reserve/);
  const changedWork=structuredClone(result);
  changedWork.steps[0].peloton.finishes[0]
    .energyAfter-=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    replayInput,changedWork),
  /bunch work or reserve differs/);
  const changedFinish=structuredClone(result);
  changedFinish.states.at(-1).riders[0]
    .clockSeconds+=1;
  assert.throws(()=>replayPhysicalFirstWholeRaceV1(
    replayInput,changedFinish),
  /boundary or finish differs/);
  assert.throws(()=>replayPhysicalFirstWholeRaceV1({
    ...replayInput,raceSeed:'different-seed'},result),
  /same committed recording/);
});
