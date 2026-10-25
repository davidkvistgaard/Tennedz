import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,validateV93CoastedPlaytest,
  summarizeV93CoastedPlaytest,
  V93_MIXED_TWO_FRONT_DROPPED_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_SEVEN_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_ELEVEN_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_THIRTEEN_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_BOUNDED_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_SHORT_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_SEVEN_ONEFRONT_PARALLEL_FINAL_PLAYTEST_VERSION,
  V93_MIXED_TWO_FRONT_BOUNDED_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION} from
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
import {recordFinaleCoastedIndividualLine,
  validateFinaleDepletedIndividualLine,
  FINALE_MULTIFRONT_PARALLEL_FINAL_INDIVIDUAL_LINE_VERSION} from
  '../../lib/engine/v2/finale-depleted-individual-line.mjs';
import {recordFinaleMixedTwoFrontDroppedPre500Audit,
  recordFinaleMixedTwoFrontDroppedFreshPre500Audit,
  recordFinaleMixedTwoFrontDroppedManyPre500Audit,
  recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit,
  recordFinaleMixedTwoFrontDroppedFourteenMultifrontPre500Audit,
  FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PRE500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_FOURTEEN_MULTIFRONT_PRE500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_PRE500_AUDIT_VERSION,
  validateFinaleMixedTwoFrontDroppedPre500Audit} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-pre500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedFinal500Audit,
  recordFinaleMixedTwoFrontDroppedFreshFinal500Audit,
  recordFinaleMixedTwoFrontDroppedManyFinal500Audit,
  recordFinaleMixedTwoFrontDroppedFreshPre500ManyFinal500Audit,
  recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit,
  recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit,
  recordFinaleMixedTwoFrontDroppedFourteenMultifrontFinal500Audit,
  recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalAudit,
  FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_FINAL500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_FINAL500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_FOURTEEN_MULTIFRONT_FINAL500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PARALLEL_FINAL_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_MANY_FINAL500_AUDIT_VERSION,
  FINALE_MIXED_TWO_FRONT_DROPPED_FRESH_FINAL500_AUDIT_VERSION,
  validateFinaleMixedTwoFrontDroppedFinal500Audit} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-final500-audit.mjs';
import {recordFinaleMixedTwoFrontDroppedResult,
  validateFinaleMixedTwoFrontDroppedResult} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-result.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshResult,
  validateFinaleMixedTwoFrontDroppedFreshResult} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-fresh-result.mjs';
import {recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result,
  validateFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-clean-pre500-fresh-final500-result.mjs';
import {recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result,
  validateFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-fresh-pre500-clean-final500-result.mjs';
import {recordFinaleMixedTwoFrontDroppedManyPre500Result,
  validateFinaleMixedTwoFrontDroppedManyPre500Result,
  recordFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult,
  validateFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult,
  recordFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult,
  validateFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult,
  FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_CLEAN_FINAL_RESULT_VERSION,
  recordFinaleMixedTwoFrontDroppedCrowdedMultifrontResult,
  validateFinaleMixedTwoFrontDroppedCrowdedMultifrontResult,
  FINALE_MIXED_TWO_FRONT_DROPPED_CROWDED_MULTIFRONT_RESULT_VERSION,
  recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult,
  validateFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult,
  FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION} from
  '../../lib/engine/v2/finale-mixed-two-front-dropped-many-pre500-result.mjs';

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

test('thirteen paid two-front exits and a clean fixed-lane final half finish conditionally',
  ()=>{
    const settings=settingsFor(20,'F','mountain',30);
    settings.seed+='-alternate-1';
    const race=createV93PlayableTest(settings);
    assert.equal(race.version,
      V93_MIXED_TWO_FRONT_THIRTEEN_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION);
    const result=race.mixedTwoFrontResult;
    assert.equal(result.pre500Audit.freshApproaches.length,13);
    assert.deepEqual(new Set(result.pre500Audit.freshApproaches.map(row=>
      row.sourceRoadGroupId)),new Set(['road-2','road-4']));
    assert.equal(result.final500Audit.freshApproaches.length,0);
    assert.equal(result.line.conditionalCrossings.length,160);
    assert.equal(result.clock.passageFrames.length,7);
    assert.equal(result.line.bandRunners.find(row=>row.roadBandId==='road-2')
      .runner.passingRule,'fixed-source-lane-queue-lab-1');
    assert.equal(race.classifiedResults,null);
    assert.equal(race.pointsStatus,'withheld');
    assert.equal(race.canCommitAwards,false);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.bandReplays.flatMap(row=>row.riderIds).length,160);
    assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontThirteenMultifrontCleanFinal:false}),
    /depleted line bands crossed without contact/i);
  });

