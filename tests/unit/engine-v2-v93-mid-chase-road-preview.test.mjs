import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,
  V93_PAID_MID_CHASE_CATCH_ROAD_PREVIEW_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleMidChaseCatchClock,
  validateFinaleMidChaseCatchClock,
  recordFinaleLateChaseCatchClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

function settings(seed,terrain,fatigue){
  return {distanceKm:260,terrain,teamCount:20,fatigue,
    attack:'none',chase:'ignore',seed,
    managerTactics:resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:${fatigue}`)})};
}

const sourceSettings=settings('guided-finish-coverage-134','mountain',30);

test('mid chase contact shows paid road and withholds the result',()=>{
  assert.throws(()=>createV93PlayableTest(sourceSettings,{}),error=>{
    const road=error.roadPreview;
    assert.equal(road?.version,
      V93_PAID_MID_CHASE_CATCH_ROAD_PREVIEW_VERSION);
    assert.equal(road.unsupportedReason,'individual_mid_chase_catch');
    assert.equal(road.lastKmRoad.length,7);
    assert.equal(road.lastKmRoad.at(-1).distanceM,260000);
    assert.equal(road.lastKmRoad.filter(frame=>frame.contact).length,1);
    assert.ok(road.catch.metresToGo>500&&road.catch.metresToGo<750);
    assert.equal(road.finalRiderEnergy.length,160);
    assert.ok(road.lastKmRoad.every(frame=>
      frame.ownRiderEnergy.length===8&&
      frame.ownRiderEnergy.every(rider=>rider.energy>=0)));
    assert.equal(road.lineTimes,null);
    assert.equal(road.classifiedResults,null);
    assert.equal(road.pointsStatus,'withheld');
    assert.equal(road.canCommitAwards,false);
    return true;
  });
});

test('mid chase clock replays source and rejects forged energy',()=>{
  const road=simulateTacticalTour({...prepareV91Playtest(sourceSettings),
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  const clock=recordFinaleMidChaseCatchClock(road);
  assert.equal(validateFinaleMidChaseCatchClock(road,clock),true);
  assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
  assert.equal(clock.canCommitAwards,false);
  const forged=structuredClone(clock);
  forged.trace.finalRiderEnergy[0].energy+=1;
  assert.throws(()=>validateFinaleMidChaseCatchClock(road,forged),
    /does not replay/);
  assert.throws(()=>recordFinaleLateChaseCatchClock(road),
    /beyond 500 m/);
});

test('a late contact cannot enter the middle-slice clock',()=>{
  const lateSettings=settings('guided-finish-coverage-98','flat',0);
  const road=simulateTacticalTour({...prepareV91Playtest(lateSettings),
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.doesNotThrow(()=>recordFinaleLateChaseCatchClock(road));
  assert.throws(()=>recordFinaleMidChaseCatchClock(road),
    /before 500 m/);
});
