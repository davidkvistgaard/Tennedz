import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest,
  V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {recordFinaleCoastMixedTwoFrontDroppedClock,
  validateFinaleCoastMixedTwoFrontDroppedClock,
  FINALE_COAST_MIXED_TWO_FRONT_DROPPED_CLOCK_VERSION} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';
import {recordFinaleCoastedIndividualLine} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedPre500Audit,
  recordFinaleMixedTwoFrontDroppedFreshPre500Audit,
  FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION,
  validateFinaleMixedTwoFrontDroppedPre500Audit} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedFinal500Audit,
  recordFinaleMixedTwoFrontDroppedFreshFinal500Audit,
  FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_FINAL500_AUDIT_VERSION,
  validateFinaleMixedTwoFrontDroppedFinal500Audit} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-final500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedResult,
  validateFinaleMixedTwoFrontDroppedResult} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-result.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshResult,
  validateFinaleMixedTwoFrontDroppedFreshResult} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-fresh-result.mjs';

function settingsFor(teamCount,gender,terrain,fatigue){
  return {distanceKm:260,teamCount,gender,terrain,fatigue,
    seed:`v93-heterogeneous-${teamCount}-${gender}-${terrain}-${fatigue}`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','steady','conserve'][index%3],
      attack:index%3===0?'repeated':'selective',
      chase:index%3===1?'all':'selective'})),
    teamOverrides:[{teamId:'you',level:45},
      ...Array.from({length:teamCount-1},(_,index)=>({
        teamId:`rival-${index+1}`,level:index%2===0?25:65}))],
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'steady',chase:'all'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
}

function recordingFor(settings){
  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  return simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
}