test('fourteen alternate-seed source-wheel approaches remain an internal audit',
  ()=>{
    for(const [terrain,lateCount] of [['rolling',0],['custom',1]]){
      const settings=settingsFor(20,'M',terrain,30);
      settings.seed+='-alternate-3';
      const recording=recordingFor(settings);
      const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
      const line=recordFinaleCoastedIndividualLine(recording,clock,{
        laneQueuedBandIds:['road-2']});
      assert.throws(()=>recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(
        recording,clock,line),/bounded geometry/);
      const audit=recordFinaleMixedTwoFrontDroppedFourteenMultifrontPre500Audit(
        recording,clock,line);
      assert.equal(audit.version,
        FINALE_MIXED_TWO_FRONT_DROPPED_FOURTEEN_MULTIFRONT_PRE500_AUDIT_VERSION);
      assert.equal(audit.paidRiderCount,160);
      assert.equal(audit.freshApproaches.length,14);
      assert.ok(audit.freshApproaches.every(row=>
        row.firstEnergy===0&&row.secondEnergy>0&&
        Math.abs(Math.abs(row.firstWheelM-row.secondWheelM)-2.5)<1e-7&&
        row.contactResolved===false));
      assert.equal(audit.contactResolved,false);
      assert.equal(audit.classifiedResults,null);
      assert.equal(audit.pointsStatus,'withheld');
      assert.equal(audit.canCommitAwards,false);
      const final=recordFinaleMixedTwoFrontDroppedFourteenMultifrontFinal500Audit(
        recording,clock,line,audit);
      assert.equal(final.version,
        FINALE_MIXED_TWO_FRONT_DROPPED_FOURTEEN_MULTIFRONT_FINAL500_AUDIT_VERSION);
      assert.equal(final.paidRiderCount,160);
      assert.equal(final.freshApproaches.length,lateCount);
      if(lateCount){
        const [event]=final.freshApproaches;
        assert.equal(event.firstRiderId,'rival-5-7');
        assert.equal(event.secondRiderId,'rival-3-7');
        assert.ok(Math.abs(event.firstWheelM-259803.13812325842)<1e-7);
        assert.equal(event.contactResolved,false);
      }
      assert.equal(final.contactResolved,false);
      assert.equal(final.classifiedResults,null);
      assert.equal(final.pointsStatus,'withheld');
      assert.equal(final.canCommitAwards,false);
    }
  });

