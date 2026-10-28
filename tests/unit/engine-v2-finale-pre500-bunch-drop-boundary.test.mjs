import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {createV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastTwoFrontPaidBunchClock,
  validateFinaleCoastTwoFrontPaidBunchClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

function seededRandom(label){
  let state=2166136261;
  for(const character of label)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  return ()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/2**32);
}

test('pre-500 m bunch drops keep the official finish unavailable',()=>{
  const seed='guided-finish-coverage-39',terrain='mountain',fatigue=0;
  const settings={distanceKm:260,terrain,teamCount:20,fatigue,
    attack:'none',chase:'ignore',seed,
    managerTactics:resolveRandomRivalTactics({teamCount:20,
      random:seededRandom(`${seed}:${terrain}:${fatigue}`)})};
  const finishPlan={plans:Array.from({length:20},(_,index)=>{
    const teamId=index?`rival-${index}`:'you';
    return {teamId,finisherId:`${teamId}-7`,leadOutRiderId:null};
  })};
  assert.throws(()=>createV93CoastedPlaytest(settings,finishPlan),
    /Dynamic active positioning needs recorded pre-500 m bunch drops/);
  const road=simulateTacticalTour({...prepareV91Playtest(settings),
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
  assert.equal(validateRecordedTour(road),true);
  const clock=recordFinaleCoastTwoFrontPaidBunchClock(road);
  assert.equal(validateFinaleCoastTwoFrontPaidBunchClock(road,clock),true);
  assert.equal(clock.line.riders.length,160);
  assert.equal(clock.line.bands.at(-1).lastPossiblePlace,160);
  assert.equal(clock.classifiedResults,null);
  assert.equal(clock.canCommitAwards,false);
  const forged=structuredClone(clock);
  forged.line.bands[0].riderIds.pop();
  assert.throws(()=>validateFinaleCoastTwoFrontPaidBunchClock(road,forged),
    /paid two-front bunch clock does not replay/);
});
