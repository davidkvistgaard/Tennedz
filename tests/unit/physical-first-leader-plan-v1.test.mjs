import test from 'node:test';
import assert from 'node:assert/strict';
import {planPhysicalFirstPelotonLeaderV1} from
  '../../lib/engine/v2/physical-first-leader-plan-v1.mjs';
import {advancePhysicalFirstRoadV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';
import {advancePhysicalFirstPelotonKmV1} from
  '../../lib/engine/v2/physical-first-peloton-km-v1.mjs';

const segment={km:1,terrain:'flat',gradientPct:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const rider=(id,flat=65)=>({id,flat,hills:flat,
  mountain:flat,endurance:65,form:50,fatigue:0});
const input=()=>({
  prior:{sourceKm:0,roads:[{roadId:'peloton',
    riderIds:['a1','a2','b1'],clockSeconds:0}],
  riders:['a1','a2','b1'].map(riderId=>({riderId,
    teamId:riderId[0],roadId:'peloton',distanceM:0,
    clockSeconds:0,reserve:80,quietKm:0}))},
  segment,teams:[
    {id:'a',riders:[rider('a1'),rider('a2')],
      orders:{helperIds:['a1','a2'],baseline:{
        effort:'steady',chase:'selective',
        frontWork:'rotate',frontWorkRiderId:'a1'},phases:[]}},
    {id:'b',riders:[rider('b1')],
      orders:{helperIds:['b1'],baseline:{
        effort:'steady',chase:'selective',
        frontWork:'sit_in'},phases:[]}}],
  stakes:[{teamId:'a',sportingGoal:'sprint_finish',
    sportingCaptainId:'a2'},
  {teamId:'b',sportingGoal:'sprint_finish',
    sportingCaptainId:'b1'}]});

test('named leader is quoted from actual order and can lead paid road',()=>{
  const request=input();
  const plan=planPhysicalFirstPelotonLeaderV1(request);
  assert.equal(plan.leaderRiderId,'a1');
  assert.equal(plan.teamOrderFrontWork,'rotate');
  assert.equal(plan.sportingCaptainId,'a2');
  assert.ok(plan.quotedPaidWork>0);
  const step=advancePhysicalFirstRoadV1({...request,
    roadId:'peloton',leaderRiderId:plan.leaderRiderId,
    planVersion:plan.version,kilometres:[segment]});
  assert.equal(step.road.leaderRiderId,'a1');
  assert.equal(step.road.riderDecisions.filter(row=>
    row.role==='leader').length,1);
});

test('a missing named worker requires the exact emergency order',()=>{
  const request=input();
  request.prior.roads[0].riderIds=['a2','b1'];
  request.prior.riders=request.prior.riders.filter(row=>
    row.riderId!=='a1');
  assert.throws(()=>planPhysicalFirstPelotonLeaderV1(request),
    /absent without a paid emergency replacement/);
  request.emergencyFrontWorkers=[{version:1,teamId:'a',
    unavailableRiderId:'a1',replacementRiderId:'a2'}];
  const plan=planPhysicalFirstPelotonLeaderV1(request);
  assert.equal(plan.leaderRiderId,'a2');
  assert.equal(plan.emergencyFrontWorker.reason,
    'committed_worker_absent_from_paid_bunch');
});

test('named worker cannot be silently replaced when unable to pay',()=>{
  const request=input();
  request.prior.riders[0].reserve=.001;
  assert.throws(()=>planPhysicalFirstPelotonLeaderV1(request),
    /Named front worker cannot pay the road/);
});

test('selective front work chooses a payable helper who keeps shelter',()=>{
  const request=input();
  delete request.teams[0].orders.baseline.frontWorkRiderId;
  request.teams[0].riders[1]=rider('a2',70);
  request.teams[1].riders[0]=rider('b1',37);
  const plan=planPhysicalFirstPelotonLeaderV1(request);
  assert.equal(plan.leaderRiderId,'a1');
  assert.equal(plan.predictedStartDrops,0);
  assert.equal(plan.choice,
    'preserve_road_group_with_paid_front');
  assert.ok(plan.perceivedAbilityAtChoice>0);
});

test('selective summit support also preserves the paid bunch',()=>{
  const request=input();
  delete request.teams[0].orders.baseline.frontWorkRiderId;
  request.stakes[0].sportingGoal='summit_attack';
  request.teams[0].riders[1]=rider('a2',70);
  request.teams[1].riders[0]=rider('b1',37);
  const plan=planPhysicalFirstPelotonLeaderV1(request);
  assert.equal(plan.leaderRiderId,'a1');
  assert.equal(plan.predictedStartDrops,0);
  assert.equal(plan.choice,'preserve_road_group_with_paid_front');
});

test('full chase still selects the fastest payable helper',()=>{
  const request=input();
  delete request.teams[0].orders.baseline.frontWorkRiderId;
  request.teams[0].orders.baseline.chase='all';
  request.teams[0].riders[1]=rider('a2',70);
  const plan=planPhysicalFirstPelotonLeaderV1(request);
  assert.equal(plan.leaderRiderId,'a2');
  assert.equal(plan.choice,'pay_named_or_rotating_front');
});

test('sitting in supplies no invented bunch worker',()=>{
  const request=input();
  request.teams[0].orders.baseline.frontWork='sit_in';
  assert.throws(()=>planPhysicalFirstPelotonLeaderV1(request),
    /No ordered payable bunch leader/);
});

test('composed bunch kilometre records ordered lead and paid road',()=>{
  const request=input();
  const result=advancePhysicalFirstPelotonKmV1({
    ...request,kilometres:[segment]});
  assert.equal(result.leaderPlan.leaderRiderId,'a1');
  assert.equal(result.road.leaderRiderId,'a1');
  assert.equal(result.finishes.length,3);
  assert.equal(result.startDropEvents.length,0);
  assert.ok(result.road.riderDecisions.every(row=>
    row.planVersion===result.leaderPlan.version));
});