test('bounded two-front exits pay clean and parallel final halves without awards',
  ()=>{
    for(const [gender,terrain,fatigue,seedTag,preCount,finalCount,sources,version] of [
      ['M','mountain',0,'alternate-2',12,0,['road-2'],
        V93_MIXED_TWO_FRONT_BOUNDED_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION],
      ['F','mountain',0,'alternate-2',9,0,['road-2'],
        V93_MIXED_TWO_FRONT_BOUNDED_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION],
      ['F','flat',30,'alternate-2',6,1,['road-2','road-4'],
        V93_MIXED_TWO_FRONT_BOUNDED_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION],
      ['F','rolling',30,'alternate-3',4,0,['road-2','road-4'],
        V93_MIXED_TWO_FRONT_SHORT_MULTIFRONT_CLEAN_FINAL_PLAYTEST_VERSION],
      ['F','mountain',0,'alternate-3',7,1,['road-2'],
        V93_MIXED_TWO_FRONT_SEVEN_ONEFRONT_PARALLEL_FINAL_PLAYTEST_VERSION]]){
      const settings=settingsFor(20,gender,terrain,fatigue);
      settings.seed+=`-${seedTag}`;
      const race=createV93PlayableTest(settings);
      assert.equal(race.version,version);
      const result=race.mixedTwoFrontResult;
      assert.equal(result.pre500Audit.freshApproaches.length,preCount);
      assert.deepEqual(new Set(result.pre500Audit.freshApproaches.map(row=>
        row.sourceRoadGroupId)),new Set(sources));
      assert.equal(result.final500Audit.freshApproaches.length,finalCount);
      if(finalCount)assert.equal(result.final500Audit
        .parallelFinalLaneEvidence.noDraftAfterApproach,true);
      assert.equal(result.line.conditionalCrossings.length,160);
      assert.equal(result.clock.passageFrames.length,7);
      assert.equal(result.line.bandRunners.find(row=>
        row.roadBandId==='road-2').runner.passingRule,
      'fixed-source-lane-queue-lab-1');
      assert.equal(race.classifiedResults,null);
      assert.equal(race.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(summary.lineTimes.length,160);
      assert.equal(summary.bandReplays.flatMap(row=>row.riderIds).length,160);
      assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
      assert.throws(()=>createV93PlayableTest(settings,{},
        {resolveMixedTwoFrontBoundedMultifrontCleanFinal:false,
          resolveMixedTwoFrontBoundedMultifrontParallelFinal:false,
          resolveMixedTwoFrontShortMultifrontCleanFinal:false,
          resolveMixedTwoFrontSevenOnefrontParallelFinal:false}),
      /depleted line bands crossed without contact/i);
    }
  });

test('eleven source exits and one fixed-lane final approach finish conditionally',
  ()=>{
    const settings=settingsFor(20,'F','exposed',30);
    settings.seed+='-alternate-1';
    const race=createV93PlayableTest(settings);
    assert.equal(race.version,
      V93_MIXED_TWO_FRONT_ELEVEN_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION);
    const result=race.mixedTwoFrontResult;
    assert.equal(result.pre500Audit.freshApproaches.length,11);
    assert.deepEqual(new Set(result.pre500Audit.freshApproaches.map(row=>
      row.sourceRoadGroupId)),new Set(['road-2','road-4']));
    assert.equal(result.final500Audit.freshApproaches.length,1);
    assert.deepEqual(result.final500Audit.parallelFinalLaneEvidence,{
      firstRiderId:'rival-17-7',secondRiderId:'rival-3-7',
      roadBandId:'road-2',firstLane:2,secondLane:3,
      noDraftAfterApproach:true,fixedSourceLanes:true});
    assert.equal(result.line.conditionalCrossings.length,160);
    assert.equal(result.clock.passageFrames.length,7);
    assert.equal(race.classifiedResults,null);
    assert.equal(race.pointsStatus,'withheld');
    assert.equal(race.canCommitAwards,false);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.bandReplays.flatMap(row=>row.riderIds).length,160);
    assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontElevenMultifrontParallelFinal:false}),
    /depleted line bands crossed without contact/i);
  });

test('seven paid first-half approaches with a clean final half finish conditionally',
  ()=>{
    const settings=settingsFor(20,'M','mountain',0);
    settings.seed+='-alternate-1';
    const race=createV93PlayableTest(settings);
    assert.equal(race.version,
      V93_MIXED_TWO_FRONT_SEVEN_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION);
    assert.equal(race.mixedTwoFrontResult.pre500Audit.freshApproaches.length,7);
    assert.equal(race.mixedTwoFrontResult.final500Audit.freshApproaches.length,0);
    assert.equal(race.mixedTwoFrontResult.line.conditionalCrossings.length,160);
    assert.equal(race.mixedTwoFrontResult.clock.passageFrames.length,7);
    assert.equal(race.classifiedResults,null);
    assert.equal(race.pointsStatus,'withheld');
    assert.equal(race.canCommitAwards,false);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.bandReplays.flatMap(row=>row.riderIds).length,160);
    assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontSevenPre500CleanFinalLanes:false}),
    /depleted line bands crossed without contact/i);
  });

test('five paid first-half approaches with a clean final half finish conditionally',
  ()=>{
    const settings=settingsFor(20,'F','mountain',0);
    settings.seed+='-alternate-1';
    const race=createV93PlayableTest(settings);
    assert.equal(race.version,
      V93_MIXED_TWO_FRONT_FIVE_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION);
    assert.equal(race.mixedTwoFrontResult.pre500Audit.freshApproaches.length,5);
    assert.equal(race.mixedTwoFrontResult.final500Audit.freshApproaches.length,0);
    assert.equal(race.mixedTwoFrontResult.line.conditionalCrossings.length,160);
    assert.equal(race.mixedTwoFrontResult.clock.passageFrames.length,7);
    assert.equal(race.classifiedResults,null);
    assert.equal(race.pointsStatus,'withheld');
    assert.equal(race.canCommitAwards,false);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.bandReplays.flatMap(row=>row.riderIds).length,160);
    assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontFivePre500CleanFinalLanes:false}),
    /depleted line bands crossed without contact/i);
  });

