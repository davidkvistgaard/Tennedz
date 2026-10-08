import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedLaunchFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-launch.mjs';
import {recordFinaleConcurrentNamedRotationLaunchFromTour,
  validateFinaleConcurrentNamedRotationLaunchFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-rotation-launch.mjs';

function team(id,skill,gender,{attack=false,
  rotate=false,chase='ignore'}={}){
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

function source(gender,{rotate=true,
  attackerRotate=false,chase='ignore'}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,gender,{attack:true,rotate:attackerRotate}),
    team('b',80,gender,{attack:true}),
    team('c',100,gender,{rotate,chase}),
    team('d',95,gender,{rotate})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-rotation-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('one ordered rotation turn pays its helpers once against two attacks',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender);
    const original=structuredClone(tour.provisionalResults);
    const launch=recordFinaleConcurrentNamedRotationLaunchFromTour(tour);
    assert.equal(launch.endDistanceM,39250);
    assert.deepEqual(launch.rotation.eligibleTeamIds,['c','d']);
    assert.equal(launch.rotation.selected.teamId,'c');
    assert.equal(launch.rotation.selected.work.length,2);
    assert.equal(launch.attacks.length,2);
    assert.equal(launch.riderEnergy.length,32);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='attack')
      .length,2);
    assert.equal(launch.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    for(const worker of launch.rotation.selected.work){
      const energy=launch.riderEnergy.find(row=>
        row.riderId===worker.riderId);
      assert.equal(energy.energySpent,worker.energySpent);
    }
    assert.ok(launch.attacks.every(row=>row.bunchSeconds===
      launch.bunchElapsedSeconds));
    assert.equal(validateFinaleConcurrentNamedRotationLaunchFromTour(tour,
      JSON.parse(JSON.stringify(launch))),true);
    const forged=structuredClone(launch);
    forged.riderEnergy.find(row=>row.role==='front_rotation')
      .energySpent=0;
    assert.throws(()=>validateFinaleConcurrentNamedRotationLaunchFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('paid rotation cannot enlarge a named gap over a passive field',()=>{
  for(const gender of ['M','F']){
    const passive=recordFinaleConcurrentNamedLaunchFromTour(
      source(gender,{rotate:false}));
    const rotated=recordFinaleConcurrentNamedRotationLaunchFromTour(
      source(gender));
    assert.ok(rotated.bunchSpeedKph>=passive.bunchSpeedKph);
    assert.ok(rotated.attacks.every((attack,index)=>
      attack.earnedGapSeconds<=
        passive.attacks[index].earnedGapSeconds));
  }
});

test('a simultaneous chase or attacker-owned rotation is not ignored',()=>{
  assert.throws(()=>recordFinaleConcurrentNamedRotationLaunchFromTour(
    source('M',{chase:'all'})),/front-work-only rivals/);
  assert.throws(()=>recordFinaleConcurrentNamedRotationLaunchFromTour(
    source('M',{attackerRotate:true})),/front-work-only rivals/);
});
