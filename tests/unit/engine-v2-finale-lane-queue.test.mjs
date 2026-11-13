import test from 'node:test';
import assert from 'node:assert/strict';
import {queuePaidBunchFrame} from
  '../../lib/engine/v2/finale-lane-queue.mjs';

const row=(riderId,positionBeforeM,velocityMps,finishM=100)=>{
  const distance=finishM-positionBeforeM;
  const seconds=distance/velocityMps;
  return {riderId,role:'sprint',positionBeforeM,
    positionM:finishM,distanceTravelledM:distance,
    activeDistanceM:distance,shelteredDistanceM:0,
    activeSeconds:seconds,shelteredSeconds:0,
    activeWorkCostPerKm:100,shelteredWorkCostPerKm:0,
    reabsorbedAt:null,energyAtDecision:50,
    energySpent:distance*.1,energyAfter:50-distance*.1,
    elapsedToLineSeconds:seconds};
};

test('a faster follower pays travel but queues behind its own lane wheel',()=>{
  const slots=[{riderId:'leader',lane:0,row:0},
    {riderId:'follower',lane:0,row:1}];
  const [leader,follower]=queuePaidBunchFrame([
    row('leader',0,10),row('follower',-2.5,12)],slots,{
    durationSeconds:10,elapsedSeconds:0,finishM:100,
    wheelSpacingM:2.5});
  assert.equal(leader.elapsedToLineSeconds,10);
  assert.equal(follower.elapsedToLineSeconds,null);
  assert.ok(Math.abs(follower.positionM-97.5)<1e-8);
  assert.ok(Math.abs(follower.energySpent-10)<1e-8);
  assert.ok(follower.laneBlocks.length>0);
  assert.equal(follower.laneBlocks[0].leaderId,'leader');
  const [done,tail]=queuePaidBunchFrame([
    {...leader,role:'finished',positionBeforeM:100,
      activeSeconds:0,shelteredSeconds:0},
    row('follower',97.5,12)],slots,{
    durationSeconds:1,elapsedSeconds:10,finishM:100,
    wheelSpacingM:2.5});
  assert.equal(done.energySpent,leader.energySpent);
  assert.ok(Math.abs(tail.elapsedToLineSeconds-
    (10+2.5/12))<1e-8);
  assert.equal(tail.laneBlocks.length,0);
});

test('a rider in another lane keeps its paid independent crossing',()=>{
  const slots=[{riderId:'leader',lane:0,row:0},
    {riderId:'follower',lane:1,row:0}];
  const [,follower]=queuePaidBunchFrame([
    row('leader',0,10),row('follower',-2.5,12)],slots,{
    durationSeconds:10,elapsedSeconds:0,finishM:100,
    wheelSpacingM:2.5});
  assert.ok(Math.abs(follower.elapsedToLineSeconds-
    102.5/12)<1e-8);
  assert.equal(follower.laneBlocks.length,0);
});

test('a versioned wheel tolerance absorbs rounding without changing the old queue',()=>{
  const slots=[{riderId:'leader',lane:0,row:0},
    {riderId:'follower',lane:0,row:1}];
  const rows=[row('leader',0,10),
    row('follower',-2.5+5e-8,10)];
  const input={durationSeconds:1,elapsedSeconds:0,finishM:100,
    wheelSpacingM:2.5};
  assert.throws(()=>queuePaidBunchFrame(rows,slots,input),
    /overlapping wheels/);
  const [,follower]=queuePaidBunchFrame(rows,slots,{
    ...input,wheelToleranceM:1e-7});
  assert.ok(follower.positionM<10);
  assert.ok(follower.energySpent>0);
  assert.throws(()=>queuePaidBunchFrame([
    row('leader',0,10),row('follower',-2.49,10)],slots,{
    ...input,wheelToleranceM:1e-7}),/overlapping wheels/);
});
