import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {replayV94PhysicalFirstKmV1,
  validateV94PhysicalFirstKmV1,
  V94_PHYSICAL_FIRST_KM_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-first-km-v1.mjs';
import {completeV94PhysicalFirstKmV1,
  validateV94PhysicalFirstKmCompletionV1,
  firstV94SoloContactWithinBoundaryV1,
  V94_PAID_SOLO_COLOCATION_VERSION} from
  '../../lib/engine/v2/v94-physical-first-km-completion-v1.mjs';
import {replayV94PhysicalSecondFrontKmV1,
  validateV94PhysicalSecondFrontKmV1,
  V94_PHYSICAL_SECOND_FRONT_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-second-front-km-v1.mjs';

test('first V94 kilometre prices each named turn and detached solo metre',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'mountain',
    fatigue:0,attack:'none',chase:'selective',
    seed:'preview-recorded-road-1'};
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'sprint_finish',captainId:team.orders.captainId}));
  const options={
    format:'one_day',settings,sportingStakes,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
    pelotonDraftCostVersion:1,pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1};
  const baseline=createV94RaceDynamicsPreview(options);
  const {recording}=baseline;
  assert.equal(Object.hasOwn(baseline,'physicalFirstKm'),false);
  const physical=replayV94PhysicalFirstKmV1(recording);
  const starters=recording.committedInputs.teams.length*8;
  assert.equal(physical.road.length,
    recording.frames[0].pelotonFrontTurnPlan.turns.length);
  assert.equal(physical.completeRiderKilometres+
    physical.detachedRiderCount,starters);
  assert.ok(physical.detachedRiderCount>0);
  assert.ok(physical.atFrontClock.filter(row=>row.attached).every(row=>
    Math.abs(row.sourceFullKmPaidFromReserve-
      row.physicalPaidThroughClock)<1e-5&&
      Math.abs(row.remainingDistanceM)<1e-8));
  assert.equal(physical.remainingSoloRoadUnsettled,true);
  assert.equal(physical.officialResults,false);
  for(const turn of physical.road){
    assert.equal(turn.riderSlices.length,starters);
    assert.equal(turn.riderSlices.filter(row=>
      row.role==='leader').length,1);
    assert.equal(turn.riderSlices.find(row=>
      row.role==='leader').riderId,turn.leaderRiderId);
    assert.ok(turn.riderSlices.every(row=>
      row.energySpent>=0&&row.energyAtTurnEnd>=0&&
      Math.abs(row.energyBefore-row.energySpent-
        row.energyAtTurnEnd)<1e-8));
    assert.ok(turn.riderSlices.every(row=>
      row.decision.version===V94_PHYSICAL_FIRST_KM_DECISION_VERSION&&
      row.decision.sourceKm===1&&
      row.decision.energyBefore===row.energyBefore&&
      row.decision.sportingGoal==='sprint_finish'&&
      Number.isFinite(row.decision.perceivedCruiseAbility)));
  }
  const riderId='rival-10-0';
  const first=physical.road[0].riderSlices.find(row=>
    row.riderId===riderId);
  const second=physical.road[1].riderSlices.find(row=>
    row.riderId===riderId);
  const atClock=physical.atFrontClock.find(row=>row.riderId===riderId);
  assert.equal(first.attachedBefore,true);
  assert.equal(first.attachedAfter,false);
  assert.equal(first.decision.choice,'cannot_hold_paid_turn');
  assert.ok(first.endDistanceM<physical.road[0].endM);
  assert.equal(second.attachedBefore,false);
  assert.equal(second.decision.choice,'continue_detached_solo');
  assert.ok(second.startDistanceM<physical.road[0].endM);
  assert.ok(atClock.atDistanceM<1000);
  assert.ok(atClock.remainingDistanceM>0);
  assert.equal(atClock.attached,false);
  assert.equal(atClock.reserveBeforeRecovery,second.energyAtTurnEnd);
  assert.equal(validateV94PhysicalFirstKmV1(recording,physical),true);
  const forged=structuredClone(physical);
  forged.atFrontClock.find(row=>row.riderId===riderId).atDistanceM=1000;
  assert.throws(()=>validateV94PhysicalFirstKmV1(recording,forged),
    /differs from paid source/);
  const completed=completeV94PhysicalFirstKmV1(recording);
  assert.equal(completed.completeRiderKilometres,starters);
  assert.equal(completed.soloCompletions.length,
    physical.detachedRiderCount);
  assert.deepEqual(completed.physicalRearGroups,[]);
  assert.equal(completed.continuationNeedsContactDecision,true);
  assert.ok(completed.coincidentSoloSets.some(row=>
    row.riderIds.includes(riderId)&&row.riderIds.length>1));
  const shared=completed.paidCoLocationObservations.find(row=>
    row.riderIds.includes(riderId));
  assert.equal(shared.version,V94_PAID_SOLO_COLOCATION_VERSION);
  assert.equal(shared.clockSeconds,physical.frontClockSeconds);
  assert.equal(shared.atDistanceM,atClock.atDistanceM);
  assert.equal(shared.formsRearGroup,false);
  assert.equal(shared.contactDecisionRequired,true);
  assert.equal(shared.riderPaidThroughClock.find(row=>
    row.riderId===riderId).paidFromReserve,
  atClock.physicalPaidThroughClock);
  assert.equal(completed.officialResults,false);
  assert.ok(completed.finishes.every(row=>
    row.endDistanceM===1000&&
    Math.abs(row.energyBefore-row.paidFromReserve+
      row.recoveryAward-row.capAdjustment-row.energyAfter)<.001));
  const soloFinish=completed.finishes.find(row=>
    row.riderId===riderId);
  assert.ok(soloFinish.clockSeconds>completed.frontClockSeconds);
  assert.equal(soloFinish.physicalGroup,`solo-${riderId}`);
  assert.equal(validateV94PhysicalFirstKmCompletionV1(
    recording,completed),true);
  const integrated=createV94RaceDynamicsPreview({
    ...options,physicalFirstKmVersion:1});
  assert.deepEqual(integrated.physicalFirstKm,completed);
  assert.equal(Object.hasOwn(integrated.recording.committedInputs
    .raceContext,'physicalFirstKmVersion'),false);
  assert.throws(()=>createV94RaceDynamicsPreview({
    ...options,pelotonFrontTurnVersion:0,
    physicalFirstKmVersion:1}),/valid experimental race settings/);
  const forgedFinish=structuredClone(completed);
  forgedFinish.finishes.find(row=>row.riderId===riderId)
    .energyAfter=100;
  assert.throws(()=>validateV94PhysicalFirstKmCompletionV1(
    recording,forgedFinish),/differs from paid source/);
  const nextFront=replayV94PhysicalSecondFrontKmV1(recording);
  assert.equal(nextFront.sourceKm,2);
  assert.equal(nextFront.atFrontClock.length,
    physical.completeRiderKilometres);
  assert.equal(nextFront.road.length,
    recording.frames[1].pelotonFrontTurnPlan.turns.length);
  assert.ok(nextFront.road.every(turn=>
    turn.riderSlices.filter(row=>row.role==='leader').length===1&&
    turn.riderSlices.every(row=>
      row.decision.version===
        V94_PHYSICAL_SECOND_FRONT_DECISION_VERSION&&
      row.decision.sportingGoal==='sprint_finish'&&
      row.energySpent>=0)));
  assert.ok(nextFront.atFrontClock.filter(row=>row.attached).every(row=>
    Math.abs(row.sourceFullKmPaidFromReserve-
      row.physicalPaidThroughClock)<1e-5));
  assert.equal(nextFront.rearConcurrentRoadUnresolved,true);
  assert.deepEqual(nextFront.physicalRearGroups,[]);
  assert.equal(nextFront.officialResults,false);
  assert.equal(validateV94PhysicalSecondFrontKmV1(
    recording,nextFront),true);
  const forgedSecond=structuredClone(nextFront);
  forgedSecond.atFrontClock[0].atDistanceM=2001;
  assert.throws(()=>validateV94PhysicalSecondFrontKmV1(
    recording,forgedSecond),/differs from paid source/);
});

