import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedLaunchFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-launch.mjs';
import {recordFinaleConcurrentNamedAllChaseFromTour,
  validateFinaleConcurrentNamedAllChaseFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-all-chase.mjs';

function team(id,skill,gender,{attack=false,
  chase='ignore',rotate=false}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:80,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase,
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,{chase='all',rotate=false,
  secondChase='ignore'}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,gender,{attack:true}),
    team('b',80,gender,{attack:true}),
    team('c',100,gender,{chase}),
    team('d',80,gender,{rotate,chase:secondChase})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-all-chase-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('an ordered rival helper pays once for two simultaneous attacks',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender);
    const original=structuredClone(tour.provisionalResults);
    const launch=recordFinaleConcurrentNamedAllChaseFromTour(tour);
    assert.equal(launch.endDistanceM,39250);
    assert.equal(launch.attacks.length,2);
    assert.equal(launch.chase.teamId,'c');
    assert.ok(['c-2','c-3'].includes(launch.chase.riderId));
    assert.ok(launch.bunchSpeedKph>=launch.passiveBunchSpeedKph);
    assert.equal(launch.riderEnergy.length,32);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='attack')
      .length,2);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='chase')
      .length,1);
    assert.equal(launch.riderEnergy.find(row=>
      row.riderId===launch.chase.riderId).energySpent,
    launch.chase.energySpent);
    assert.ok(launch.attacks.every(row=>row.bunchSeconds===
      launch.bunchElapsedSeconds));
    assert.equal(validateFinaleConcurrentNamedAllChaseFromTour(tour,
      JSON.parse(JSON.stringify(launch))),true);
    const forged=structuredClone(launch);
    forged.riderEnergy.find(row=>row.role==='chase').energySpent=0;
    assert.throws(()=>validateFinaleConcurrentNamedAllChaseFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('paid all-chase cannot give attackers a larger passive gap',()=>{
  for(const gender of ['M','F']){
    const passive=recordFinaleConcurrentNamedLaunchFromTour(
      source(gender,{chase:'ignore'}));
    const chased=recordFinaleConcurrentNamedAllChaseFromTour(
      source(gender));
    assert.ok(chased.bunchSpeedKph>=passive.bunchSpeedKph);
    assert.ok(chased.attacks.every((attack,index)=>
      attack.earnedGapSeconds<=
        passive.attacks[index].earnedGapSeconds));
  }
});

test('unpaid selective chase and front rotation remain unresolved',()=>{
  assert.throws(()=>recordFinaleConcurrentNamedAllChaseFromTour(
    source('M',{chase:'selective'})),/named attacks plus rival all-chase/);
  assert.throws(()=>recordFinaleConcurrentNamedAllChaseFromTour(
    source('M',{rotate:true})),/named attacks plus rival all-chase/);
  assert.throws(()=>recordFinaleConcurrentNamedAllChaseFromTour(
    source('M',{secondChase:'all'})),
  /named attacks plus rival all-chase/);
});