test('two surviving fronts retain separate paid first-half approaches',
  ()=>{
    for(const [gender,terrain,expected] of [
      ['F','flat',7],['M','flat',10],['F','rolling',6],
      ['F','mountain',10],['M','custom',8],['F','custom',8]]){
      const settings=settingsFor(20,gender,terrain,30);
      const recording=recordingFor(settings);
      const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
      const line=recordFinaleCoastedIndividualLine(recording,clock);
      assert.throws(()=>recordFinaleMixedTwoFrontDroppedManyPre500Audit(
        recording,clock,line),/lacks paid spacing/);
      const audit=recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(
        recording,clock,line);
      assert.equal(audit.version,
        FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PRE500_AUDIT_VERSION);
      assert.equal(audit.paidRiderCount,160);
      assert.equal(audit.freshApproaches.length,expected);
      assert.deepEqual(new Set(audit.freshApproaches.map(row=>
        row.sourceRoadGroupId)),new Set(['road-2','road-4']));
      assert.ok(audit.freshApproaches.every(row=>
        row.firstEnergy===0&&row.secondEnergy>0&&
        Math.abs(Math.abs(row.firstWheelM-row.secondWheelM)-2.5)<1e-7&&
        Math.abs(row.paidSplit.first.frames.at(-1).riders[0].energyAfter-
          row.firstEnergy)<1e-7&&
        Math.abs(row.paidSplit.second.frames.at(-1).riders[0].energyAfter-
          row.secondEnergy)<1e-7&&row.contactResolved===false));
      assert.equal(audit.contactResolved,false);
      assert.equal(audit.classifiedResults,null);
      assert.equal(audit.pointsStatus,'withheld');
      assert.equal(audit.canCommitAwards,false);
      const final=recordFinaleMixedTwoFrontDroppedMultifrontFinal500Audit(
        recording,clock,line,audit);
      assert.equal(final.version,
        FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_FINAL500_AUDIT_VERSION);
      assert.equal(final.paidRiderCount,160);
      assert.equal(final.freshApproaches.length,0);
      assert.equal(final.contactResolved,false);
      assert.equal(final.classifiedResults,null);
      assert.equal(final.pointsStatus,'withheld');
      assert.equal(final.canCommitAwards,false);
      const result=recordFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
        recording);
      assert.equal(result.version,
        FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_CLEAN_FINAL_RESULT_VERSION);
      assert.equal(result.line.conditionalCrossings.length,160);
      assert.equal(result.clock.passageFrames.length,7);
      assert.equal(result.line.bandRunners.flatMap(band=>
        band.runner.finishers).length,160);
      assert.equal(result.classifiedResults,null);
      assert.equal(result.pointsStatus,'withheld');
      assert.equal(result.canCommitAwards,false);
      assert.equal(validateFinaleMixedTwoFrontDroppedMultifrontCleanFinalResult(
        recording,{},result),true);
      const race=createV93PlayableTest(settings);
      assert.equal(race.version,
        V93_MIXED_TWO_FRONT_MULTIFRONT_CLEAN_FINAL_LANES_PLAYTEST_VERSION);
      assert.equal(race.mixedTwoFrontResult.line.conditionalCrossings.length,
        160);
      const summary=summarizeV93CoastedPlaytest(race);
      assert.equal(summary.lastKmRoad.length,7);
      assert.equal(summary.lineTimes.length,160);
      assert.deepEqual(new Set(summary.mixedTwoFrontOlderDrops
        .leadingGroupIds),new Set(['road-2','road-4']));
      assert.equal(summary.mixedTwoFrontOlderDrops.freshWheelApproaches.length,
        expected);
      assert.equal(summary.classifiedResults,null);
      assert.equal(summary.pointsStatus,'withheld');
      assert.equal(summary.canCommitAwards,false);
      assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
    }
    assert.throws(()=>createV93PlayableTest(settingsFor(
      20,'F','flat',30),{},
    {resolveMixedTwoFrontMultifrontCleanFinalLanes:false}),
    /depleted line bands crossed without contact/i);
  });

