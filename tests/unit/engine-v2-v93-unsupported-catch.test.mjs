import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_FRONT_CATCH_PLAYTEST_VERSION,
  V93_UNSUPPORTED_CATCH_PREVIEW_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const tactics=[
  {effort:'hard',attack:'none',chase:'all'},
  {effort:'steady',attack:'selective',chase:'ignore'},
  {effort:'conserve',attack:'none',chase:'selective'},
  {effort:'steady',attack:'repeated',chase:'selective'}];
const settings={distanceKm:260,teamCount:20,gender:'M',terrain:'flat',
  fatigue:15,seed:'v93-long-stress-M-flat-15-0',
  defaultRivalPlan:'passive',effort:'steady',attack:'repeated',
  chase:'selective',managerTactics:Array.from({length:19},(_,index)=>
    tactics[index%4])};

test('early paid front catch reaches every rider line and replay while points stay withheld',()=>{
  const race=createV93PlayableTest(settings,{pointContext:{tier:3,
    divisionCount:4,divisionIndex:2}});
  assert.equal(race.version,V93_FRONT_CATCH_PLAYTEST_VERSION);
  assert.equal(validateV93CoastedPlaytest(settings,{pointContext:{tier:3,
    divisionCount:4,divisionIndex:2}},race),true);
  const summary=summarizeV93CoastedPlaytest(race);
  assert.equal(summary.lineTimes.length,160);
  assert.equal(summary.bandReplays.length,31);
  assert.equal(summary.pointPreview.status,'unavailable');
  assert.equal(summary.pointsStatus,'withheld');
  assert.equal(summary.canCommitAwards,false);
  assert.ok(race.clock.trace.frames[0].contact);
  assert.deepEqual(summary.frontCatch,{
    roadGroupId:race.clock.contact.groupId,
    atDistanceM:race.clock.contact.atDistanceM,
    elapsedSecondsFromLastKmStart:
      race.clock.contact.preContactBunchSeconds,
    caughtRiderIds:race.clock.contact.caughtRiderIds});
  assert.deepEqual(summary.frontCatch.caughtRiderIds,
    race.recording.frames.at(-2).roadGroups[0].riderIds);
  assert.ok(summary.lastKmRoad.every(frame=>frame.groups.length===0));
});

test('last-100-m front catch exposes only its validated kilometre road',()=>{
  const late={...settings,terrain:'exposed',fatigue:0,
    seed:'v93-long-stress-M-exposed-0-2'};
  assert.throws(()=>createV93PlayableTest(late),error=>{
    assert.match(error.message,/needs a recorded catch for road-13/);
    assert.equal(error.cause.groupId,'road-13');
    const road=error.roadPreview;
    assert.equal(road.version,V93_UNSUPPORTED_CATCH_PREVIEW_VERSION);
    assert.equal(road.unsupportedReason,'unpaid_front_catch');
    assert.equal(road.kilometreFrames.length,259);
    assert.equal(road.kilometreFrames.at(-1).km,259);
    assert.ok(road.kilometreFrames.at(-1).roadGroups.some(group=>
      group.id===road.catch.groupId));
    assert.equal(road.catch.calculatedCatchDistanceM,
      error.cause.calculatedCatchDistanceM);
    assert.ok(road.catch.metresToGo>0&&
      road.catch.metresToGo<100);
    assert.ok(road.kilometreFrames.at(-1).ownRiders.every(row=>
      Number.isFinite(row.energy)&&row.energy>=0));
    assert.deepEqual(road.lastKmRoad,[]);
    assert.equal(road.lineTimes,null);
    assert.equal(road.bandReplays,null);
    assert.equal(road.pointPreview.status,'unavailable');
    assert.equal(road.canCommitAwards,false);
    return true;
  });
});
