import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePhysicalFirstRoadWithStartDropsV1,
  advancePhysicalFirstRoadV1} from
  '../../lib/engine/v2/physical-first-road-step-v1.mjs';
import {resolvePhysicalFirstRearBoundaryContactV1} from
  '../../lib/engine/v2/physical-first-rear-boundary-contact-v1.mjs';

const first={km:1,terrain:'flat',gradientPct:0,
  surface:'road',exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}};
const second={...first,km:2};
const rider=(id,ability)=>({id,flat:ability,
  hills:ability,mountain:ability,endurance:65,
  form:50,fatigue:0});
const input=()=>{
  const teams=[['a',90],['b',40],['c',40]].map(
    ([id,ability])=>({id,riders:[rider(id,ability)],
      orders:{baseline:{effort:'steady',
        chase:'selective',breakWork:'cooperate'},
      phases:[]}}));
  const stakes=teams.map(team=>({teamId:team.id,
    sportingGoal:'none',
    sportingCaptainId:team.id}));
  const start={sourceKm:0,
    roads:[{roadId:'peloton',
      riderIds:['a','b','c'],
      clockSeconds:0}],
    riders:['a','b','c'].map(riderId=>({
      riderId,teamId:riderId,
      roadId:'peloton',distanceM:0,
      clockSeconds:0,reserve:80,quietKm:0}))};
  const step=advancePhysicalFirstRoadWithStartDropsV1({
    prior:start,roadId:'peloton',
    leaderRiderId:'a',planVersion:'test-front-1',
    segment:first,kilometres:[first,second],
    teams,stakes});
  const prior={sourceKm:1,
    roads:step.roads.map(road=>({
      roadId:road.roadId,
      riderIds:road.riderIds,
      clockSeconds:road.finishClockSeconds})),
    riders:step.finishes.map(row=>({
      riderId:row.riderId,teamId:row.riderId,
      roadId:row.physicalGroup,
      distanceM:row.endDistanceM,
      clockSeconds:row.clockSeconds,
      reserve:row.energyAfter,
      quietKm:row.quietKm}))};
  return {prior,paidStep:{sourceKm:1,peloton:step,
    soloSteps:[]},nextSegment:second,teams,stakes};
};

test('co-timed paid solos form a receipted rear road',()=>{
  const request=input();
  const result=resolvePhysicalFirstRearBoundaryContactV1(
    request);
  assert.equal(result.events.length,1);
  const contact=result.events[0];
  assert.equal(contact.atDistanceM,1000);
  assert.equal(contact.atClockSeconds,
    request.prior.roads[1].clockSeconds);
  assert.deepEqual(contact.riderIds,['b','c']);
  assert.equal(contact.recordedPaidContact,true);
  assert.ok(contact.approach.every(row=>
    row.paidFromReserve>0));
  const rear=result.state.roads.find(row=>
    row.roadId===contact.roadId);
  assert.deepEqual(rear.riderIds,['b','c']);
  const plan=result.leaderPlans[0];
  assert.equal(plan.leaderRiderId,'b');
  const step=advancePhysicalFirstRoadV1({
    prior:result.state,roadId:contact.roadId,
    leaderRiderId:plan.leaderRiderId,
    planVersion:plan.version,segment:second,
    kilometres:[first,second],
    teams:request.teams,stakes:request.stakes});
  assert.equal(step.road.kind,'rear_group');
  assert.ok(step.finishes[1].paidFromReserve<
    step.finishes[0].paidFromReserve);
});

test('contact refuses a missing paid solo receipt',()=>{
  const request=input();
  request.paidStep.peloton.finishes.find(row=>
    row.riderId==='c').paidFromReserve=0;
  assert.throws(()=>
    resolvePhysicalFirstRearBoundaryContactV1(
      request),/lacks paid solo approach/);
});

test('contact refuses a rear group with no willing leader',()=>{
  const request=input();
  request.teams[1].orders.baseline.breakWork='sit_on';
  request.teams[2].orders.baseline.breakWork='sit_on';
  assert.throws(()=>
    resolvePhysicalFirstRearBoundaryContactV1(
      request),/lacks one payable/);
});
