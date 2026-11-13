import test from 'node:test';
import assert from 'node:assert/strict';
import {paidQueuedRiderAt,splitPaidQueuedBandAt} from
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

test('an isolated paid passage splits movement and energy at first contact',()=>{
  const band={roadBandId:'isolated:isolated-1',runner:{frames:[{
    startDistanceM:259500,endDistanceM:259600,
    elapsedSecondsAtStart:10,durationSeconds:20,
    riders:[{riderId:'isolated-1',role:'dropped',
      positionBeforeM:259500,positionM:259600,
      activeSeconds:20,activeDistanceM:100,
      shelteredSeconds:0,shelteredDistanceM:0,
      energyAtDecision:8,energySpent:3,energyAfter:5}]}]}};
  const split=splitPaidQueuedBandAt(band,20,259550);
  const frame=split.frames.at(-1);
  const rider=frame.riders[0];
  assert.equal(frame.durationSeconds,10);
  assert.equal(rider.positionM,259550);
  assert.equal(rider.activeDistanceM,50);
  assert.equal(rider.activeSeconds,10);
  assert.equal(rider.energySpent,1.5);
  assert.equal(rider.energyAfter,6.5);
  assert.equal(rider.motionSegments[0].endPositionM,259550);
});
