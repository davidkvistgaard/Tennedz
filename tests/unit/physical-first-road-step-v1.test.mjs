import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePhysicalFirstRoadV1,
  advancePhysicalFirstRoadWithStartDropsV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';

const segment={km:1,terrain:'flat',gradientPct:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const rider=id=>({id,flat:65,hills:65,mountain:65,
  endurance:65,form:50,fatigue:0});
const input=()=>({
  prior:{sourceKm:0,
    roads:[{roadId:'peloton',riderIds:['a','b'],
      clockSeconds:0}],
    riders:['a','b'].map(riderId=>({riderId,
      teamId:riderId,roadId:'peloton',
      distanceM:0,clockSeconds:0,reserve:80,
      quietKm:0}))},
  roadId:'peloton',leaderRiderId:'a',
  planVersion:'test-paid-front-plan-1',
  segment,kilometres:[segment],
  teams:['a','b'].map(id=>({id,riders:[rider(id)],
    orders:{baseline:{effort:'steady',chase:'selective'},
      phases:[]}})),
  stakes:['a','b'].map(teamId=>({teamId,
    sportingGoal:'sprint_finish',
    sportingCaptainId:teamId}))});

test('physical-first road step pays one leader and cheaper shelter',()=>{
  const result=advancePhysicalFirstRoadV1(input());
  assert.equal(result.sourceKm,1);
  assert.equal(result.road.leaderRiderId,'a');
  assert.equal(result.road.riderDecisions.filter(row=>
    row.role==='leader').length,1);
  assert.equal(result.finishes.length,2);
  assert.ok(result.finishes.every(row=>
    row.endDistanceM===1000&&
    row.clockSeconds===result.road.finishClockSeconds));
  assert.ok(result.finishes[1].paidFromReserve<
    result.finishes[0].paidFromReserve);
  assert.ok(result.road.riderDecisions.every(row=>
    row.sportingGoal==='sprint_finish'&&
    row.teamOrderEffort==='steady'&&
    Number.isFinite(row.perceivedAbilityAtChoice)));
});

test('physical-first road step refuses an unholdable follower',()=>{
  const request=input();
  request.teams[1].riders[0]={id:'b',flat:0,hills:0,
    mountain:0,endurance:0,form:0,fatigue:0};
  assert.throws(()=>advancePhysicalFirstRoadV1(request),
    /km 1 rider b loses shelter/);
});

test('physical-first road step refuses an unpaid leader',()=>{
  const request=input();
  request.prior.riders[0].reserve=.001;
  assert.throws(()=>advancePhysicalFirstRoadV1(request),
    /Rear rider cannot pay terrain-priced work/);
});

test('physical-first road step refuses invented shared membership',()=>{
  const request=input();
  request.prior.riders[1].roadId='solo-b';
  assert.throws(()=>advancePhysicalFirstRoadV1(request),
    /invalid prior membership/);
});

test('unholdable follower leaves at the measured boundary and pays solo',()=>{
  const request=input();
  request.teams[1].riders[0]={id:'b',flat:0,hills:0,
    mountain:0,endurance:0,form:0,fatigue:0};
  const result=advancePhysicalFirstRoadWithStartDropsV1(request);
  assert.deepEqual(result.roads.map(row=>row.roadId),
    ['peloton','solo:b']);
  assert.equal(result.startDropEvents.length,1);
  assert.equal(result.startDropEvents[0].atDistanceM,0);
  assert.equal(result.startDropEvents[0].atClockSeconds,0);
  assert.equal(result.startDropEvents[0].riderId,'b');
  assert.equal(result.roads[1].riderDecisions[0].role,'leader');
  assert.equal(result.finishes.length,2);
  assert.ok(result.finishes.every(row=>row.endDistanceM===1000));
  assert.ok(result.finishes[1].clockSeconds>
    result.finishes[0].clockSeconds);
  assert.ok(result.finishes[1].paidFromReserve>0);
});

test('a detached rider continues from paid time and reserve next km',()=>{
  const request=input();
  request.teams[1].riders[0]={id:'b',flat:0,hills:0,
    mountain:0,endurance:0,form:0,fatigue:0};
  const first=advancePhysicalFirstRoadWithStartDropsV1(request);
  const nextSegment={...segment,km:2};
  const nextPrior={sourceKm:1,roads:first.roads.map(road=>({
    roadId:road.roadId,riderIds:road.riderIds,
    clockSeconds:road.finishClockSeconds})),
  riders:first.finishes.map(finish=>({
    riderId:finish.riderId,teamId:finish.riderId,
    roadId:finish.physicalGroup,
    distanceM:finish.endDistanceM,
    clockSeconds:finish.clockSeconds,
    reserve:finish.energyAfter,quietKm:finish.quietKm}))};
  const next={...request,prior:nextPrior,segment:nextSegment,
    kilometres:[segment,nextSegment]};
  const bunch=advancePhysicalFirstRoadWithStartDropsV1(next);
  const solo=advancePhysicalFirstRoadV1({...next,
    roadId:'solo:b',leaderRiderId:'b'});
  assert.equal(bunch.startDropEvents.length,0);
  assert.equal(bunch.finishes[0].endDistanceM,2000);
  assert.equal(solo.finishes[0].endDistanceM,2000);
  assert.equal(solo.finishes[0].energyBefore,
    first.finishes[1].energyAfter);
  assert.equal(solo.road.startClockSeconds,
    first.roads[1].finishClockSeconds);
});

test('a start drop cannot silently reuse an existing solo road',()=>{
  const request=input();
  request.teams[1].riders[0]={id:'b',flat:0,hills:0,
    mountain:0,endurance:0,form:0,fatigue:0};
  request.prior.roads.push({roadId:'solo:b',riderIds:['x'],
    clockSeconds:0});
  assert.throws(()=>advancePhysicalFirstRoadWithStartDropsV1(
    request),/conflicts with an existing solo road/);
});

test('start drop wrapper preserves a connected paid road',()=>{
  const result=advancePhysicalFirstRoadWithStartDropsV1(input());
  assert.deepEqual(result.startDropEvents,[]);
  assert.equal(result.roads.length,1);
  assert.deepEqual(result.roads[0],result.road);
});
