import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest,V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';
import {recordFinaleCoastDroppedLastKmClock} from
  '../../lib/engine/v2/finale-separated-last-km.mjs';

const context={tier:3,divisionIndex:1,divisionCount:1};
const settings=(gender,terrain)=>({distanceKm:260,teamCount:15,
  gender,terrain,fatigue:15,seed:'v93-seed-audit-2',
  defaultRivalPlan:'chase',effort:'conserve',attack:'repeated',
  chase:'all',profileHeightsM:[100,350,150,500,180,100]});

test('new bunch drops retain separate paid roads beneath surviving fronts',()=>{
  for(const gender of ['M','F'])
    for(const [terrain,sourceDrops,finalDrops,bands] of [
      ['custom',12,22,25],['mountain',46,50,52]]){
      const input=settings(gender,terrain);
      const options={pointContext:context};
      const race=createV93PlayableTest(input,options);
      const summary=summarizeV93CoastedPlaytest(race);
      const newDrops=race.clock.trace.finalDroppedRiderIds.filter(id=>
        !race.clock.trace.sourceDroppedRiderIds.includes(id));
      assert.equal(race.version,V93_DYNAMIC_ACTIVE_PLAYTEST_VERSION);
      assert.throws(()=>recordFinaleCoastDroppedLastKmClock(
        race.recording),/Newly exhausted finale riders/);
      assert.equal(race.clock.trace.sourceDroppedRiderIds.length,
        sourceDrops);
      assert.equal(race.clock.trace.finalDroppedRiderIds.length,
        finalDrops);
      assert.equal(newDrops.length,finalDrops-sourceDrops);
      assert.equal(race.individualLine.pre500Audit.status,
        'unresolved_active_bunch_drops');
      assert.deepEqual(race.individualLine.pre500Audit.droppedRiderIds,
        newDrops);
      assert.equal(summary.lastKmRoad.at(-1).distanceM,260000);
      assert.equal(summary.lastKmRoad.at(-1).droppedPassages.length,
        finalDrops);
      assert.equal(summary.bandReplays.length,bands);
      assert.equal(summary.lineTimes.length,120);
      assert.equal(new Set(summary.lineTimes.map(row=>row.riderId)).size,
        120);
      assert.ok(newDrops.every(id=>summary.lineTimes.find(row=>
        row.riderId===id)?.roadBandId===`isolated:${id}`));
      assert.equal(race.individualLine.provisionalLineOrder,null);
      assert.equal(race.pointPreview.status,'unavailable');
      assert.equal(race.pointsStatus,'withheld');
      assert.equal(race.canCommitAwards,false);
      assert.equal(validateV93CoastedPlaytest(input,options,race),true);
    }
});
