import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from
  '../../lib/engine/v2/playtest.mjs';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_EXHAUSTION_COAST_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleCoastMixedThreeFrontPost500CandidateClock,
  validateFinaleCoastMixedThreeFrontPost500CandidateClock,
  FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

function recording(teamCount,gender,terrain){
  const settings={distanceKm:260,teamCount,gender,terrain,fatigue:30,
    seed:`v93-next-contact-field-hills-${teamCount}-${gender}-${terrain}-30-1`,
    defaultRivalPlan:'passive',effort:'hard',attack:'repeated',chase:'all',
    managerTactics:Array.from({length:teamCount-1},(_,index)=>({
      effort:['hard','conserve','steady'][(index+1)%3],
      attack:index%3===1?'selective':'repeated',
      chase:index%3===1?'ignore':'all'})),
    managerFinaleOrders:[
      {teamId:'you',atKm:255,effort:'conserve'},
      {teamId:'rival-1',atKm:255,effort:'hard'}]};
  const {stage,weather,teams,seed}=prepareV91Playtest(settings);
  return simulateTacticalTour({stage,weather,teams,seed,
    motorVersion:MOTOR_EXHAUSTION_COAST_VERSION});
}

test('late marker candidates keep road-2 and passing leavers unresolved',()=>{
  for(const [teamCount,gender,terrain] of [
    [15,'M','rolling'],[15,'F','mountain']]){
    const tour=recording(teamCount,gender,terrain);
    const clock=recordFinaleCoastMixedThreeFrontPost500CandidateClock(tour);
    assert.equal(clock.version,
      FINALE_COAST_MIXED_THREE_FRONT_POST500_CANDIDATE_VERSION);
    assert.equal(validateFinaleCoastMixedThreeFrontPost500CandidateClock(
      tour,clock),true);
    assert.ok(clock.markerPasses.length>=5);
    assert.ok(clock.markerPasses.every(row=>
      row.markerDistanceM>259500&&row.contactResolved===false));
    assert.equal(clock.line.bands[1].kind,
      'unresolved_individual_contact_candidate');
    assert.equal(clock.classifiedResults,null);
    assert.equal(clock.pointsStatus,'withheld');
    assert.equal(clock.canCommitAwards,false);
  }
});

test('straddling 500 m marker candidates remain unsupported',()=>{
  const tour=recording(20,'F','rolling');
  assert.throws(()=>
    recordFinaleCoastMixedThreeFrontPost500CandidateClock(tour),
    /paid post-500 m candidate clock/);
});
