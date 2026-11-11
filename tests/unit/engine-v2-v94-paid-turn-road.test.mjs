import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';

test('opt-in V94 turns pay one road-group leader at a time and replay',()=>{
  const settings={distanceKm:120,terrain:'mountain',teamCount:20,
    fatigue:30,attack:'none',chase:'selective',
    seed:'preview-recorded-road-1'};
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings,roadGroupPaceVersion:3});
  assert.equal(recording.committedInputs.raceContext.roadGroupPaceVersion,3);
  assert.ok(recording.frames.some(frame=>frame.roadGroupTurnPlans.length));
  for(const frame of recording.frames)for(const plan of frame.roadGroupTurnPlans){
    assert.equal(plan.status,'worked');
    assert.equal(plan.turns[0].startM,0);
    assert.equal(plan.turns.at(-1).endM,1000);
    for(let index=1;index<plan.turns.length;index++)
      assert.equal(plan.turns[index].startM,plan.turns[index-1].endM);
    assert.equal(new Set(plan.extraEnergyCosts.map(row=>row.riderId)).size,
      plan.extraEnergyCosts.length);
  }
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
  const forged=structuredClone(recording);
  const frame=forged.frames.find(row=>row.roadGroupTurnPlans.length);
  frame.roadGroupTurnPlans[0].turns[0].leaderRiderId='forged';
  assert.throws(()=>replayRaceDynamicsRecording(forged),/differ|invalid/i);
  const unpaid=structuredClone(recording);
  unpaid.frames.find(row=>row.roadGroupTurnPlans.length)
    .roadGroupTurnPlans[0].extraEnergyCosts[0].extraCost=0;
  assert.throws(()=>replayRaceDynamicsRecording(unpaid),/differ|invalid/i);
});
