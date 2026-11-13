import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';

test('opt-in V94 chasing credits one paid leader at a time',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',
    settings:{distanceKm:120,terrain:'flat',teamCount:20,fatigue:0,
      attack:'none',chase:'selective',seed:'chase-turn-v94-1'},
    chaseTurnVersion:1});
  const paid=recording.frames.filter(frame=>
    frame.chaseTurnPlan.status==='worked');
  assert.ok(paid.length>0);
  for(const frame of paid){
    const plan=frame.chaseTurnPlan;
    assert.equal(plan.turns[0].startM,0);
    assert.equal(plan.turns.at(-1).endM,1000);
    assert.ok(plan.chasePower<=plan.candidates.reduce((sum,row)=>
      sum+row.capacity,0));
    assert.ok(Math.abs(plan.chasePower-frame.chasePower)<1e-8);
  }
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
  const forged=structuredClone(recording);
  forged.frames.find(frame=>frame.chaseTurnPlan.status==='worked')
    .chaseTurnPlan.extraEnergyCosts[0].extraCost=0;
  assert.throws(()=>replayRaceDynamicsRecording(forged),/differ|invalid/i);
});
