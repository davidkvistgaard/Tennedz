import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,
  V93_PAID_LATE_CHASE_CATCH_ROAD_PREVIEW_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

function settings(seed,terrain){
  return {distanceKm:260,terrain,teamCount:20,fatigue:0,
    attack:'none',chase:'ignore',seed,
    managerTactics:resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:0`)})};
}

for(const [seed,terrain] of [
  ['guided-finish-coverage-19','mountain'],
  ['guided-finish-coverage-86','flat']]){
  test(`late chase contact ${seed} shows paid road but no result`,()=>{
    assert.throws(()=>createV93PlayableTest(settings(seed,terrain),{}),error=>{
      const road=error.roadPreview;
      assert.equal(road?.version,
        V93_PAID_LATE_CHASE_CATCH_ROAD_PREVIEW_VERSION);
      assert.equal(road.unsupportedReason,'individual_late_catch');
      assert.equal(road.kilometreFrames.length,259);
      assert.equal(road.lastKmRoad.length,7);
      assert.equal(road.lastKmRoad.at(-1).distanceM,260000);
      assert.equal(road.lastKmRoad.at(-1).groups.length,0);
      assert.equal(road.lastKmRoad.filter(row=>row.contact).length,1);
      assert.equal(road.catch.calculatedCatchDistanceM,
        road.lastKmRoad.find(row=>row.contact).contact.atDistanceM);
      assert.ok(road.catch.metresToGo>0&&road.catch.metresToGo<500);
      assert.ok(road.lastKmRoad.every(row=>
        row.ownRiderEnergy.length===8&&
        row.ownRiderEnergy.every(rider=>rider.energy>=0)));
      assert.equal(road.finalRiderEnergy.length,160);
      assert.equal(road.lineTimes,null);
      assert.equal(road.classifiedResults,null);
      assert.equal(road.pointsStatus,'withheld');
      assert.equal(road.canCommitAwards,false);
      return true;
    });
  });
}

test('a source without a late paid merge cannot acquire the new road',()=>{
  try{createV93PlayableTest(settings('guided-finish-coverage-18',
    'mountain'),{});}
  catch(error){
    assert.notEqual(error.roadPreview?.version,
      V93_PAID_LATE_CHASE_CATCH_ROAD_PREVIEW_VERSION);
  }
});
