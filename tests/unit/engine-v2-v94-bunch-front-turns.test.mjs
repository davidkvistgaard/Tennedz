import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';

test('opt-in V94 bunch front has one paid leader and one sitter per half km',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings:{distanceKm:120,terrain:'mountain',teamCount:20,fatigue:30,
      attack:'none',chase:'selective',seed:'preview-recorded-road-1'},
    bunchFrontTurnVersion:1});
  const paid=recording.frames.filter(frame=>frame.bunchFrontTurnPlan);
  assert.ok(paid.length>0);
  for(const frame of paid){
    const plan=frame.bunchFrontTurnPlan;
    assert.deepEqual(plan.turns.map(row=>[row.startM,row.endM]),
      [[0,500],[500,1000]]);
    assert.equal(new Set(plan.turns.map(row=>row.leaderRiderId)).size,2);
    assert.equal(plan.extraEnergyCosts.length,2);
    assert.equal(plan.ability,frame.paidBunchPace.ability);
  }
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
  const forged=structuredClone(recording);
  forged.frames.find(frame=>frame.bunchFrontTurnPlan)
    .bunchFrontTurnPlan.extraEnergyCosts[0].extraCost=0;
  assert.throws(()=>replayRaceDynamicsRecording(forged),/differ|invalid/i);
});
