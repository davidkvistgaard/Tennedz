import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedChaseRotationFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleConcurrentNamedChaseRotationContactFromTour,
  validateFinaleConcurrentNamedChaseRotationContactFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-chase-rotation-contact.mjs';

function team(id,skill,gender,{attack=false,
  chase='ignore',rotate=false,captainAcceleration=80,
  effort='steady'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,
    acceleration:index===0?captainAcceleration:80,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort,attack:'none',chase,
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,firstSkill,firstAcceleration=80,
  firstEffort='steady'){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',firstSkill,gender,{
    attack:true,captainAcceleration:firstAcceleration,
    effort:firstEffort}),
    team('b',80,gender,{attack:true}),
    team('c',100,gender,{chase:'all'}),
    team('d',95,gender,{rotate:true})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-chase-rotation-contact-${gender}-${
      firstSkill}-${firstAcceleration}-${firstEffort}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('paid chase and rotation reach one unambiguous road group',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75,10,'conserve');
    const launch=recordFinaleConcurrentNamedChaseRotationFromTour(tour);
    assert.deepEqual(launch.attacks.map(row=>row.status),
      ['contained','split']);
    const contact=recordFinaleConcurrentNamedChaseRotationContactFromTour(
      tour);
    assert.deepEqual(contact.containedRiderIds,['a-0']);
    assert.deepEqual(contact.roadGroups[0].riderIds,['b-0']);
    assert.equal(contact.roadGroups[0].gapSeconds,
      launch.attacks[1].earnedGapSeconds);
    assert.equal(contact.pelotonRiderIds.length,31);
    assert.equal(contact.riderEnergy.length,32);
    assert.equal(contact.riderEnergy.filter(row=>row.role==='chase')
      .length,1);
    assert.equal(contact.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    assert.equal(contact.riderAttackLoad.filter(row=>
      ['a-0','b-0'].includes(row.riderId)&&row.loadAfter===1)
      .length,2);
    assert.equal(validateFinaleConcurrentNamedChaseRotationContactFromTour(
      tour,JSON.parse(JSON.stringify(contact))),true);
    const forged=structuredClone(contact);
    forged.riderEnergy.find(row=>row.role==='chase').energySpent=0;
    assert.throws(()=>
      validateFinaleConcurrentNamedChaseRotationContactFromTour(
        tour,forged),/does not replay/);
  }
});

test('two surviving attacks still need their relative road decision',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75);
    const launch=recordFinaleConcurrentNamedChaseRotationFromTour(tour);
    assert.ok(launch.attacks.every(row=>row.status==='split'));
    assert.throws(()=>
      recordFinaleConcurrentNamedChaseRotationContactFromTour(tour),
    /relative road-contact rule/);
  }
});