test('crowded multifront exits pay eleven or twelve approaches only',()=>{
  for(const [gender,terrain,expected] of [
    ['M','rolling',12],['M','exposed',11],['F','exposed',11]]){
    const settings=settingsFor(20,gender,terrain,30);
    const recording=recordingFor(settings);
    const result=recordFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
      recording);
    assert.equal(result.version,
      FINALE_MIXED_TWO_FRONT_DROPPED_CROWDED_MULTIFRONT_RESULT_VERSION);
    assert.equal(result.pre500Audit.freshApproaches.length,expected);
    assert.equal(result.final500Audit.freshApproaches.length,0);
    assert.equal(result.line.conditionalCrossings.length,160);
    assert.equal(result.clock.passageFrames.length,7);
    assert.equal(result.classifiedResults,null);
    assert.equal(result.pointsStatus,'withheld');
    assert.equal(result.canCommitAwards,false);
    assert.equal(validateFinaleMixedTwoFrontDroppedCrowdedMultifrontResult(
      recording,{},result),true);
    const race=createV93PlayableTest(settings);
    assert.equal(race.version,
      V93_MIXED_TWO_FRONT_CROWDED_MULTIFRONT_LANES_PLAYTEST_VERSION);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.lastKmRoad.length,7);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.mixedTwoFrontOlderDrops.freshWheelApproaches.length,
      expected);
    assert.deepEqual(new Set(summary.mixedTwoFrontOlderDrops.leadingGroupIds),
      new Set(['road-2','road-4']));
    assert.equal(summary.classifiedResults,null);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
  }
  assert.throws(()=>createV93PlayableTest(settingsFor(
    20,'M','exposed',30),{},
  {resolveMixedTwoFrontCrowdedMultifrontLanes:false}),
  /depleted line bands crossed without contact/i);
});

test('mountain multifront late approach stays in distinct fixed lanes',()=>{
  const settings=settingsFor(20,'M','mountain',30);
  const recording=recordingFor(settings);
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
  const line=recordFinaleCoastedIndividualLine(recording,clock,{
    laneQueuedBandIds:['road-2']});
  assert.equal(line.version,
    FINALE_MULTIFRONT_PARALLEL_FINAL_INDIVIDUAL_LINE_VERSION);
  assert.equal(line.bandRunners.find(row=>row.roadBandId==='road-2')
    .runner.passingRule,'fixed-source-lane-queue-lab-1');
  assert.equal(validateFinaleDepletedIndividualLine(recording,clock,{},line),
    true);
  const pre=recordFinaleMixedTwoFrontDroppedMultifrontPre500Audit(
    recording,clock,line);
  const final=recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalAudit(
    recording,clock,line,pre);
  assert.equal(pre.freshApproaches.length,10);
  assert.equal(final.version,
    FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PARALLEL_FINAL_AUDIT_VERSION);
  assert.equal(final.paidRiderCount,160);
  assert.equal(final.freshApproaches.length,1);
  const approach=final.freshApproaches[0];
  assert.equal(approach.firstRiderId,'rival-5-7');
  assert.equal(approach.secondRiderId,'rival-9-7');
  assert.ok(approach.firstWheelM>259500);
  assert.ok(Math.abs(approach.firstWheelM-approach.secondWheelM-2.5)<1e-7);
  assert.ok(Math.abs(approach.paidSplit.first.frames.at(-1).riders[0]
    .energyAfter-approach.firstEnergy)<1e-7);
  assert.ok(Math.abs(approach.paidSplit.second.frames.at(-1).riders[0]
    .energyAfter-approach.secondEnergy)<1e-7);
  assert.deepEqual(final.parallelFinalLaneEvidence,{
    firstRiderId:'rival-5-7',secondRiderId:'rival-9-7',
    roadBandId:'road-2',firstLane:2,secondLane:3,
    noDraftAfterApproach:true,fixedSourceLanes:true});
  assert.equal(final.contactResolved,false);
  const result=recordFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
    recording);
  assert.equal(result.version,
    FINALE_MIXED_TWO_FRONT_DROPPED_MULTIFRONT_PARALLEL_FINAL_RESULT_VERSION);
  assert.equal(result.line.conditionalCrossings.length,160);
  assert.equal(result.clock.passageFrames.length,7);
  assert.equal(result.classifiedResults,null);
  assert.equal(result.pointsStatus,'withheld');
  assert.equal(result.canCommitAwards,false);
  assert.equal(validateFinaleMixedTwoFrontDroppedMultifrontParallelFinalResult(
    recording,{},result),true);
  const race=createV93PlayableTest(settings);
  assert.equal(race.version,
    V93_MIXED_TWO_FRONT_MULTIFRONT_PARALLEL_FINAL_PLAYTEST_VERSION);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lastKmRoad.length,7);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.mixedTwoFrontOlderDrops.freshWheelApproaches.length,11);
  assert.deepEqual(summary.mixedTwoFrontOlderDrops.parallelFinalLaneEvidence,
    final.parallelFinalLaneEvidence);
  assert.equal(summary.classifiedResults,null);
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  assert.equal(validateV93CoastedPlaytest(settings,{},race),true);
  assert.throws(()=>createV93PlayableTest(settings,{},
    {resolveMixedTwoFrontMultifrontParallelFinal:false}),
  /depleted line bands crossed without contact/i);
});

