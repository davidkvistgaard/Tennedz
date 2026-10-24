import test from 'node:test';
import assert from 'node:assert/strict';
import {createV93PlayableTest,summarizeV93CoastedPlaytest} from
  '../../lib/engine/v2/playtest-v93-coasted.mjs';

// One whole race, with only the player's 5 km effort changed. The middle
// choice exposes a contact after the 500 m handoff that has no paid individual
// continuation yet; it must not be shown as a classified finish.
const settings={distanceKm:40,teamCount:4,gender:'M',terrain:'flat',
  fatigue:0,seed:'near-catch',effort:'steady',attack:'none',chase:'all',
  defaultRivalPlan:'attack',teamOverrides:[{teamId:'you',level:40},
    ...['rival-1','rival-2','rival-3'].map(teamId=>({teamId,level:20}))]};
const withEffort=effort=>({...settings,managerFinaleOrders:[
  {teamId:'you',atKm:35,effort,chase:'all'}]});

test('close chase keeps a post-handoff steady catch unclassified between two paid outcomes',()=>{
  const conserve=createV93PlayableTest(withEffort('conserve'));
  const hard=createV93PlayableTest(withEffort('hard'));
  assert.deepEqual(conserve.recording.frames.filter(frame=>frame.km<35),
    hard.recording.frames.filter(frame=>frame.km<35));
  for(const [race,place] of [[conserve,4],[hard,1]]){
    const summary=summarizeV93CoastedPlaytest(race);
    const finisherId=summary.managerDecisions.find(row=>
      row.teamId==='you').finisherId;
    assert.equal(summary.lineTimes.length,32);
    assert.equal(summary.provisionalLineOrder.find(row=>
      row.riderId===finisherId).position,place);
    assert.equal(summary.pointsStatus,'withheld');
    assert.equal(summary.canCommitAwards,false);
  }
  assert.throws(()=>createV93PlayableTest(withEffort('steady')),error=>{
    assert.match(error.message,/needs a recorded catch for road-1/);
    assert.equal(error.cause.groupId,'road-1');
    assert.ok(error.cause.calculatedCatchDistanceM>39500&&
      error.cause.calculatedCatchDistanceM<40000);
    assert.equal(error.roadPreview?.unsupportedReason,'unpaid_front_catch');
    assert.equal(error.roadPreview?.kilometreFrames.length,39);
    assert.deepEqual(error.roadPreview?.lastKmRoad,[]);
    assert.equal(error.roadPreview?.lineTimes,null);
    assert.equal(error.roadPreview?.canCommitAwards,false);
    return true;
  });
});
