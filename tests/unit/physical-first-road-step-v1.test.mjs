import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePhysicalFirstRoadV1} from
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
