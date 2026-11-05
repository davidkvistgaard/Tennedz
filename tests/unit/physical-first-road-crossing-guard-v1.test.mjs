import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoUnpaidRoadCrossingsV1} from
  '../../lib/engine/v2/physical-first-road-crossing-guard-v1.mjs';

const prior={roads:[
  {roadId:'peloton',clockSeconds:100},
  {roadId:'solo:a',clockSeconds:103},
  {roadId:'solo:b',clockSeconds:106}]};
const advanced=[
  {roadId:'peloton',finishClockSeconds:140},
  {roadId:'solo:a',finishClockSeconds:143},
  {roadId:'solo:b',finishClockSeconds:146}];

test('distinct paid roads can keep their observed order',()=>{
  assert.equal(assertNoUnpaidRoadCrossingsV1(
    prior,advanced),true);
});

test('two solo roads cannot pass without recorded contact',()=>{
  const crossed=structuredClone(advanced);
  crossed[1].finishClockSeconds=147;
  assert.throws(()=>assertNoUnpaidRoadCrossingsV1(
    prior,crossed),error=>
    /Road crossing needs recorded paid contact/
      .test(error.message)&&
    error.sourceEvidence.firstRoadId==='solo:a'&&
    error.sourceEvidence.secondRoadId==='solo:b'&&
    error.sourceEvidence.startClockDifferenceSeconds<0&&
    error.sourceEvidence.endClockDifferenceSeconds>0);
});

test('a solo road cannot pass the bunch without contact',()=>{
  const crossed=structuredClone(advanced);
  crossed[1].finishClockSeconds=139;
  assert.throws(()=>assertNoUnpaidRoadCrossingsV1(
    prior,crossed),/Road crossing needs recorded paid contact/);
});

test('equal finish clocks require an explicit contact event',()=>{
  const matched=structuredClone(advanced);
  matched[2].finishClockSeconds=143;
  assert.throws(()=>assertNoUnpaidRoadCrossingsV1(
    prior,matched),/Road crossing needs recorded paid contact/);
});

test('two co-timed solo roads require boundary contact resolution',()=>{
  const tied=structuredClone(prior);
  tied.roads[2].clockSeconds=103;
  const next=structuredClone(advanced);
  next[2].finishClockSeconds=143;
  assert.throws(()=>assertNoUnpaidRoadCrossingsV1(
    tied,next),error=>
    /Road crossing needs recorded paid contact/
      .test(error.message)&&
    error.sourceEvidence.startClockDifferenceSeconds===0);
});