test('20-team mountain pays bounded many-approach conditional finish',
  ()=>{
    const settings=settingsFor(20,'F','mountain',0);
    const recording=recordingFor(settings);
    const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
    const line=recordFinaleCoastedIndividualLine(recording,clock);
    assert.throws(()=>recordFinaleMixedTwoFrontDroppedPre500Audit(
      recording,clock,line),/new unpaid approach/);
    const audit=recordFinaleMixedTwoFrontDroppedManyPre500Audit(
      recording,clock,line);
    assert.equal(audit.version,
      FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_AUDIT_VERSION);
    assert.equal(audit.paidRiderCount,160);
    assert.equal(audit.freshApproaches.length,5);
    assert.deepEqual(audit.freshApproaches.map(row=>[
      row.firstRiderId,row.secondRiderId]),[
      ['rival-4-5','rival-17-7'],
      ['you-5','rival-15-7'],
      ['rival-16-5','rival-15-7'],
      ['rival-10-5','rival-15-7'],
      ['rival-4-5','rival-15-7']]);
    assert.ok(audit.freshApproaches.every(row=>
      row.firstEnergy===0&&row.secondEnergy>0&&
      Math.abs(Math.abs(row.firstWheelM-row.secondWheelM)-2.5)<1e-7&&
      Math.abs(row.paidSplit.first.frames.at(-1).riders[0].energyAfter-
        row.firstEnergy)<1e-7&&
      Math.abs(row.paidSplit.second.frames.at(-1).riders[0].energyAfter-
        row.secondEnergy)<1e-7&&row.contactResolved===false));
    assert.equal(audit.contactResolved,false);
    assert.equal(audit.classifiedResults,null);
    assert.equal(audit.pointsStatus,'withheld');
    assert.equal(audit.canCommitAwards,false);
    const final=recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit(
      recording,clock,line,audit);
    assert.equal(final.version,
      FINALE_MIXED_TWO_FRONT_DROPPED_MANY_PRE500_FINAL500_AUDIT_VERSION);
    assert.equal(final.paidRiderCount,160);
    assert.equal(final.freshApproaches.length,1);
    assert.equal(final.freshApproaches[0].firstRiderId,'rival-5-7');
    assert.equal(final.freshApproaches[0].secondRiderId,'rival-15-7');
    assert.ok(Math.abs(final.freshApproaches[0].firstWheelM-
      259811.80661707695)<1e-6);
    assert.ok(Math.abs(final.freshApproaches[0].paidSplit.first.frames
      .at(-1).riders[0].energyAfter-
      final.freshApproaches[0].firstEnergy)<1e-7);
    assert.equal(final.contactResolved,false);
    assert.equal(final.classifiedResults,null);
    assert.equal(final.pointsStatus,'withheld');
    assert.equal(final.canCommitAwards,false);
    const at500=new Map(clock.trace.frames.find(frame=>
      frame.endDistanceM===259500).riders.map(row=>[
      row.riderId,row.energy]));
    const finishers=line.bandRunners.flatMap(band=>band.runner.finishers);
    assert.equal(line.conditionalCrossings.length,160);
    assert.equal(new Set(finishers.map(row=>row.riderId)).size,160);
    assert.ok(line.bandRunners.flatMap(band=>band.runner.frames[0].riders)
      .every(row=>Math.abs(row.energyAtDecision-
        at500.get(row.riderId))<1e-7));
    assert.equal(validateFinaleCoastMixedTwoFrontDroppedClock(
      recording,clock),true);
    const result=recordFinaleMixedTwoFrontDroppedManyPre500Result(recording);
    assert.equal(result.line.conditionalCrossings.length,160);
    assert.equal(result.clock.passageFrames.length,7);
    assert.equal(validateFinaleMixedTwoFrontDroppedManyPre500Result(
      recording,{},result),true);
    const playable=createV93PlayableTest(settings);
    assert.equal(playable.version,
      V93_MIXED_TWO_FRONT_MANY_PRE500_LANES_PLAYTEST_VERSION);
    const summary=summarizeV93CoastedPlaytest(playable);
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.lastKmRoad.length,7);
    assert.equal(summary.mixedTwoFrontOlderDrops.freshWheelApproaches.length,
      6);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.classifiedResults,null);
    assert.equal(validateV93CoastedPlaytest(settings,{},playable),true);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontManyPre500Lanes:false}),
      /The depleted line bands crossed without contact/);
    const maleSettings=settingsFor(20,'M','mountain',0);
    const male=recordingFor(maleSettings);
    const maleClock=recordFinaleCoastMixedTwoFrontDroppedClock(male);
    const maleLine=recordFinaleCoastedIndividualLine(male,maleClock);
    const malePre500=recordFinaleMixedTwoFrontDroppedManyPre500Audit(
      male,maleClock,maleLine);
    const maleFinal500=recordFinaleMixedTwoFrontDroppedManyPre500Final500Audit(
      male,maleClock,maleLine,malePre500);
    assert.equal(malePre500.freshApproaches.length,10);
    assert.equal(maleFinal500.paidRiderCount,160);
    assert.deepEqual(maleFinal500.freshApproaches,[]);
    assert.equal(maleFinal500.contactResolved,false);
    const maleResult=
      recordFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(male);
    assert.equal(maleResult.line.conditionalCrossings.length,160);
    assert.equal(validateFinaleMixedTwoFrontDroppedManyPre500CleanFinalResult(
      male,{},maleResult),true);
    const malePlayable=createV93PlayableTest(maleSettings);
    assert.equal(malePlayable.version,
      V93_MIXED_TWO_FRONT_MANY_PRE500_CLEAN_FINAL_LANES_PLAYTEST_VERSION);
    const maleSummary=summarizeV93CoastedPlaytest(malePlayable);
    assert.equal(maleSummary.lineTimes.length,160);
    assert.equal(maleSummary.lastKmRoad.length,7);
    assert.equal(maleSummary.mixedTwoFrontOlderDrops.freshWheelApproaches
      .length,10);
    assert.equal(maleSummary.pointsStatus,'withheld');
    assert.equal(validateV93CoastedPlaytest(maleSettings,{},malePlayable),true);
    assert.throws(()=>createV93PlayableTest(maleSettings,{},
      {resolveMixedTwoFrontManyPre500CleanFinalLanes:false}),
      /The depleted line bands crossed without contact/);
  });

