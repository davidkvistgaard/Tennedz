import test from 'node:test';
import assert from 'node:assert/strict';
import {planPhysicalFirstRearLeaderV1} from
  '../../lib/engine/v2/physical-first-rear-leader-plan-v1.mjs';
import {advancePhysicalFirstRoadV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';

const segment={km:2,terrain:'flat',gradientPct:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const rider=(id,flat=65)=>({id,flat,hills:flat,
  mountain:flat,endurance:65,form:50,fatigue:0});
const input=()=>({
  prior:{sourceKm:1,roads:[{roadId:'rear:a+b',
    riderIds:['a','b'],clockSeconds:55}],
  riders:['a','b'].map(riderId=>({
    riderId,teamId:riderId,
    roadId:'rear:a+b',distanceM:1000,
    clockSeconds:55,reserve:80,quietKm:0}))},
  roadId:'rear:a+b',segment,
  teams:['a','b'].map(id=>({
    id,riders:[rider(id)],
    orders:{baseline:{effort:'steady',
      breakWork:'cooperate'},phases:[]}})),
  stakes:['a','b'].map(teamId=>({
    teamId,sportingGoal:'none',
    sportingCaptainId:teamId}))});

test('rear group chooses one payable leader and shelters the other',()=>{
  const request=input();
  const plan=planPhysicalFirstRearLeaderV1(request);
  assert.equal(plan.leaderRiderId,'a');
  assert.deepEqual(plan.shelteredRiderIds,['b']);
  const first={...segment,km:1};
  const step=advancePhysicalFirstRoadV1({...request,
    leaderRiderId:plan.leaderRiderId,
    planVersion:plan.version,
    kilometres:[first,segment]});
  assert.equal(step.road.kind,'rear_group');
  assert.equal(step.road.riderDecisions.filter(row=>
    row.role==='leader').length,1);
  assert.ok(step.finishes[1].paidFromReserve<
    step.finishes[0].paidFromReserve);
});

test('a sit-on order cannot volunteer a rear leader',()=>{
  const request=input();
  request.teams[0].orders.baseline.breakWork='sit_on';
  const plan=planPhysicalFirstRearLeaderV1(request);
  assert.equal(plan.leaderRiderId,'b');
  request.teams[1].orders.baseline.breakWork='sit_on';
  assert.throws(()=>planPhysicalFirstRearLeaderV1(
    request),/lacks one payable/);
});

test('rear group cannot hide an unholdable sheltered rider',()=>{
  const request=input();
  request.teams[1].riders[0]=rider('b',0);
  request.teams[1].orders.baseline.breakWork='sit_on';
  assert.throws(()=>planPhysicalFirstRearLeaderV1(
    request),/lacks one payable/);
});

test('drive order pays more reserve for higher rear speed',()=>{
  const request=input();
  const ordinary=planPhysicalFirstRearLeaderV1(request);
  const ordinaryStep=advancePhysicalFirstRoadV1({
    ...request,leaderRiderId:ordinary.leaderRiderId,
    planVersion:ordinary.version,
    kilometres:[{...segment,km:1},segment]});
  request.teams[0].orders.baseline.breakWork='drive';
  const driven=planPhysicalFirstRearLeaderV1(request);
  assert.equal(driven.leaderRiderId,'a');
  assert.equal(driven.driveWork,true);
  assert.equal(driven.perceivedAbilityAtChoice,
    ordinary.perceivedAbilityAtChoice+5);
  assert.ok(driven.quotedPaidWork>
    ordinary.quotedPaidWork);
  const drivenStep=advancePhysicalFirstRoadV1({
    ...request,leaderRiderId:driven.leaderRiderId,
    planVersion:driven.version,
    kilometres:[{...segment,km:1},segment]});
  assert.ok(drivenStep.road.finishClockSeconds<
    ordinaryStep.road.finishClockSeconds);
  assert.ok(drivenStep.finishes[0].paidFromReserve>
    ordinaryStep.finishes[0].paidFromReserve);
  assert.equal(drivenStep.road.riderDecisions[0]
    .driveWork,true);
});

test('a drive order is not silently replaced by a slower worker',()=>{
  const request=input();
  request.teams[0].orders.baseline.breakWork='drive';
  request.teams[1].riders[0]=rider('b',0);
  assert.throws(()=>planPhysicalFirstRearLeaderV1(
    request),/Ordered rear drive cannot lead/);
});
