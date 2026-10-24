import test from 'node:test';
import assert from 'node:assert/strict';
import {paidQueuedRiderAt} from
  '../../lib/engine/v2/finale-late-active-wheel-contact.mjs';

test('a single-phase isolated rider pays energy through an in-slice instant',()=>{
  const band={runner:{frames:[{
    elapsedSecondsAtStart:10,durationSeconds:20,
    riders:[{riderId:'isolated-1',positionBeforeM:259500,
      positionM:259600,activeSeconds:20,activeDistanceM:100,
      shelteredSeconds:0,shelteredDistanceM:0,
      energyAtDecision:8,energySpent:3,energyAfter:5}]}]}};
  assert.deepEqual(paidQueuedRiderAt(band,'isolated-1',20),{
    riderId:'isolated-1',positionM:259550,energy:6.5});
  band.runner.frames[0].riders[0].energyAfter=6;
  assert.throws(()=>paidQueuedRiderAt(band,'isolated-1',20),
    /discontinuous paid energy/);
});
