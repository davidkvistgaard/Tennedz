import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,
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

test('unpaid front catch exposes only its validated kilometre road',()=>{
  assert.throws(()=>createV93PlayableTest(settings),error=>{
    assert.match(error.message,/needs a recorded catch for road-15/);
    assert.equal(error.cause.groupId,'road-15');
    const road=error.roadPreview;
    assert.equal(road.version,V93_UNSUPPORTED_CATCH_PREVIEW_VERSION);
    assert.equal(road.unsupportedReason,'unpaid_front_catch');
    assert.equal(road.kilometreFrames.length,259);
    assert.equal(road.kilometreFrames.at(-1).km,259);
    assert.ok(road.kilometreFrames.at(-1).roadGroups.some(group=>
      group.id===road.catch.groupId));
    assert.equal(road.catch.calculatedCatchDistanceM,
      error.cause.calculatedCatchDistanceM);
    assert.ok(road.catch.metresToGo>700&&
      road.catch.metresToGo<800);
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
