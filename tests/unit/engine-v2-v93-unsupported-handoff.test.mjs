import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest,
  validateV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

const pointContext={tier:2,divisionCount:2,divisionIndex:1};
function settings(gender,fatigue){
  return {distanceKm:260,teamCount:20,gender,terrain:'custom',fatigue,
    profileHeightsM:[100,600,1200,1800,2300,2500],
    seed:`v93-custom-extreme-${gender}-${fatigue}-climb`,
    defaultRivalPlan:'attack',effort:'hard',attack:'repeated',
    chase:'ignore'};
}

for(const gender of ['M','F'])for(const fatigue of [0,30])
  test(`extreme ${gender} fatigue ${fatigue} front leavers reach paid lines`,()=>{
    const input=settings(gender,fatigue);
    const race=createV93PlayableTest(input,{pointContext});
    assert.equal(validateV93CoastedPlaytest(input,{pointContext},race),true);
    const summary=summarizeV93CoastedPlaytest(race);
    assert.equal(summary.roadStatus,
      'conditional_front_leavers_ahead_of_bunch');
    assert.equal(summary.lineTimes.length,160);
    assert.deepEqual(race.clock.trace.sourceDroppedRiderIds,
      fatigue===30?['you-0','you-1']:[]);
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
    if(fatigue===30){
      assert.deepEqual(race.clock.line.bands.map(row=>row.id),
        ['front_with_leavers','peloton','dropped']);
      assert.equal(race.clock.line.bands.at(-1).firstPossiblePlace,159);
      assert.ok(race.clock.passageFrames.every(frame=>
        frame.droppedPassages.filter(row=>
          ['you-0','you-1'].includes(row.riderId)).every(row=>
          row.passageSecondsFromBunchMarker>
            frame.bunchPassageSecondsFromBunchMarker)));
    }
  });
