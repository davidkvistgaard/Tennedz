import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {probeFinaleSeparatedGroupsFromTour,
  validateFinaleSeparatedGroupsFromTour,
  FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION} from
  '../../lib/engine/v2/finale-multi-run.mjs';
import {recordFinaleCoastFrontCatchLastKmClock,
  recordFinaleLateChaseCatchClock,
  validateFinaleLateChaseCatchClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

function road(seed,{terrain='mountain'}={}){
  const fatigue=0;
  const managerTactics=resolveRandomRivalTactics({teamCount:20,
    random:seededRandom(`${seed}:${terrain}:${fatigue}`)});
  const prepared=prepareV91Playtest({distanceKm:260,terrain,
    teamCount:20,fatigue,attack:'none',chase:'ignore',seed,
    managerTactics});
  const tour=simulateTacticalTour({...prepared,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(tour),true);
  return tour;
}

test('late paid chase catch replays without inventing a sprint order',()=>{
  const tour=road('guided-finish-coverage-19');
  const trace=probeFinaleSeparatedGroupsFromTour(tour,{
    version:FINALE_COAST_FRONT_CATCH_LAST_KM_VERSION});
  assert.equal(validateFinaleSeparatedGroupsFromTour(tour,trace),true);
  assert.throws(()=>recordFinaleCoastFrontCatchLastKmClock(tour),
    /needs one paid early merge/);
  const clock=recordFinaleLateChaseCatchClock(tour);
  assert.equal(validateFinaleLateChaseCatchClock(tour,clock),true);
  assert.ok(clock.contact.atDistanceM>259500);
  assert.ok(clock.contact.atDistanceM<260000);
  assert.equal(clock.trace.frames.filter(frame=>
    frame.bunchPullRiderId!==null).length,5);
  const contactFrame=clock.trace.frames.find(frame=>frame.contact);
  const paidRider=contactFrame.riders.find(row=>
    row.riderId===contactFrame.bunchPullRiderId);
  assert.equal(paidRider?.role,'pull');
  assert.ok(paidRider.energySpent>0);
  assert.equal(clock.line.riders.length,160);
  assert.deepEqual(clock.line.bands.map(band=>band.kind),
    ['unresolved_contact','unresolved_dropped']);
  assert.equal(clock.line.bands[0].lastPossiblePlace,148);
  assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
  assert.equal(clock.canCommitAwards,false);
  assert.equal(clock.classifiedResults,null);
  const forged=structuredClone(clock);
  forged.contact.atDistanceM+=1;
  assert.throws(()=>validateFinaleLateChaseCatchClock(tour,forged),
    /late chase catch clock does not replay/);
});

test('late contact version refuses a source without its paid merge',()=>{
  const tour=road('guided-finish-coverage-18');
  assert.throws(()=>recordFinaleLateChaseCatchClock(tour));
});

test('late passive contact still carries its earlier paid chase',()=>{
  const tour=road('guided-finish-coverage-86',{terrain:'flat'});
  const clock=recordFinaleLateChaseCatchClock(tour);
  assert.equal(validateFinaleLateChaseCatchClock(tour,clock),true);
  const contactFrame=clock.trace.frames.find(frame=>frame.contact);
  assert.equal(contactFrame.bunchPullRiderId,null);
  assert.equal(clock.trace.frames.filter(frame=>
    frame.bunchPullRiderId!==null).length,3);
  assert.equal(clock.line.riders.length,160);
  assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
  assert.equal(clock.canCommitAwards,false);
});
