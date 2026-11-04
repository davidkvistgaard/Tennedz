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
import {decideV94PhysicalBoundaryChoicesV1,
  validateV94PhysicalBoundaryChoicesV1,
  V94_PHYSICAL_BOUNDARY_CHOICE_VERSION} from
  '../../lib/engine/v2/v94-physical-boundary-choice-v1.mjs';
import {replayV94PhysicalSecondRearKmV1,
  validateV94PhysicalSecondRearKmV1,
  firstV94SecondRearRoadContactV1,
  firstV94SecondFrontContactV1,
  firstV94SecondPiecewiseContactV1} from
  '../../lib/engine/v2/v94-physical-second-rear-km-v1.mjs';
import {replayV94PhysicalThirdFrontKmV1,
  validateV94PhysicalThirdFrontKmV1,
  V94_PHYSICAL_THIRD_FRONT_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-third-front-km-v1.mjs';
import {decideV94PhysicalThirdBoundaryChoicesV1,
  validateV94PhysicalThirdBoundaryChoicesV1} from
  '../../lib/engine/v2/v94-physical-third-boundary-choice-v1.mjs';
import {replayV94PhysicalThirdRearKmV1,
  validateV94PhysicalThirdRearKmV1,
  V94_PHYSICAL_THIRD_REAR_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-third-rear-km-v1.mjs';
import {replayV94PhysicalFourthKmV1,
  validateV94PhysicalFourthKmV1,
  V94_PHYSICAL_FOURTH_REAR_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-fourth-km-v1.mjs';
import {replayV94PhysicalNextKmV1} from
  '../../lib/engine/v2/v94-physical-next-km-v1.mjs';
import {inspectV94PhysicalFreshLaunchBoundaryV1,
  validateV94PhysicalFreshLaunchBoundaryV1,
  V94_PHYSICAL_FRESH_LAUNCH_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-fresh-launch-boundary-v1.mjs';
import {replayV94PhysicalFreshAttackSolosV1,
  validateV94PhysicalFreshAttackSolosV1,
  V94_PHYSICAL_FRESH_ATTACK_SOLO_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalFifthFrontKmV1,
  validateV94PhysicalFifthFrontKmV1,
  V94_PHYSICAL_FIFTH_FRONT_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-fifth-front-km-v1.mjs';
import {replayV94PhysicalFifthKmV1,
  validateV94PhysicalFifthKmV1,
  V94_PHYSICAL_FIFTH_REAR_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-fifth-km-v1.mjs';
import {inspectV94PhysicalSixthSourceBoundaryV1,
  validateV94PhysicalSixthSourceBoundaryV1} from
  '../../lib/engine/v2/v94-physical-sixth-source-boundary-v1.mjs';
import {decideV94PhysicalSixthRiderBoundaryV1,
  validateV94PhysicalSixthRiderBoundaryV1,
  V94_PHYSICAL_SIXTH_RIDER_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-sixth-rider-boundary-v1.mjs';
import {inspectV94PhysicalSixthForwardContactProbeV1,
  validateV94PhysicalSixthForwardContactProbeV1} from
  '../../lib/engine/v2/v94-physical-sixth-forward-contact-probe-v1.mjs';
import {decideV94PhysicalSixthBoundaryChoicesV1,
  validateV94PhysicalSixthBoundaryChoicesV1} from
  '../../lib/engine/v2/v94-physical-sixth-boundary-choice-v1.mjs';
import {replayV94PhysicalSixthFrontKmV1,
  validateV94PhysicalSixthFrontKmV1,
  V94_PHYSICAL_SIXTH_FRONT_DECISION_VERSION} from
  '../../lib/engine/v2/v94-physical-sixth-front-km-v1.mjs';
import {replayV94PhysicalSixthKmV1,
  validateV94PhysicalSixthKmV1} from
  '../../lib/engine/v2/v94-physical-sixth-km-v1.mjs';
import {replayV94PhysicalSeventhKmV1,
  validateV94PhysicalSeventhKmV1} from
  '../../lib/engine/v2/v94-physical-seventh-km-v1.mjs';
import {replayV94PhysicalUnattachedSourceNextKmV1,
  validateV94PhysicalUnattachedSourceNextKmV1} from
  '../../lib/engine/v2/v94-physical-unattached-source-next-km-v1.mjs';
import {replayV94PhysicalMixedFreshAttackSolosV1,
  validateV94PhysicalMixedFreshAttackSolosV1} from
  '../../lib/engine/v2/v94-physical-mixed-fresh-attack-solo-v1.mjs';
import {replayV94PhysicalMixedFreshKmV1,
  validateV94PhysicalMixedFreshKmV1} from
  '../../lib/engine/v2/v94-physical-mixed-fresh-km-v1.mjs';
import {decideV94PhysicalForwardBoundaryChoicesV1,
  validateV94PhysicalForwardBoundaryChoicesV1} from
  '../../lib/engine/v2/v94-physical-forward-boundary-choice-v1.mjs';
import {replayV94PhysicalRecordedRestKmV1,
  validateV94PhysicalRecordedRestKmV1} from
  '../../lib/engine/v2/v94-physical-recorded-rest-km-v1.mjs';
import {decideV94PhysicalMidKmContactChoiceV1,
  validateV94PhysicalMidKmContactChoiceV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-choice-v1.mjs';
import {replayV94PhysicalMidKmContactFragmentV1,
  validateV94PhysicalMidKmContactFragmentV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-fragment-v1.mjs';
import {inspectV94PhysicalMidKmContactRoadsV1,
  validateV94PhysicalMidKmContactRoadsV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-road-audit-v1.mjs';
import {replayV94PhysicalMidKmContactFullFieldV1,
  validateV94PhysicalMidKmContactFullFieldV1} from
  '../../lib/engine/v2/v94-physical-mid-km-contact-full-field-v1.mjs';
import {replayV94PhysicalMixedPaidNextKmV1,
  validateV94PhysicalMixedPaidNextKmV1} from
  '../../lib/engine/v2/v94-physical-mixed-paid-next-km-v1.mjs';

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
  const boundary=decideV94PhysicalBoundaryChoicesV1(recording);
  const contactChoice=boundary.choices.find(row=>
    row.riderIds.includes(riderId));
  assert.equal(contactChoice.version,
    V94_PHYSICAL_BOUNDARY_CHOICE_VERSION);
  assert.equal(contactChoice.contactAtDistanceM,
    shared.atDistanceM);
  assert.equal(contactChoice.boundaryClockSeconds,
    completed.finishes.find(row=>row.riderId===riderId)
      .clockSeconds);
  assert.equal(contactChoice.pendingLeaderRiderId,riderId);
  assert.equal(contactChoice.formsRearGroup,false);
  assert.deepEqual(boundary.physicalRearGroups,[]);
  assert.equal(contactChoice.riderDecisions.find(row=>
    row.riderId==='rival-2-0').willingToLead,false);
  assert.equal(validateV94PhysicalBoundaryChoicesV1(
    recording,boundary),true);
  const forgedBoundary=structuredClone(boundary);
  forgedBoundary.choices.find(row=>row.riderIds.includes(riderId))
    .pendingLeaderRiderId='rival-2-0';
  assert.throws(()=>validateV94PhysicalBoundaryChoicesV1(
    recording,forgedBoundary),/Boundary choices differ from paid source/);
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
  const complete=replayV94PhysicalSecondRearKmV1(recording);
  assert.equal(complete.newFrontDrops.length,40);
  assert.equal(complete.droppedFrontFinishes.length,40);
  assert.ok(complete.newFrontDrops.every(row=>
    row.completionDecision.choice==='complete_detached_solo'&&
    row.completionDecision.paidRemainingEnergy>0));
  assert.equal(complete.finishes.length,160);
  assert.equal(complete.coincidentNewFrontDropSets.length,2);
  assert.ok(complete.coincidentNewFrontDropSets.every(row=>
    row.formsRearGroup===false));
  assert.equal(complete.continuationNeedsContactDecision,true);
  assert.ok(complete.droppedFrontFinishes.some(row=>
    row.riderId==='rival-1-0'&&
    row.clockSeconds>complete.front.frontClockSeconds));
  assert.equal(complete.fullFieldKilometre,true);
  const third=replayV94PhysicalThirdFrontKmV1(recording);
  assert.equal(third.sourceKm,3);
  assert.equal(third.frontAtDistanceM,3000);
  assert.equal(third.second.finishes.length,160);
  assert.equal(third.road.length,
    recording.frames[2].pelotonFrontTurnPlan.turns.length);
  assert.ok(third.road.every(turn=>
    turn.riderSlices.filter(row=>row.role==='leader').length===1&&
    turn.riderSlices.every(row=>
      row.decision.version===
        V94_PHYSICAL_THIRD_FRONT_DECISION_VERSION&&
      row.decision.sourceKm===3)));
  assert.equal(third.rearConcurrentRoadUnresolved,true);
  assert.equal(third.officialResults,false);
  assert.equal(validateV94PhysicalThirdFrontKmV1(recording,third),true);
  const thirdBoundary=decideV94PhysicalThirdBoundaryChoicesV1(
    recording);
  assert.ok(thirdBoundary.choices.length>=
    complete.physicalRearGroups.length+
    complete.coincidentNewFrontDropSets.length);
  assert.ok(thirdBoundary.choices.every(row=>
    row.atDistanceM===2000&&
    row.riderDecisions.length===row.riderIds.length&&
    row.formsRearGroup===false&&
    row.paidArrivalEvidence.every(evidence=>
      evidence.sourceKm===2&&
      Number.isFinite(evidence.paidFromReserve))));
  assert.equal(thirdBoundary.choices.reduce((sum,row)=>
    sum+row.riderIds.length,0)+
    thirdBoundary.unpairedSoloRiderIds.length,
  complete.finishes.filter(row=>
    row.physicalGroup!=='peloton').length);
  assert.equal(thirdBoundary.physicalRearGroups.length,0);
  assert.equal(validateV94PhysicalThirdBoundaryChoicesV1(
    recording,thirdBoundary),true);
  const thirdComplete=replayV94PhysicalThirdRearKmV1(recording);
  assert.equal(thirdComplete.fullFieldKilometre,true);
  assert.equal(thirdComplete.finishes.length,160);
  assert.ok(thirdComplete.finishes.every(row=>
    row.endDistanceM===3000&&
    Math.abs(row.energyBefore-row.paidFromReserve+
      row.recoveryAward-row.capAdjustment-row.energyAfter)<.001));
  assert.ok(thirdComplete.physicalRearGroups.every(group=>
    group.riderDecisions.filter(row=>
      row.role==='leader').length===1&&
    group.riderDecisions.every(row=>
      row.version===V94_PHYSICAL_THIRD_REAR_DECISION_VERSION)));
  assert.equal(thirdComplete.newFrontDrops.length,
    third.atFrontClock.filter(row=>!row.attached).length);
  assert.equal(thirdComplete.officialResults,false);
  assert.equal(validateV94PhysicalThirdRearKmV1(
    recording,thirdComplete),true);
  const fourth=replayV94PhysicalFourthKmV1(recording);
  assert.equal(fourth.sourceKm,4);
  assert.equal(fourth.priorSourceKm,3);
  assert.equal(fourth.finishes.length,160);
  assert.equal(fourth.fullFieldKilometre,true);
  assert.ok(fourth.physicalRearGroups.every(group=>
    group.riderDecisions.filter(row=>
      row.role==='leader').length===1&&
    group.riderDecisions.every(row=>
      row.version===V94_PHYSICAL_FOURTH_REAR_DECISION_VERSION)));
  assert.ok(fourth.finishes.every(row=>
    row.endDistanceM===4000&&
    Math.abs(row.energyBefore-row.paidFromReserve+
      row.recoveryAward-row.capAdjustment-row.energyAfter)<.001));
  assert.equal(fourth.officialResults,false);
  assert.equal(validateV94PhysicalFourthKmV1(recording,fourth),true);
  if(recording.frames[4].attackers.length)
    assert.throws(()=>replayV94PhysicalNextKmV1(
      recording,fourth),error=>
      /paid launch and contact contract/.test(error.message)&&
      error.sourceKm===5&&
      error.sourceEvidence.attackerRiderIds.length===
        recording.frames[4].attackers.length&&
      error.sourceEvidence.priorAttackerGroups.every(row=>
        row.physicalGroup==='peloton'));
  const launch=inspectV94PhysicalFreshLaunchBoundaryV1(
    recording,fourth);
  assert.equal(launch.sourceKm,5);
  assert.equal(launch.atDistanceM,4000);
  assert.equal(launch.sourceNewBreakHasPaidTurnPlan,false);
  assert.deepEqual(launch.physicalRoadGroups,[]);
  assert.ok(launch.decisions.every(row=>
    row.version===V94_PHYSICAL_FRESH_LAUNCH_DECISION_VERSION&&
    row.choice==='attempt_paid_launch'&&
    row.paidNewDistanceM===0&&row.paidNewEnergy===0&&
    Number.isFinite(row.perceivedAttackAbility)));
  assert.equal(validateV94PhysicalFreshLaunchBoundaryV1(
    recording,fourth,launch),true);
  const freshSolos=replayV94PhysicalFreshAttackSolosV1(
    recording,fourth);
  assert.equal(freshSolos.roads.length,
    recording.frames[4].attackers.length);
  assert.ok(freshSolos.roads.every(row=>
    row.version===V94_PHYSICAL_FRESH_ATTACK_SOLO_DECISION_VERSION&&
    row.startDistanceM===4000&&row.endDistanceM===5000&&
    row.sourcePaidFromReserve+1e-8>=
      row.minimumSoloEnergyDemand&&
    Math.abs(row.energyBefore-row.sourcePaidFromReserve-
      row.sourceCapAdjustment-row.energyAfter)<.0015));
  assert.deepEqual(freshSolos.physicalRoadGroups,[]);
  assert.ok(freshSolos.sourceCheckpointComparisons.length>0);
  assert.ok(freshSolos.sourceCheckpointComparisons.every(row=>
    row.physicalGroupFormed===false&&
    Number.isFinite(row.sourceCheckpointGapSeconds)&&
    Number.isFinite(row.maxIndividualPaidLeadSeconds)&&
    row.sourceGapMinusMaxIndividualLeadSeconds===
      row.sourceCheckpointGapSeconds-
        row.maxIndividualPaidLeadSeconds));
  assert.equal(freshSolos.remainingFieldRoadUnresolved,true);
  assert.equal(freshSolos.officialResults,false);
  assert.equal(validateV94PhysicalFreshAttackSolosV1(
    recording,fourth,freshSolos),true);
  const fifthFront=replayV94PhysicalFifthFrontKmV1(
    recording,fourth);
  assert.equal(fifthFront.sourceKm,5);
  assert.deepEqual(fifthFront.excludedFreshAttackRiderIds,
    freshSolos.roads.map(row=>row.riderId));
  assert.equal(fifthFront.frontClockSeconds,
    freshSolos.frontClockSeconds);
  assert.ok(fifthFront.road.every(turn=>
    turn.riderSlices.filter(row=>row.role==='leader').length===1&&
    turn.riderSlices.every(row=>
      row.decision.version===
        V94_PHYSICAL_FIFTH_FRONT_DECISION_VERSION)));
  assert.equal(fifthFront.remainingFieldRoadUnresolved,true);
  assert.equal(fifthFront.officialResults,false);
  assert.equal(validateV94PhysicalFifthFrontKmV1(
    recording,fourth,fifthFront),true);
  const fifth=replayV94PhysicalFifthKmV1(recording,fourth);
  assert.equal(fifth.fullFieldKilometre,true);
  assert.equal(fifth.finishes.length,160);
  assert.equal(fifth.freshAttackSoloRiderIds.length,
    freshSolos.roads.length);
  assert.equal(fifth.sourceCheckpointCalibrationFailed,true);
  assert.ok(fifth.physicalRearGroups.every(group=>
    group.riderDecisions.filter(row=>
      row.role==='leader').length===1&&
    group.riderDecisions.every(row=>
      row.version===V94_PHYSICAL_FIFTH_REAR_DECISION_VERSION)));
  assert.ok(fifth.finishes.every(row=>
    row.endDistanceM===5000&&
    Math.abs(row.energyBefore-row.paidFromReserve+
      row.recoveryAward-row.capAdjustment-row.energyAfter)<.0015));
  assert.equal(fifth.officialResults,false);
  assert.equal(validateV94PhysicalFifthKmV1(
    recording,fourth,fifth),true);
  const sixthSource=inspectV94PhysicalSixthSourceBoundaryV1(
    recording,fifth);
  assert.equal(sixthSource.sourceKm,6);
  assert.equal(sixthSource.paidNewDistanceM,0);
  assert.equal(sixthSource.paidNewEnergy,0);
  assert.ok(sixthSource.sourceRoads.every(row=>
    row.sourceNamedLeaderRiderIds.every(id=>
      row.sourceRiderIds.includes(id))&&
    row.boundaryClockSpreadSeconds>=0&&
    row.sourcePlanCannotAttach===
      (!row.physicalGroupAlreadyFormed&&!row.singlePaidSolo)));
  assert.deepEqual(sixthSource.physicalRoadGroups,[]);
  assert.equal(validateV94PhysicalSixthSourceBoundaryV1(
    recording,fifth,sixthSource),true);
  const sixthRiders=decideV94PhysicalSixthRiderBoundaryV1(
    recording,fifth);
  assert.equal(sixthRiders.decisions.length,160);
  assert.ok(sixthRiders.decisions.every(row=>
    row.version===V94_PHYSICAL_SIXTH_RIDER_DECISION_VERSION&&
    row.atDistanceM===5000&&
    Number.isFinite(row.relativeToPaidFrontSeconds)&&
    Number.isFinite(row.perceivedCruiseAbility)&&
    Number.isFinite(row.perceivedSoloAbility)&&
    row.managerEffort&&row.sportingGoal&&
    row.paidNewDistanceM===0&&row.paidNewEnergy===0));
  assert.equal(validateV94PhysicalSixthRiderBoundaryV1(
    recording,fifth,sixthRiders),true);
  const forwardProbe=inspectV94PhysicalSixthForwardContactProbeV1(
    recording,fifth);
  assert.equal(forwardProbe.proposedSoloRoads.length,
    sixthRiders.decisions.filter(row=>
      row.sourceBreakMembershipClaim).length);
  assert.ok(forwardProbe.proposedSoloRoads.every(row=>
    row.startDistanceM===5000&&
    row.proposedEndDistanceM===6000&&
    Number.isFinite(row.quotedSoloEnergyDemand)&&
    Number.isFinite(row.sourceFullKmPaidFromReserve)));
  assert.ok(forwardProbe.contactCandidates.every(row=>
    row.atDistanceM>=5000&&row.atDistanceM<=6000&&
    row.paidFormationPending));
  assert.equal(forwardProbe.paidNewDistanceM,0);
  assert.equal(forwardProbe.paidNewEnergy,0);
  assert.deepEqual(forwardProbe.physicalRoadGroups,[]);
  assert.equal(validateV94PhysicalSixthForwardContactProbeV1(
    recording,fifth,forwardProbe),true);
  const sixthChoices=decideV94PhysicalSixthBoundaryChoicesV1(
    recording,fifth);
  assert.ok(sixthChoices.choices.every(row=>
    row.formsRearGroup===false&&
    row.paidArrivalEvidence.length===row.riderIds.length&&
    (!row.freshForwardContactCandidate||
      row.sourceBreakGroupNotAdopted)));
  assert.equal(sixthChoices.physicalRearGroups.length,0);
  assert.equal(validateV94PhysicalSixthBoundaryChoicesV1(
    recording,fifth,sixthChoices),true);
  const sixthFront=replayV94PhysicalSixthFrontKmV1(
    recording,fifth);
  assert.equal(sixthFront.sourceKm,6);
  assert.equal(sixthFront.sourceBreakRoadNotPhysical,true);
  assert.ok(sixthFront.road.every(turn=>
    turn.riderSlices.filter(row=>row.role==='leader').length===1&&
    turn.riderSlices.every(row=>
      row.decision.version===
        V94_PHYSICAL_SIXTH_FRONT_DECISION_VERSION)));
  assert.equal(sixthFront.remainingFieldRoadUnresolved,true);
  assert.equal(sixthFront.officialResults,false);
  assert.equal(validateV94PhysicalSixthFrontKmV1(
    recording,fifth,sixthFront),true);
  assert.throws(()=>replayV94PhysicalSixthKmV1(
    recording,fifth),error=>
    /rear\/front contact needs paid resolution/.test(
      error.message)&&
    error.sourceEvidence?.roadId==='solo-rival-18-5'&&
    error.sourceEvidence.atDistanceM>5000&&
    error.sourceEvidence.atDistanceM<6000);
  const forgedSixth=structuredClone(sixthRiders);
  forgedSixth.decisions[0].perceivedSoloAbility+=1;
  assert.throws(()=>validateV94PhysicalSixthRiderBoundaryV1(
    recording,fifth,forgedSixth),/differs from paid source/);
  assert.throws(()=>replayV94PhysicalNextKmV1(
    recording,fifth),error=>
    /lacks paid physical km5 contact/.test(error.message)&&
    error.sourceKm===6&&
    error.sourceEvidence.sourceRoads.every(row=>
      row.sourcePlanCannotAttach));
  const forgedSolo=structuredClone(freshSolos);
  forgedSolo.roads[0].earnedLeadSecondsAtBoundary+=1;
  assert.throws(()=>validateV94PhysicalFreshAttackSolosV1(
    recording,fourth,forgedSolo),/differ from paid source/);
  const forgedLaunch=structuredClone(launch);
  forgedLaunch.decisions[0].paidNewEnergy=1;
  assert.throws(()=>validateV94PhysicalFreshLaunchBoundaryV1(
    recording,fourth,forgedLaunch),
  /differs from paid source/);
});

test('paid boundary contacts support a complete second flat kilometre',()=>{
  const settings={distanceKm:120,teamCount:20,terrain:'flat',
    fatigue:0,attack:'none',chase:'selective',
    seed:'preview-recorded-road-1'};
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
  const second=replayV94PhysicalSecondRearKmV1(recording);
  assert.equal(second.fullFieldKilometre,true);
  assert.equal(second.finishes.length,160);
  assert.equal(second.physicalRearGroups.length,4);
  assert.ok(second.physicalRearGroups.every(group=>
    group.riderDecisions.filter(row=>row.role==='leader').length===1&&
    group.riderDecisions.some(row=>row.role==='sheltered'&&
      row.paidFromReserve<group.riderDecisions.find(item=>
        item.role==='leader').paidFromReserve)));
  assert.ok(second.finishes.every(row=>
    row.endDistanceM===2000&&
    Math.abs(row.energyBefore-row.paidFromReserve+
      row.recoveryAward-row.capAdjustment-row.energyAfter)<.001));
  assert.equal(second.officialResults,false);
  assert.equal(validateV94PhysicalSecondRearKmV1(
    recording,second),true);
  const forged=structuredClone(second);
  forged.finishes[0].energyAfter=100;
  assert.throws(()=>validateV94PhysicalSecondRearKmV1(
    recording,forged),/differs from paid source/);
  const fifth=replayV94PhysicalFifthKmV1(
    recording,replayV94PhysicalFourthKmV1(recording));
  const sixth=replayV94PhysicalSixthKmV1(recording,fifth);
  assert.equal(sixth.sourceKm,6);
  assert.equal(sixth.fullFieldKilometre,true);
  assert.equal(sixth.finishes.length,160);
  assert.equal(sixth.sourceBreakRoadNotPhysical,true);
  assert.equal(sixth.sourceCheckpointCalibrationFailed,true);
  assert.equal(sixth.officialResults,false);
  assert.deepEqual(sixth.sourceBreakRiderIds,
    fifth.freshAttackSoloRiderIds);
  assert.ok(sixth.sourceBreakRiderIds.every(id=>
    sixth.finishes.find(row=>row.riderId===id)
      .physicalGroup.startsWith('solo-')));
  assert.ok(sixth.physicalRearGroups.every(row=>
    row.kind==='rear_group'&&row.riderDecisions.length>=2));
  assert.ok(sixth.roads.every(road=>
    road.riderDecisions.every(row=>
      row.managerBreakWork==='cooperate'||
      row.managerBreakWork==='sit_on'||
      row.managerBreakWork==='drive')));
  assert.equal(validateV94PhysicalSixthKmV1(
    recording,fifth,sixth),true);
  const forgedSixth=structuredClone(sixth);
  forgedSixth.finishes[0].energyAfter+=1;
  assert.throws(()=>validateV94PhysicalSixthKmV1(
    recording,fifth,forgedSixth),
  /differs from paid source/);
  const seventh=replayV94PhysicalSeventhKmV1(
    recording,sixth);
  assert.equal(seventh.sourceKm,7);
  assert.equal(seventh.fullFieldKilometre,true);
  assert.equal(seventh.finishes.length,160);
  assert.equal(seventh.sourceCheckpointCalibrationFailed,true);
  assert.equal(seventh.officialResults,false);
  assert.deepEqual(seventh.sourceBreakRiderIds,
    sixth.sourceBreakRiderIds);
  assert.ok(seventh.sourceBreakRiderIds.every(id=>
    seventh.finishes.find(row=>row.riderId===id)
      .physicalGroup.startsWith('solo-')));
  assert.equal(validateV94PhysicalSeventhKmV1(
    recording,sixth,seventh),true);
  let next=seventh,priorAt18=null;
  for(let km=8;km<=19;km++){
    if(km===19)priorAt18=next;
    const candidate=replayV94PhysicalUnattachedSourceNextKmV1(
      recording,next);
    assert.equal(candidate.sourceKm,km);
    assert.equal(candidate.finishes.length,160);
    assert.equal(candidate.sourceCheckpointCalibrationFailed,true);
    assert.equal(candidate.officialResults,false);
    next=candidate;
  }
  assert.equal(validateV94PhysicalUnattachedSourceNextKmV1(
    recording,priorAt18,next),true);
  assert.throws(()=>replayV94PhysicalUnattachedSourceNextKmV1(
    recording,next),error=>
    /needs an intact paid plan/.test(error.message)&&
    error.sourceEvidence?.sourceKm===20&&
    error.sourceEvidence.attackers.length===2);
  const mixedFresh=replayV94PhysicalMixedFreshAttackSolosV1(
    recording,next);
  assert.equal(mixedFresh.sourceKm,20);
  assert.equal(mixedFresh.roads.length,2);
  assert.equal(mixedFresh.mixedSourceRoadClaims.length,1);
  assert.equal(mixedFresh.physicalRoadGroups.length,0);
  assert.equal(mixedFresh.oldBreakRoadMotionUnresolved,true);
  assert.equal(mixedFresh.sourceCheckpointCalibrationFailed,true);
  assert.equal(mixedFresh.officialResults,false);
  assert.ok(mixedFresh.roads.every(row=>
    Math.abs(row.energyBefore-row.sourcePaidFromReserve-
      row.sourceCapAdjustment-row.energyAfter)<.0015));
  assert.equal(validateV94PhysicalMixedFreshAttackSolosV1(
    recording,next,mixedFresh),true);
  const twentieth=replayV94PhysicalMixedFreshKmV1(
    recording,next);
  assert.equal(twentieth.sourceKm,20);
  assert.equal(twentieth.fullFieldKilometre,true);
  assert.equal(twentieth.finishes.length,160);
  assert.equal(twentieth.freshAttackSoloRiderIds.length,2);
  assert.equal(twentieth.sourceBreakRiderIds.length,4);
  assert.equal(twentieth.sourceBreakRoadNotPhysical,true);
  assert.equal(twentieth.sourceCheckpointCalibrationFailed,true);
  assert.equal(twentieth.officialResults,false);
  assert.ok(twentieth.sourceBreakRiderIds.every(id=>
    twentieth.finishes.find(row=>row.riderId===id)
      .physicalGroup.startsWith('solo-')));
  assert.equal(validateV94PhysicalMixedFreshKmV1(
    recording,next,twentieth),true);
  const twentyFirst=decideV94PhysicalForwardBoundaryChoicesV1(
    recording,twentieth);
  assert.equal(twentyFirst.sourceKm,21);
  assert.ok(twentyFirst.forwardCandidateSets>0);
  assert.ok(twentyFirst.choices.filter(row=>
    row.forwardContactCandidate).every(row=>
    row.riderDecisions.every(decision=>
      decision.sourceBreakMembershipClaim&&
      decision.managerBreakWork==='cooperate')));
  const forwardChoice=twentyFirst.choices.find(row=>
    row.forwardContactCandidate);
  assert.equal(forwardChoice.pendingLeaderRiderId,
    'rival-16-5');
  assert.deepEqual(forwardChoice.pendingShelterRiderIds,
    ['rival-8-5']);
  assert.equal(forwardChoice.formsRearGroup,false);
  assert.ok(forwardChoice.riderDecisions.find(row=>
    row.riderId==='rival-8-5').quotedShelterEnergyDemand<
    forwardChoice.riderDecisions.find(row=>
      row.riderId==='rival-16-5').quotedLeaderEnergyDemand);
  assert.equal(validateV94PhysicalForwardBoundaryChoicesV1(
    recording,twentieth,twentyFirst),true);
  assert.throws(()=>replayV94PhysicalUnattachedSourceNextKmV1(
    recording,twentieth),error=>
    /Attached front energy differs/.test(error.message)&&
    error.sourceEvidence?.sourceKm===21);
  const rested=replayV94PhysicalRecordedRestKmV1(
    recording,twentieth);
  assert.equal(rested.sourceKm,21);
  assert.equal(rested.fullFieldKilometre,true);
  assert.equal(rested.finishes.length,160);
  assert.equal(rested.newFrontDrops.length,31);
  assert.equal(rested.sourceRestDecisionUsed,true);
  assert.equal(rested.sourceCheckpointCalibrationFailed,true);
  assert.equal(rested.officialResults,false);
  assert.ok(rested.sourceBreakRiderIds.filter(id=>
    rested.finishes.find(row=>row.riderId===id)
      .physicalGroup.startsWith('paid-contact-')).length===2);
  assert.ok(rested.front.road.some(turn=>
    turn.riderSlices.some(row=>
      row.decision.teamOrderEffort==='steady'&&
      row.decision.effectiveEffort==='conserve'&&
      row.decision.recordedSourceRest)));
  assert.equal(validateV94PhysicalRecordedRestKmV1(
    recording,twentieth,rested),true);
  let afterRest=rested,priorAt26=null;
  for(let km=22;km<=27;km++){
    if(km===27)priorAt26=afterRest;
    afterRest=replayV94PhysicalRecordedRestKmV1(
      recording,afterRest);
    assert.equal(afterRest.sourceKm,km);
    assert.equal(afterRest.finishes.length,160);
    assert.equal(afterRest.sourceCheckpointCalibrationFailed,true);
  }
  assert.equal(validateV94PhysicalRecordedRestKmV1(
    recording,priorAt26,afterRest),true);
  assert.throws(()=>replayV94PhysicalRecordedRestKmV1(
    recording,afterRest),error=>
    /Physical rear roads need paid contact resolution/.test(
      error.message)&&
    error.sourceEvidence?.atDistanceM>27000&&
    error.sourceEvidence?.atDistanceM<28000&&
    error.sourceEvidence?.roadEvidence?.length===2&&
    error.sourceEvidence.roadEvidence.every(row=>
      row.riderIds.includes(row.leaderRiderId)&&
      row.previousGroupIds.length>0&&
      Number.isFinite(row.speedMps)));
  const crossing=decideV94PhysicalMidKmContactChoiceV1(
    recording,afterRest);
  assert.equal(crossing.sourceKm,28);
  assert.equal(crossing.formsRearGroup,false);
  assert.equal(crossing.officialResults,false);
  assert.equal(crossing.pendingLeaderRiderId,'rival-6-5');
  assert.equal(crossing.pendingShelterRiderIds.length,18);
  assert.equal(crossing.candidates.find(row=>
    row.riderId==='rival-6-5').sourceBreakMembershipClaim,
  true);
  assert.equal(crossing.candidates.length,
    crossing.observedRoads.reduce((sum,road)=>
      sum+road.riderIds.length,0));
  assert.ok(crossing.candidates.every(row=>
    row.paidEnergyToContact>0&&
    row.energyAtContact<row.energyBeforeKm&&
    row.quotedShelterEnergyDemand<
      row.quotedLeaderEnergyDemand));
  assert.equal(validateV94PhysicalMidKmContactChoiceV1(
    recording,afterRest,crossing),true);
  const fragment=replayV94PhysicalMidKmContactFragmentV1(
    recording,afterRest);
  assert.equal(fragment.sourceKm,28);
  assert.equal(fragment.road.leaderRiderId,'rival-6-5');
  assert.equal(fragment.riderWork.length,19);
  assert.equal(fragment.paidContactGroupFragment,true);
  assert.equal(fragment.otherRoadContactsUnchecked,true);
  assert.equal(fragment.fullFieldKilometre,false);
  assert.equal(fragment.officialResults,false);
  assert.ok(fragment.riderWork.every(row=>
    row.paidEnergyToContact>0&&
    row.paidEnergyAfterContact>0&&
    row.finishClockSeconds===
      fragment.road.finishClockSeconds));
  assert.equal(validateV94PhysicalMidKmContactFragmentV1(
    recording,afterRest,fragment),true);
  const contactRoads=inspectV94PhysicalMidKmContactRoadsV1(
    recording,afterRest);
  assert.equal(contactRoads.sourceKm,28);
  assert.ok(contactRoads.checkedRearRoadCount>2);
  assert.ok(contactRoads.checkedFrontSegmentCount>0);
  assert.equal(contactRoads.frontDropCount,0);
  assert.equal(contactRoads.frontDropsUnchecked,false);
  assert.equal(contactRoads.firstOtherContact,null);
  assert.equal(contactRoads.fullFieldKilometre,false);
  assert.equal(validateV94PhysicalMidKmContactRoadsV1(
    recording,afterRest,contactRoads),true);
  const contactedField=
    replayV94PhysicalMidKmContactFullFieldV1(
      recording,afterRest);
  assert.equal(contactedField.sourceKm,28);
  assert.equal(contactedField.fullFieldKilometre,true);
  assert.equal(contactedField.officialResults,false);
  assert.equal(contactedField.finishes.length,160);
  assert.equal(contactedField.finishes.filter(row=>
    row.physicalGroup===fragment.road.roadId).length,19);
  assert.equal(contactedField.sourceCheckpointCalibrationFailed,
    true);
  assert.equal(validateV94PhysicalMidKmContactFullFieldV1(
    recording,afterRest,contactedField),true);
  assert.throws(()=>replayV94PhysicalUnattachedSourceNextKmV1(
    recording,contactedField),
  /Mixed forward\/rear contact needs paid joint choice/);
  const mixedBoundary=
    decideV94PhysicalForwardBoundaryChoicesV1(
      recording,contactedField,
      {allowPaidMixedContact:true});
  const joint=mixedBoundary.choices.find(row=>
    row.mixedPaidContact);
  assert.equal(joint?.riderIds.length,19);
  assert.equal(joint?.formsRearGroup,false);
  assert.equal(joint?.pendingLeaderRiderId,'rival-6-5');
  assert.equal(joint?.pendingShelterRiderIds.length,18);
  assert.equal(validateV94PhysicalForwardBoundaryChoicesV1(
    recording,contactedField,mixedBoundary,
    {allowPaidMixedContact:true}),true);
  const mixedNext=replayV94PhysicalMixedPaidNextKmV1(
    recording,contactedField);
  assert.equal(mixedNext.sourceKm,29);
  assert.equal(mixedNext.finishes.length,160);
  assert.equal(mixedNext.mixedPaidContactFromPrior,true);
  assert.equal(mixedNext.sourceCheckpointCalibrationFailed,
    true);
  assert.equal(validateV94PhysicalMixedPaidNextKmV1(
    recording,contactedField,mixedNext),true);
});

test('second-km road clocks refuse a faster rear catch',()=>{
  const ahead={roadId:'ahead',startClockSeconds:0,
    finishClockSeconds:100,speedMps:10};
  const behind={roadId:'behind',startClockSeconds:10,
    finishClockSeconds:60,speedMps:20};
  const meeting=firstV94SecondRearRoadContactV1(ahead,behind);
  assert.deepEqual(meeting.roadIds,['ahead','behind']);
  assert.equal(meeting.clockSeconds,20);
  assert.equal(meeting.atDistanceM,1200);
  const front={road:[{startM:0,startClockSeconds:0,
    endClockSeconds:100,leaderSpeedKph:36}]};
  assert.equal(firstV94SecondFrontContactV1(front,behind)
    .clockSeconds,20);
  assert.equal(firstV94SecondRearRoadContactV1(ahead,{
    ...behind,speedMps:5,finishClockSeconds:210}),null);
  const drop=[{startClockSeconds:0,endClockSeconds:100,
    startDistanceM:1000,endDistanceM:2000}];
  const rear=[{startClockSeconds:10,endClockSeconds:60,
    startDistanceM:1000,endDistanceM:2000}];
  assert.equal(firstV94SecondPiecewiseContactV1(drop,rear)
    .clockSeconds,20);
  const sharedA=[{startClockSeconds:0,endClockSeconds:10,
    startDistanceM:1000,endDistanceM:1100},
  {startClockSeconds:10,endClockSeconds:20,
    startDistanceM:1100,endDistanceM:1150}];
  const sharedB=[{startClockSeconds:0,endClockSeconds:10,
    startDistanceM:1000,endDistanceM:1050},
  {startClockSeconds:10,endClockSeconds:20,
    startDistanceM:1050,endDistanceM:1150}];
  assert.equal(firstV94SecondPiecewiseContactV1(
    sharedA,sharedB,{sharedOrigin:true}).clockSeconds,20);
});
