import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedChaseRotationFromTour,
  validateFinaleConcurrentNamedChaseRotationFromTour,
  recordFinaleConcurrentNamedSelectiveRotationFromTour,
  validateFinaleConcurrentNamedSelectiveRotationFromTour,
  FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_VERSION} from
  '../../lib/engine/v2/finale-concurrent-named-chase-rotation-launch.mjs';

function team(id,skill,gender,{attack=false,
  chase='ignore',rotate=false,helpers=true}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:80,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:helpers?[`${id}-2`,`${id}-3`]:[],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase,
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,{chaseRotate=false,
  attackingRotate=false,rotationHelpers=true,chaseRule='all'}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,gender,{
    attack:true,rotate:attackingRotate}),
  team('b',80,gender,{attack:true}),
  team('c',100,gender,{chase:chaseRule,rotate:chaseRotate}),
  team('d',95,gender,{rotate:true,
    helpers:rotationHelpers})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-chase-rotation-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('independent paid chase and rotation face two named launches',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender);
    const original=structuredClone(tour.provisionalResults);
    const launch=recordFinaleConcurrentNamedChaseRotationFromTour(tour);
    assert.equal(launch.endDistanceM,39250);
    assert.equal(launch.chase.teamId,'c');
    assert.equal(launch.rotation.selected.teamId,'d');
    assert.equal(launch.rotationDecision,'paid');
    assert.equal(launch.attacks.length,2);
    assert.equal(launch.riderEnergy.length,32);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='attack')
      .length,2);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='chase')
      .length,1);
    assert.equal(launch.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    assert.ok(launch.bunchSpeedKph>=launch.passiveBunchSpeedKph);
    assert.ok(launch.attacks.every(row=>row.bunchSeconds===
      launch.bunchElapsedSeconds));
    assert.equal(validateFinaleConcurrentNamedChaseRotationFromTour(tour,
      JSON.parse(JSON.stringify(launch))),true);
    const forged=structuredClone(launch);
    forged.riderEnergy.find(row=>row.role==='front_rotation')
      .energySpent=0;
    assert.throws(()=>validateFinaleConcurrentNamedChaseRotationFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('a selective rival responds to due attacks while another team pays rotation',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,{chaseRule:'selective'});
    const sourceResult=structuredClone(tour.provisionalResults);
    const launch=recordFinaleConcurrentNamedSelectiveRotationFromTour(tour);
    assert.equal(launch.version,FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_VERSION);
    assert.equal(launch.selectiveDecision.teamId,'c');
    assert.equal(launch.selectiveDecision.decision,'engage');
    assert.ok(launch.selectiveDecision.attackPressure>=
      launch.selectiveDecision.awarenessThreshold);
    assert.equal(launch.chase.teamId,'c');
    assert.equal(launch.rotation.selected.teamId,'d');
    assert.equal(launch.riderEnergy.filter(row=>row.role==='chase').length,1);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='front_rotation').length,2);
    assert.equal(validateFinaleConcurrentNamedSelectiveRotationFromTour(tour,
      JSON.parse(JSON.stringify(launch))),true);
    const forged=structuredClone(launch);
    forged.selectiveDecision.decision='wait';
    assert.throws(()=>validateFinaleConcurrentNamedSelectiveRotationFromTour(
      tour,forged),/does not replay/);
    assert.throws(()=>recordFinaleConcurrentNamedSelectiveRotationFromTour(
      source(gender,{chaseRule:'selective',chaseRotate:true})),
    /separate rotating rivals/);
    assert.deepEqual(tour.provisionalResults,sourceResult);
  }
});

test('one team cannot silently work as both chaser and rotator',()=>{
  assert.throws(()=>recordFinaleConcurrentNamedChaseRotationFromTour(
    source('M',{chaseRotate:true})),/separate rotating rivals/);
  assert.throws(()=>recordFinaleConcurrentNamedChaseRotationFromTour(
    source('M',{attackingRotate:true})),/separate rotating rivals/);
});

test('an ordered rotation without a payable pair is recorded unavailable',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,{rotationHelpers:false});
    const launch=recordFinaleConcurrentNamedChaseRotationFromTour(tour);
    assert.equal(launch.rotationDecision,'no_eligible_pair');
    assert.equal(launch.rotation.selected,null);
    assert.equal(launch.riderEnergy.filter(row=>
      row.role==='front_rotation').length,0);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='chase')
      .length,1);
    assert.equal(validateFinaleConcurrentNamedChaseRotationFromTour(
      tour,JSON.parse(JSON.stringify(launch))),true);
  }
});