test('solo completion detects a paid meeting before the kilometre boundary',()=>{
  const crossing=[
    {riderId:'behind',atDistanceM:900,speedKph:30,
      remainingSeconds:12},
    {riderId:'ahead',atDistanceM:950,speedKph:10,
      remainingSeconds:18}];
  const contact=firstV94SoloContactWithinBoundaryV1(crossing,80);
  assert.deepEqual(contact.riderIds,['ahead','behind']);
  assert.equal(contact.clockSeconds,89);
  assert.equal(contact.atDistanceM,975);
  assert.equal(firstV94SoloContactWithinBoundaryV1([
    crossing[0],{...crossing[1],speedKph:25,
      remainingSeconds:7.2}],80),null);
});

test('second front records an early climb loss without completing rear road',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'mountain',
    fatigue:0,attack:'none',chase:'selective',
    seed:'preview-recorded-road-2'};
  const sportingStakes=prepareV91Playtest(settings).teams.map(team=>({
    teamId:team.id,goal:'sprint_finish',
    captainId:team.orders.captainId}));
  const {recording}=createV94RaceDynamicsPreview({
    format:'one_day',settings,sportingStakes,
    roadGroupPaceVersion:3,chaseTurnVersion:1,
    bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1,
    pelotonDraftCostVersion:1,pelotonExposureCostVersion:1,
    freshAttackDecisionVersion:1,roadGroupRiderDecisionVersion:1,
    protectorSportingPursuitVersion:1});
  const trace=replayV94PhysicalSecondFrontKmV1(recording);
  assert.equal(trace.atFrontClock.length,134);
  assert.equal(trace.completeFrontRiderKilometres,94);
  const lost=trace.atFrontClock.find(row=>
    row.riderId==='rival-1-0');
  assert.equal(lost.attached,false);
  assert.ok(lost.atDistanceM<2000);
  assert.ok(trace.road.some(turn=>
    turn.riderSlices.some(row=>
      row.riderId===lost.riderId&&
      row.decision.choice==='cannot_hold_paid_turn')));
  assert.equal(trace.detachedFrontRoadUnresolved,true);
  assert.equal(trace.officialResults,false);
});