test('15-team mountain final approaches remain an internal paid audit',()=>{
  for(const [gender,fatigue] of [['M',0],['F',30]]){
    const recording=recordingFor(settingsFor(15,gender,'mountain',fatigue));
    const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
    const line=recordFinaleCoastedIndividualLine(recording,clock);
    const pre500=recordFinaleMixedTwoFrontDroppedFreshPre500Audit(
      recording,clock,line);
    const final500=
      recordFinaleMixedTwoFrontDroppedFreshPre500ManyFinal500Audit(
        recording,clock,line,pre500);
    assert.deepEqual(final500.freshApproaches,[]);
    assert.equal(final500.contactResolved,false);
    assert.equal(final500.classifiedResults,null);
    assert.equal(final500.pointsStatus,'withheld');
    assert.equal(final500.paidRiderCount,120);
    const result=
      recordFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
        recording);
    assert.equal(result.line.conditionalCrossings.length,120);
    assert.equal(result.clock.passageFrames.length,7);
    assert.equal(result.classifiedResults,null);
    assert.equal(result.canCommitAwards,false);
    assert.equal(validateFinaleMixedTwoFrontDroppedFreshPre500CleanFinal500Result(
      recording,{},result),true);
    const settings=settingsFor(15,gender,'mountain',fatigue);
    const playable=createV93PlayableTest(settings);
    const summary=summarizeV93CoastedPlaytest(playable);
    assert.equal(summary.lineTimes.length,120);
    assert.equal(summary.lastKmRoad.length,7);
    assert.equal(summary.mixedTwoFrontOlderDrops.freshWheelApproaches.length,
      1);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(validateV93CoastedPlaytest(settings,{},playable),true);
    assert.throws(()=>createV93PlayableTest(settings,{},
      {resolveMixedTwoFrontEarlyFreshLanes:false}),
    /The depleted line bands crossed without contact/);
  }
});