test('unequal-strength whole race pays bounded two-front lanes',()=>{
  const settings=settingsFor(4,'M','flat',30);
  let refusal;
  try{createV93PlayableTest(settings,{},
    {resolveMixedTwoFrontDroppedLanes:false});}
  catch(error){refusal=error;}
  assert.match(refusal?.message??'',
    /The depleted line bands crossed without contact/);
  assert.equal(refusal.roadPreview.unsupportedReason,
    'unresolved_band_contact');
  assert.deepEqual(refusal.roadPreview.kilometreFrames.at(-1)
    .roadGroups.map(row=>[row.id,row.riderIds.length]),
  [['road-2',4],['road-4',4]]);
  assert.equal(refusal.roadPreview.lastKmRoad.length,0);
  assert.equal(refusal.roadPreview.lineTimes,null);
  assert.equal(refusal.roadPreview.pointsStatus,'withheld');
  assert.equal(refusal.roadPreview.canCommitAwards,false);
  const playable=createV93PlayableTest(settings);
  assert.equal(playable.version,
    V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,{},playable),true);
  const summary=summarizeV93CoastedPlaytest(playable);
  assert.equal(summary.lineTimes.length,32);
  assert.equal(summary.lastKmRoad.length,7);
  assert.equal(summary.bandReplays.flatMap(row=>row.riderIds).length,32);
  assert.equal(summary.mixedTwoFrontOlderDrops
    .inferredOutsideLaneCount,16);
  assert.equal(summary.classifiedResults,null);
  assert.equal(summary.pointsStatus,'withheld');

  const recording=recordingFor(settings);
  const source=finaleSnapshotFromTour(recording,{remainingKm:1,
    includeAttackLoad:true});
  const trace=probeFinaleSeparatedGroupsFromTour(recording,{
    version:FINALE_COAST_DYNAMIC_FRONT_LAST_KM_VERSION});
  assert.equal(source.droppedRiderIds.length,12);
  assert.equal(trace.frames.length,7);
  const exits=trace.frames.flatMap(frame=>frame.frontExhaustionDrops);
  assert.equal(exits.length,4);
  assert.deepEqual([...new Set(exits.map(row=>row.fromRoadGroupId))],
    ['road-2','road-4']);
  assert.ok(exits.every(row=>row.atDistanceM===259000));
  assert.ok(trace.frames.every(frame=>
    frame.roadGroups.length===2&&
    !frame.exhaustionDrops.length&&
    !frame.frontGroupDissolutions?.length));
  const candidate=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
  assert.equal(candidate.version,
    FINALE_COAST_MIXED_TWO_FRONT_DROPPED_CLOCK_VERSION);
  assert.equal(candidate.line.outcome,
    'mixed_two_front_leavers_with_older_drops_clear');
  assert.deepEqual(candidate.line.bands.map(row=>row.riderIds.length),
    [4,4,12,12]);
  assert.equal(candidate.trace.finalRiderEnergy.length,32);
  assert.equal(candidate.passageFrames.length,7);
  assert.equal(validateFinaleCoastMixedTwoFrontDroppedClock(recording,
    candidate),true);
  const line=recordFinaleCoastedIndividualLine(recording,candidate);
  assert.equal(line.conditionalCrossings.length,32);
  assert.equal(line.roadStatus,
    'conditional_mixed_two_front_older_drops_lines');
  assert.equal(line.pre500Audit.contactResolved,false);
  assert.equal(line.provisionalLineOrder,null);
  const at500=new Map(candidate.trace.frames.find(frame=>
    frame.endDistanceM===259500).riders.map(row=>[
    row.riderId,row.energy]));
  const crossings=new Map(line.conditionalCrossings.map(row=>[
    row.riderId,row]));
  const finished=new Set();
  for(const band of line.bandRunners){
    for(const row of band.runner.frames[0].riders)
      assert.ok(Math.abs(row.energyAtDecision-at500.get(row.riderId))<1e-7);
    for(const row of band.runner.finishers){
      assert.equal(finished.has(row.riderId),false);
      finished.add(row.riderId);
      assert.ok(Math.abs(row.energyAtLine-
        crossings.get(row.riderId).energyAtLine)<1e-7);
    }
  }
  assert.equal(finished.size,32);
  const audit=recordFinaleMixedTwoFrontDroppedPre500Audit(recording,
    candidate,line);
  assert.equal(audit.sourceAdjacentPairs,72);
  assert.equal(audit.paidRiderCount,32);
  assert.equal(audit.handoffDistanceM,259500);
  assert.equal(audit.outsideLaneAssignments.length,16);
  assert.equal(new Set(audit.outsideLaneAssignments.map(row=>
    row.outsideLane)).size,16);
  assert.equal(audit.contactResolved,false);
  assert.equal(audit.pointsStatus,'withheld');
  assert.equal(validateFinaleMixedTwoFrontDroppedPre500Audit(recording,
    candidate,line,audit),true);
  const finalAudit=recordFinaleMixedTwoFrontDroppedFinal500Audit(
    recording,candidate,line,audit);
  assert.equal(finalAudit.paidRiderCount,32);
  assert.ok(finalAudit.sourceAdjacentPairs>0);
  assert.equal(finalAudit.outsideLaneAssignments.length,16);
  assert.equal(finalAudit.contactResolved,false);
  assert.equal(validateFinaleMixedTwoFrontDroppedFinal500Audit(recording,
    candidate,line,audit,finalAudit),true);
  const result=recordFinaleMixedTwoFrontDroppedResult(recording);
  assert.equal(result.line.conditionalCrossings.length,32);
  assert.equal(result.final500Audit.paidRiderCount,32);
  assert.equal(result.roadStatus,
    'conditional_mixed_two_front_older_drops_outside_lanes');
  assert.equal(result.pointPreview,null);
  assert.equal(result.classifiedResults,null);
  assert.equal(result.canCommitAwards,false);
  assert.equal(validateFinaleMixedTwoFrontDroppedResult(recording,{},
    result),true);
});

test('nearby genders stay bounded and a fresh approach is refused',()=>{
  const female=recordingFor(settingsFor(4,'F','flat',30));
  const femaleClock=recordFinaleCoastMixedTwoFrontDroppedClock(female);
  const femaleLine=recordFinaleCoastedIndividualLine(female,femaleClock);
  const femaleAudit=recordFinaleMixedTwoFrontDroppedPre500Audit(female,
    femaleClock,femaleLine);
  assert.equal(femaleAudit.sourceAdjacentPairs,72);
  assert.equal(femaleAudit.paidRiderCount,32);
  const femaleFinalAudit=recordFinaleMixedTwoFrontDroppedFinal500Audit(
    female,femaleClock,femaleLine,femaleAudit);
  assert.equal(femaleFinalAudit.paidRiderCount,32);
  assert.equal(femaleFinalAudit.contactResolved,false);
  const femaleResult=recordFinaleMixedTwoFrontDroppedResult(female);
  assert.equal(femaleResult.line.conditionalCrossings.length,32);
  const large=recordingFor(settingsFor(15,'M','flat',30));
  const largeClock=recordFinaleCoastMixedTwoFrontDroppedClock(large);
  const largeLine=recordFinaleCoastedIndividualLine(large,largeClock);
  assert.throws(()=>recordFinaleMixedTwoFrontDroppedPre500Audit(large,
    largeClock,largeLine),/new unpaid approach/);
  assert.throws(()=>recordFinaleMixedTwoFrontDroppedResult(large),
    /new unpaid approach/);
});

