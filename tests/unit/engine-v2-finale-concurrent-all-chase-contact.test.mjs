import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedAllChaseFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-all-chase.mjs';
import {recordFinaleConcurrentNamedAllChaseContactFromTour,
  validateFinaleConcurrentNamedAllChaseContactFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-all-chase-contact.mjs';

function team(id,skill,gender,{attack=false,chase='ignore'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:80,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase,
      breakWork:'cooperate',frontWork:'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,firstSkill){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',firstSkill,gender,{attack:true}),
    team('b',80,gender,{attack:true}),
    team('c',100,gender,{chase:'all'}),
    team('d',80,gender)];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-chase-contact-${gender}-${firstSkill}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('one paid rival chase and one split carry through road contact',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,30);
    const launch=recordFinaleConcurrentNamedAllChaseFromTour(tour);
    assert.deepEqual(launch.attacks.map(row=>row.status),
      ['contained','split']);
    const road=recordFinaleConcurrentNamedAllChaseContactFromTour(tour);
    assert.equal(road.chase.riderId,launch.chase.riderId);
    assert.equal(road.chase.energySpent,launch.chase.energySpent);
    assert.deepEqual(road.containedRiderIds,['a-0']);
    assert.deepEqual(road.roadGroups[0].riderIds,['b-0']);
    assert.equal(road.roadGroups[0].gapSeconds,
      launch.attacks[1].earnedGapSeconds);
    assert.equal(road.pelotonRiderIds.length,31);
    assert.equal(road.riderEnergy.length,32);
    assert.equal(road.riderEnergy.filter(row=>row.role==='chase')
      .length,1);
    assert.equal(road.riderAttackLoad.filter(row=>
      ['a-0','b-0'].includes(row.riderId)&&row.loadAfter===1)
      .length,2);
    assert.equal(validateFinaleConcurrentNamedAllChaseContactFromTour(
      tour,JSON.parse(JSON.stringify(road))),true);
    const forged=structuredClone(road);
    forged.roadGroups[0].gapSeconds=0;
    assert.throws(()=>validateFinaleConcurrentNamedAllChaseContactFromTour(
      tour,forged),/does not replay/);
  }
});

test('two surviving chased attacks still need their relative road decision',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75);
    const launch=recordFinaleConcurrentNamedAllChaseFromTour(tour);
    assert.ok(launch.attacks.every(row=>row.status==='split'));
    assert.throws(()=>recordFinaleConcurrentNamedAllChaseContactFromTour(
      tour),/relative road-contact rule/);
  }
});
