import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {resolveFinaleMultibandPositionedSource} from
  '../../lib/engine/v2/finale-multiband-positioned-source.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';

// One whole race, with only the player's 5 km effort changed. The middle
// choice exposes an occupied-wheel encounter before the 500 m handoff,
// despite the group-level catch being projected after it.
const settings={distanceKm:40,teamCount:4,gender:'M',terrain:'flat',
  fatigue:0,seed:'near-catch',effort:'steady',attack:'none',chase:'all',
  defaultRivalPlan:'attack',teamOverrides:[{teamId:'you',level:40},
    ...['rival-1','rival-2','rival-3'].map(teamId=>({teamId,level:20}))]};
const withEffort=effort=>({...settings,managerFinaleOrders:[
  {teamId:'you',atKm:35,effort,chase:'all'}]});

test('close chase pays the first steady wheel encounter across the whole race',()=>{
  const conserve=createV93PlayableTest(withEffort('conserve'));
  const steady=createV93PlayableTest(withEffort('steady'));
  const hard=createV93PlayableTest(withEffort('hard'));
  assert.deepEqual(conserve.recording.frames.filter(frame=>frame.km<35),
    hard.recording.frames.filter(frame=>frame.km<35));
  assert.deepEqual(steady.recording.frames.filter(frame=>frame.km<35),
    hard.recording.frames.filter(frame=>frame.km<35));
  assert.equal(steady.version,
    V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(withEffort('steady'),{},steady),
    true);
  for(const [race,place] of [[conserve,4],[steady,4],[hard,1]]){
    const summary=summarizeV93CoastedPlaytest(race);
    const finisherId=summary.managerDecisions.find(row=>
      row.teamId==='you').finisherId;
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.provisionalLineOrder.find(row=>
      row.riderId===finisherId).position,place);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
  }
  const paid=summarizeV93CoastedPlaytest(steady);
  assert.ok(paid.sharedWheelContact.atDistanceM>39250&&
    paid.sharedWheelContact.atDistanceM<39500);
  assert.equal(paid.sharedWheelContact.wheelPairs.length,3);
  assert.equal(paid.lastKmRoad.at(-1).distanceM,40000);
  assert.equal(paid.bandReplays.length,1);
  assert.equal(steady.individualLine.source.droppedRiderIds.length,0);
  assert.equal(steady.individualLine.finishers.length,32);
  assert.equal(new Set(steady.individualLine.finishers.map(row=>
    row.riderId)).size,32);
  assert.throws(()=>createV93PlayableTest(withEffort('steady'),{},
    {resolveWheelContact:false}),error=>{
    assert.match(error.message,/needs a recorded catch for road-1/);
    assert.equal(error.cause.groupId,'road-1');
    assert.ok(error.cause.calculatedCatchDistanceM>39500&&
      error.cause.calculatedCatchDistanceM<40000);
    assert.ok(paid.sharedWheelContact.atDistanceM<
      error.cause.calculatedCatchDistanceM);
    assert.equal(error.roadPreview?.unsupportedReason,'unpaid_front_catch');
    assert.equal(error.roadPreview?.kilometreFrames.length,39);
    assert.deepEqual(error.roadPreview?.lastKmRoad,[]);
    assert.equal(error.roadPreview?.lineTimes,null);
    assert.equal(error.roadPreview?.canCommitAwards,false);
    return true;
  });
});

test('no-drops shared wheels pay bounded terrains and retain refusals',()=>{
  for(const gender of ['M','F'])for(const terrain of
    ['flat','rolling','custom']){
    const selected={...withEffort('steady'),gender,terrain};
    const race=createV93PlayableTest(selected,{pointContext:{tier:3,
      divisionCount:4,divisionIndex:2}});
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(race.version,
      V93_NO_DROPS_WHEEL_CONTACT_PLAYTEST_VERSION);
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.bandReplays.length,1);
    assert.ok(summary.sharedWheelContact.atDistanceM>39250&&
      summary.sharedWheelContact.atDistanceM<39500);
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
  }
  for(const terrain of ['mountain','exposed'])
    assert.throws(()=>createV93PlayableTest({...withEffort('steady'),
      terrain}),error=>{
      assert.equal(error.roadPreview?.unsupportedReason,
        'unpaid_front_catch');
      assert.equal(error.roadPreview?.lineTimes,null);
      return true;
    });
});

test('nearby early catches start with overlapping source wheels',()=>{
  for(const gender of ['M','F'])for(const terrain of
    ['mountain','exposed']){
    const selected={...withEffort('steady'),gender,terrain};
    const prepared=prepareV91Playtest(selected);
    const tour=simulateTacticalTour({stage:prepared.stage,
      weather:prepared.weather,teams:prepared.teams,
      seed:prepared.seed,motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
    const positioned=resolveFinaleMultibandPositionedSource(tour);
    const trace=probeFinaleSeparatedGroupsFromTour(tour,{
      version:FINALE_SINGLE_LATE_CATCH_LAST_KM_VERSION});
    const [front,bunch]=positioned.roadBands;
    const contact=trace.frames[0].contact;
    assert.equal(contact?.kind,'front_catch');
    assert.equal(trace.frames[0].roadGroups.length,0);
    assert.ok(contact.atDistanceM>positioned.startDistanceM&&
      contact.atDistanceM<positioned.startDistanceM+250);
    assert.equal(front.slots[0].lane,bunch.slots[0].lane);
    const gapSeconds=-front.passageSecondsFromBunchMarker;
    const frontSpeed=(contact.atDistanceM-positioned.startDistanceM)/
      (contact.preContactBunchSeconds+gapSeconds);
    const firstSourceWheelGapM=gapSeconds*frontSpeed+
      front.slots[0].positionM-bunch.slots[0].positionM;
    assert.ok(firstSourceWheelGapM>0&&
      firstSourceWheelGapM<positioned.wheelSpacingM);
    assert.throws(()=>createV93PlayableTest(selected),error=>{
      assert.equal(error.roadPreview?.unsupportedReason,
        'unpaid_front_catch');
      assert.equal(error.roadPreview?.lineTimes,null);
      return true;
    });
  }
});

test('measured chase needs steady but hard spends extra line energy',()=>{
  const selected={...settings,teamOverrides:[{teamId:'you',level:45},
    ...['rival-1','rival-2','rival-3'].map(teamId=>(
      {teamId,level:25}))]};
  const runs=['conserve','steady','hard'].map(effort=>{
    const input={...selected,managerFinaleOrders:[{teamId:'you',
      atKm:35,effort,chase:'all'}]};
    const race=createV93PlayableTest(input);
    const summary=summarizeV93CoastedPlaytest(race);
    const finisherId=summary.managerDecisions.find(row=>
      row.teamId==='you').finisherId;
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
    return {summary,finisherId,
      place:summary.provisionalLineOrder.find(row=>
        row.riderId===finisherId).position,
      energy:summary.lineTimes.find(row=>
        row.riderId===finisherId).energyAtLine,
      catches:summary.kilometreFrames.filter(frame=>
        frame.km>35).flatMap(frame=>frame.caughtRiderIds)};
  });
  assert.deepEqual(runs.map(row=>row.place),[4,1,1]);
  assert.deepEqual(runs.map(row=>row.catches.length),[0,3,3]);
  assert.ok(runs[0].energy>runs[1].energy&&
    runs[1].energy>runs[2].energy);
  assert.deepEqual(runs[0].summary.kilometreFrames.filter(frame=>
    frame.km<35),runs[2].summary.kilometreFrames.filter(frame=>
    frame.km<35));
});