test('15-team fresh source-wheel approach is paid but remains internal',()=>{
  for(const [gender,behindId,behindEnergy] of [
    ['M','rival-9-7',28.324971361861888],
    ['F','rival-5-7',5.735971361105568]]){
    const settings=settingsFor(15,gender,'flat',30);
    const recording=recordingFor(settings);
    const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
    const line=recordFinaleCoastedIndividualLine(recording,clock);
    assert.equal(line.conditionalCrossings.length,120);
    const audit=recordFinaleMixedTwoFrontDroppedFreshPre500Audit(
      recording,clock,line);
    const approach=audit.firstFreshApproach;
    assert.equal(audit.version,
      FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION);
    assert.equal(audit.paidRiderCount,120);
    assert.equal(approach.firstRiderId,'rival-10-5');
    assert.equal(approach.secondRiderId,behindId);
    assert.ok(Math.abs(approach.firstWheelM-
      approach.secondWheelM-2.5)<1e-7);
    assert.equal(approach.firstEnergy,0);
    assert.ok(Math.abs(approach.secondEnergy-behindEnergy)<1e-7);
    for(const [key,energy,position] of [
      ['first',approach.firstEnergy,approach.firstWheelM],
      ['second',approach.secondEnergy,approach.secondWheelM]]){
      const row=approach.paidSplit[key].frames.at(-1).riders[0];
      assert.ok(Math.abs(row.positionM-position)<1e-7);
      assert.ok(Math.abs(row.energyAfter-energy)<1e-7);
      assert.ok(Math.abs(row.energyAtDecision-row.energySpent-
        row.energyAfter)<1e-7);
    }
    assert.equal(audit.contactResolved,false);
    assert.equal(audit.classifiedResults,null);
    assert.equal(audit.pointsStatus,'withheld');
    const finalAudit=recordFinaleMixedTwoFrontDroppedFreshFinal500Audit(
      recording,clock,line,audit);
    assert.equal(finalAudit.version,
      FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_FINAL500_AUDIT_VERSION);
    assert.equal(finalAudit.paidRiderCount,120);
    assert.equal(finalAudit.freshApproaches.length,2);
    assert.ok(finalAudit.freshApproaches[0]
      .elapsedSecondsFromLastKmStart<finalAudit.freshApproaches[1]
      .elapsedSecondsFromLastKmStart);
    assert.equal(finalAudit.contactResolved,false);
    for(const event of finalAudit.freshApproaches){
      assert.ok(Math.abs(event.firstWheelM-event.secondWheelM-2.5)<1e-7);
      assert.ok(event.firstWheelM>259500);
      for(const [key,energy] of [
        ['first',event.firstEnergy],['second',event.secondEnergy]]){
        const row=event.paidSplit[key].frames.at(-1).riders[0];
        assert.ok(Math.abs(row.energyAfter-energy)<1e-7);
      }
    }
    const candidate=recordFinaleMixedTwoFrontDroppedFreshResult(recording);
    assert.equal(candidate.line.conditionalCrossings.length,120);
    assert.equal(candidate.clock.passageFrames.length,7);
    assert.equal(candidate.classifiedResults,null);
    assert.equal(candidate.pointsStatus,'withheld');
    assert.equal(validateFinaleMixedTwoFrontDroppedFreshResult(recording,
      {},candidate),true);
    assert.throws(()=>recordFinaleMixedTwoFrontDroppedPre500Audit(
      recording,clock,line),/new unpaid approach/);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontFreshLanes:false}),
      /depleted line bands crossed without contact/);
    const playable=createV93PlayableTest(settings);
    assert.equal(playable.version,
      V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION);
    assert.equal(validateV93CoastedPlaytest(settings,{},playable),true);
    const summary=summarizeV93CoastedPlaytest(playable);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.lastKmRoad.length,7);
    assert.equal(summary.mixedTwoFrontOlderDrops
      .freshWheelApproaches.length,3);
    assert.equal(summary.classifiedResults,null);
    assert.equal(summary.pointsStatus,'withheld');
  }
});
