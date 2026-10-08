import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedLaunchFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-launch.mjs';
import {recordFinaleConcurrentNamedRoadContactFromTour,
  validateFinaleConcurrentNamedRoadContactFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-road-contact.mjs';

function team(id,skill,gender,attack){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:60,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase:'ignore',
      breakWork:'cooperate',frontWork:'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,secondSkill,firstSkill=30){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',firstSkill,gender,true),
    team('b',secondSkill,gender,true),
    team('c',85,gender,false),team('d',85,gender,false)];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-contact-${gender}-${firstSkill}-${secondSkill}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('two contained manager attacks remain in one paid bunch',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,30);
    const launch=recordFinaleConcurrentNamedLaunchFromTour(tour);
    assert.ok(launch.attacks.every(row=>row.status==='contained'));
    const road=recordFinaleConcurrentNamedRoadContactFromTour(tour);
    assert.deepEqual(road.roadGroups,[]);
    assert.equal(road.pelotonRiderIds.length,32);
    assert.deepEqual(road.containedRiderIds,['a-0','b-0']);
    assert.equal(road.riderEnergy.length,32);
    assert.equal(road.riderAttackLoad.length,32);
    assert.equal(road.riderAttackLoad.find(row=>row.riderId==='a-0')
      .loadAfter,1);
    assert.equal(validateFinaleConcurrentNamedRoadContactFromTour(tour,
      JSON.parse(JSON.stringify(road))),true);
    const forged=structuredClone(road);
    forged.containedRiderIds=[];
    assert.throws(()=>validateFinaleConcurrentNamedRoadContactFromTour(
      tour,forged),/does not replay/);
  }
});

test('one split and one contained attack preserve distinct road and load',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,80);
    const launch=recordFinaleConcurrentNamedLaunchFromTour(tour);
    assert.deepEqual(launch.attacks.map(row=>row.status),
      ['contained','split']);
    const road=recordFinaleConcurrentNamedRoadContactFromTour(tour);
    assert.deepEqual(road.containedRiderIds,['a-0']);
    assert.deepEqual(road.roadGroups[0].riderIds,['b-0']);
    assert.equal(road.roadGroups[0].gapSeconds,
      launch.attacks[1].earnedGapSeconds);
    assert.equal(road.pelotonRiderIds.length,31);
    assert.ok(road.pelotonRiderIds.includes('a-0'));
    assert.ok(!road.pelotonRiderIds.includes('b-0'));
    assert.equal(road.riderEnergy.length,32);
    assert.equal(road.riderAttackLoad.filter(row=>
      ['a-0','b-0'].includes(row.riderId)&&row.loadAfter===1).length,2);
  }
});

test('two surviving attacks stay unresolved without relative contact',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75,75);
    const launch=recordFinaleConcurrentNamedLaunchFromTour(tour);
    assert.ok(launch.attacks.every(row=>row.status==='split'));
    assert.throws(()=>recordFinaleConcurrentNamedRoadContactFromTour(tour),
      /relative road-contact rule/);
  }
});