test('15-team rolling final-wheel approaches remain an internal paid audit',()=>{
  const recording=recordingFor(settingsFor(15,'M','rolling',30));
  const clock=recordFinaleCoastMixedTwoFrontDroppedClock(recording);
  const line=recordFinaleCoastedIndividualLine(recording,clock);
  const pre500=recordFinaleMixedTwoFrontDroppedPre500Audit(recording,
    clock,line);
  assert.throws(()=>recordFinaleMixedTwoFrontDroppedFinal500Audit(
    recording,clock,line,pre500),/new unpaid approach/);
  const diagnostic=recordFinaleMixedTwoFrontDroppedManyFinal500Audit(
    recording,clock,line,pre500);
  assert.equal(diagnostic.version,
    FINALE_MIXED_TWO_FRONT_DROPPED_MANY_FINAL500_AUDIT_VERSION);
  assert.equal(diagnostic.paidRiderCount,120);
  assert.equal(diagnostic.contactResolved,false);
  assert.equal(diagnostic.classifiedResults,null);
  assert.equal(diagnostic.pointsStatus,'withheld');
  assert.equal(diagnostic.canCommitAwards,false);
  assert.deepEqual(diagnostic.freshApproaches.map(row=>[
    row.firstRiderId,row.secondRiderId]),[
    ['rival-4-7','rival-12-5'],
    ['rival-10-7','rival-12-5']]);
  assert.ok(Math.abs(diagnostic.freshApproaches[0].firstWheelM-
    259914.25844601408)<1e-6);
  assert.ok(Math.abs(diagnostic.freshApproaches[1].firstWheelM-
    259940.02262944286)<1e-6);
  assert.ok(diagnostic.freshApproaches.every(row=>
    Math.abs(row.paidSplit.first.frames.at(-1).riders[0].positionM-
      row.firstWheelM)<1e-7&&
    Math.abs(row.paidSplit.second.frames.at(-1).riders[0].positionM-
      row.secondWheelM)<1e-7));
  const result=
    recordFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
      recording);
  assert.equal(result.line.conditionalCrossings.length,120);
  assert.equal(result.clock.passageFrames.length,7);
  assert.equal(result.line.bandRunners.flatMap(row=>row.runner.finishers)
    .length,120);
  assert.equal(result.classifiedResults,null);
  assert.equal(result.pointsStatus,'withheld');
  assert.equal(validateFinaleMixedTwoFrontDroppedCleanPre500FreshFinal500Result(
    recording,{},result),true);
  const settings=settingsFor(15,'M','rolling',30);
  const playable=createV93PlayableTest(settings);
  assert.equal(playable.version,
    V93_MIXED_TWO_FRONT_FINAL_FRESH_LANES_PLAYTEST_VERSION);
  const summary=summarizeV93CoastedPlaytest(playable);
  assert.equal(summary.lineTimes.length,120);
  assert.equal(summary.lastKmRoad.length,7);
  assert.equal(summary.mixedTwoFrontOlderDrops.freshWheelApproaches.length,2);
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.classifiedResults,null);
  assert.equal(validateV93CoastedPlaytest(settings,{},playable),true);
  assert.throws(()=>createV93PlayableTest(settings,{},
    {resolveMixedTwoFrontFinalFreshLanes:false}),
  /The depleted line bands crossed without contact/);
  const female=recordingFor(settingsFor(15,'F','rolling',30));
  const femaleClock=recordFinaleCoastMixedTwoFrontDroppedClock(female);
  const femaleLine=recordFinaleCoastedIndividualLine(female,femaleClock);
  assert.throws(()=>recordFinaleMixedTwoFrontDroppedPre500Audit(female,
    femaleClock,femaleLine),/new unpaid approach/);
  const femalePlayable=createV93PlayableTest(
    settingsFor(15,'F','rolling',30));
  assert.equal(femalePlayable.version,
    V93_MIXED_TWO_FRONT_FRESH_LANES_PLAYTEST_VERSION);
  assert.equal(summarizeV93CoastedPlaytest(femalePlayable).lineTimes.length,
    120);
});

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
