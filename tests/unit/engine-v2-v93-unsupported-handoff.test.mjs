import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,
  V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const pointContext={tier:2,divisionCount:2,divisionIndex:1};
function settings(gender,fatigue){
  return {distanceKm:260,teamCount:20,gender,terrain:'custom',fatigue,
    profileHeightsM:[100,600,1200,1800,2300,2500],
    seed:`v93-custom-extreme-${gender}-${fatigue}-climb`,
    defaultRivalPlan:'attack',effort:'hard',attack:'repeated',
    chase:'ignore'};
}

for(const gender of ['M','F']){
  test(`extreme ${gender} front leavers coast from 259 km to paid lines`,()=>{
    const input=settings(gender,0);
    const race=createV93PlayableTest(input,{pointContext});
    assert.equal(validateV93CoastedPlaytest(input,{pointContext},race),true);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.roadStatus,
      'conditional_front_leavers_ahead_of_bunch');
    assert.equal(summary.lineTimes.length,160);
    assert.equal(summary.pointPreview.status,'unavailable');
    assert.match(summary.pointPreview.reason,/no recorded wheel order/);
    assert.equal(summary.canCommitAwards,false);
    const exits=race.clock.trace.frames[0].frontExhaustionDrops;
    assert.deepEqual(exits.map(row=>row.riderId),['you-6','you-7']);
    assert.ok(exits.every(row=>row.atDistanceM===259000&&
      row.remainingEnergy===0&&row.fromRoadGroupId));
    for(const riderId of ['you-6','you-7']){
      const crossing=summary.lineTimes.find(row=>row.riderId===riderId);
      const replay=summary.bandReplays.find(row=>
        row.id===`isolated:${riderId}`);
      const final=replay.frames.at(-1).riders.find(row=>
        row.riderId===riderId);
      assert.equal(crossing.elapsedSecondsFromLastKmStart,
        final.elapsedToLineSeconds);
      assert.equal(crossing.energyAtLine,final.energyAfter);
    }
  });

  test(`extreme ${gender} unresolved band contact remains a road refusal`,()=>{
    assert.throws(()=>createV93PlayableTest(settings(gender,30)),error=>{
      assert.match(error.message,/bands crossed without contact/);
      const road=error.roadPreview;
      assert.equal(road.version,V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION);
      assert.equal(road.unsupportedReason,'unresolved_band_contact');
      assert.equal(road.handoffKm,259);
      assert.equal(road.kilometreFrames.length,259);
      assert.equal(road.kilometreFrames.at(-1).km,259);
      assert.ok(road.kilometreFrames.at(-1).ownRiders.every(row=>
        Number.isFinite(row.energy)&&row.energy>=0));
      assert.deepEqual(road.lastKmRoad,[]);
      assert.equal(road.lineTimes,null);
      assert.equal(road.bandReplays,null);
      assert.equal(road.classifiedResults,null);
      assert.equal(road.pointPreview.status,'unavailable');
      assert.equal(road.canCommitAwards,false);
      return true;
    });
  });
}
