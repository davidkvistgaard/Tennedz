import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,
  V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

function settings(fatigue){
  return {distanceKm:260,teamCount:20,gender:'M',terrain:'custom',fatigue,
    profileHeightsM:[100,600,1200,1800,2300,2500],
    seed:`v93-custom-extreme-M-${fatigue}-climb`,
    defaultRivalPlan:'attack',effort:'hard',attack:'repeated',
    chase:'ignore'};
}

for(const [fatigue,reason,message] of [
  [0,'unpayable_front_handoff',/you-6 at 259000 m/],
  [30,'unresolved_band_contact',/bands crossed without contact/]])
  test(`extreme custom road with fatigue ${fatigue} refuses only its unpaid handoff`,()=>{
    assert.throws(()=>createV93PlayableTest(settings(fatigue)),error=>{
      assert.match(error.message,message);
      const road=error.roadPreview;
      assert.equal(road.version,V93_UNSUPPORTED_HANDOFF_PREVIEW_VERSION);
      assert.equal(road.unsupportedReason,reason);
      assert.equal(road.handoffKm,259);
      assert.equal(road.kilometreFrames.length,259);
      assert.equal(road.kilometreFrames.at(-1).km,259);
      assert.ok(road.kilometreFrames.at(-1).ownRiders.every(row=>
        Number.isFinite(row.energy)&&row.energy>=0));
      if(reason==='unpayable_front_handoff'){
        assert.equal(road.handoff.riderId,'you-6');
        assert.ok(road.kilometreFrames.at(-1).roadGroups.some(group=>
          group.riderIds.includes('you-6')));
      }
      assert.deepEqual(road.lastKmRoad,[]);
      assert.equal(road.lineTimes,null);
      assert.equal(road.bandReplays,null);
      assert.equal(road.classifiedResults,null);
      assert.equal(road.pointPreview.status,'unavailable');
      assert.equal(road.canCommitAwards,false);
      return true;
    });
  });
