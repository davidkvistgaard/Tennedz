import test from 'node:test';
import assert from 'node:assert/strict';
import {createV94RaceDynamicsPreview} from
  '../../lib/engine/v2/playtest-race-dynamics-v94.mjs';
import {replayRaceDynamicsRecording} from
  '../../lib/engine/v2/replay-race-dynamics-v94.mjs';

const settings={distanceKm:120,teamCount:20,terrain:'flat',fatigue:0,
  attack:'none',chase:'selective',seed:'chase-turn-holdout-1-flat-0'};

test('opt-in shared bunch front pays one leader on every road metre',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
    chaseTurnVersion:1,bunchFrontTurnVersion:1,pelotonFrontTurnVersion:1});
  assert.equal(recording.frames.length,120);
  assert.ok(recording.frames.some(frame=>
    frame.chaseTurnPlan.status==='worked'&&frame.paidBunchPace));
  for(const frame of recording.frames){
    const plan=frame.pelotonFrontTurnPlan;
    assert.equal(plan.status,'worked');
    assert.equal(plan.turns[0].startM,0);
    assert.equal(plan.turns.at(-1).endM,1000);
    assert.equal(plan.extraEnergyCosts.reduce((sum,row)=>
      sum+row.leadingM,0),1000);
    assert.ok(Math.abs(plan.chasePower-frame.chasePower)<1e-8);
  }
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
  const forged=structuredClone(recording);
  forged.frames.find(frame=>frame.pelotonFrontTurnPlan.turns.length>0)
    .pelotonFrontTurnPlan.turns[0].ability=100;
  assert.throws(()=>replayRaceDynamicsRecording(forged),/differ|invalid/i);
});

test('historical opt-in chase version retains its separate road contract',()=>{
  const {recording}=createV94RaceDynamicsPreview({format:'one_day',settings,
    chaseTurnVersion:1,bunchFrontTurnVersion:1});
  assert.equal(recording.frames.length,120);
  assert.ok(recording.frames.every(frame=>
    !Object.hasOwn(frame,'pelotonFrontTurnPlan')));
  assert.equal(replayRaceDynamicsRecording(recording).frames.length,120);
});
