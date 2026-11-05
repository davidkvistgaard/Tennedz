import test from 'node:test';
import assert from 'node:assert/strict';
import {assertNoUnpaidRoadCrossingsV1,
  assertNoUnpaidLaunchCrossingsV1} from
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

const launchFixture=()=>({
  prior:{sourceKm:1,roads:[
    {roadId:'peloton',riderIds:['a','c'],
      clockSeconds:100},
    {roadId:'solo:b',riderIds:['b'],
      clockSeconds:105}]},
  roads:[
    {roadId:'peloton',riderIds:['c'],
      finishClockSeconds:140},
    {roadId:'solo:b',riderIds:['b'],
      finishClockSeconds:145},
    {roadId:'solo:a',riderIds:['a'],
      startDistanceM:1000,endDistanceM:2000,
      startClockSeconds:100,finishClockSeconds:142}],
  events:[{riderId:'a',fromRoadId:'peloton',
    toRoadId:'solo:a',atDistanceM:1000,
    atClockSeconds:100}]});

test('paid launch keeps its order against another road',()=>{
  const {prior,roads,events}=launchFixture();
  assert.equal(assertNoUnpaidLaunchCrossingsV1(
    prior,roads,events),true);
});

test('new road cannot pass another road without contact',()=>{
  const {prior,roads,events}=launchFixture();
  roads[2].finishClockSeconds=147;
  assert.throws(()=>assertNoUnpaidLaunchCrossingsV1(
    prior,roads,events),error=>
    /Launched road needs recorded paid contact/
      .test(error.message)&&
    error.sourceEvidence.firstRoadId==='solo:a'&&
    error.sourceEvidence.secondRoadId==='solo:b');
});

test('new road requires exact departure and exclusive rider',()=>{
  const {prior,roads,events}=launchFixture();
  assert.throws(()=>assertNoUnpaidLaunchCrossingsV1(
    prior,roads,[]),/unique paid launch/);
  events[0].atClockSeconds+=1;
  assert.throws(()=>assertNoUnpaidLaunchCrossingsV1(
    prior,roads,events),/measured paid departure/);
  events[0].atClockSeconds-=1;
  roads[0].riderIds.push('a');
  assert.throws(()=>assertNoUnpaidLaunchCrossingsV1(
    prior,roads,events),/measured paid departure/);
});

test('co-timed departures from one road remain resolvable next km',()=>{
  const {prior,roads,events}=launchFixture();
  prior.roads[0].riderIds.push('d');
  roads.push({roadId:'solo:d',riderIds:['d'],
    startDistanceM:1000,endDistanceM:2000,
    startClockSeconds:100,finishClockSeconds:142});
  events.push({riderId:'d',fromRoadId:'peloton',
    toRoadId:'solo:d',atDistanceM:1000,
    atClockSeconds:100});
  assert.equal(assertNoUnpaidLaunchCrossingsV1(
    prior,roads,events),true);
});
