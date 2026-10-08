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
  FINALE_CONCURRENT_NAMED_SELECTIVE_ROTATION_VERSION,
  recordFinaleConcurrentNamedMultiSelectiveRotationFromTour,
  validateFinaleConcurrentNamedMultiSelectiveRotationFromTour,
  FINALE_CONCURRENT_NAMED_MULTI_SELECTIVE_ROTATION_VERSION,
  recordFinaleConcurrentNamedMixedSelectiveRotationFromTour,
  validateFinaleConcurrentNamedMixedSelectiveRotationFromTour,
  FINALE_CONCURRENT_NAMED_MIXED_SELECTIVE_ROTATION_VERSION,
  recordFinaleConcurrentNamedInactiveSelectiveRotationFromTour,
  validateFinaleConcurrentNamedInactiveSelectiveRotationFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-chase-rotation-launch.mjs';
import {recordFinaleConcurrentNamedMixedSelectiveRotationContactFromTour,
  validateFinaleConcurrentNamedMixedSelectiveRotationContactFromTour,
  recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour,
  validateFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-chase-rotation-contact.mjs';
import {recordFinaleConcurrentInactiveBunchFollowupFromTour,
  validateFinaleConcurrentInactiveBunchFollowupFromTour} from
  '../../lib/engine/v2/finale-concurrent-inactive-bunch-followup.mjs';

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

function multiSelectiveSource(gender,{firstChaseHelpers=true}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,gender,{attack:true}),
    team('b',80,gender,{attack:true}),
    team('c',100,gender,{chase:'selective',
      helpers:firstChaseHelpers}),
    team('e',90,gender,{chase:'selective'}),
    team('f',85,gender,{chase:'selective'}),
    team('d',95,gender,{rotate:true})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-multi-selective-${gender}-${firstChaseHelpers}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

function mixedSelectiveSource(gender,{firstAttackAtKm=40,
  rotationHelpers=true}={}){
  const stage={distance_km:41,
    profile_points:[[0,100],[41,100]],
    keypoints:[{km:40,kind:'SPRINT'}]};
  const attacker=team('a',75,gender,{attack:true});
  attacker.orders.phases[0].atKm=firstAttackAtKm;
  const notDue=team('b',80,gender,{attack:true});
  notDue.orders.phases[0].atKm=36;
  const teams=[attacker,notDue,
    team('c',100,gender,{chase:'selective'}),
    team('e',90,gender,{chase:'selective'}),
    team('f',85,gender,{chase:'selective'}),
    team('d',95,gender,{rotate:true,helpers:rotationHelpers})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-mixed-selective-${gender}`,
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

test('an aware team without a payable helper cannot claim chase work',()=>{
  for(const gender of ['M','F']){
    const launch=recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(
      multiSelectiveSource(gender,{firstChaseHelpers:false}));
    assert.equal(launch.selectiveDecisions.find(row=>
      row.teamId==='c').decision,'no_helper');
    assert.notEqual(launch.chase?.teamId,'c');
    assert.equal(launch.riderEnergy.filter(row=>row.role==='chase').length,1);
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

test('multiple selective rivals record every decision but pay one chase turn',()=>{
  for(const gender of ['M','F']){
    const tour=multiSelectiveSource(gender);
    const original=structuredClone(tour.provisionalResults);
    const launch=recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(
      tour);
    assert.equal(launch.version,
      FINALE_CONCURRENT_NAMED_MULTI_SELECTIVE_ROTATION_VERSION);
    assert.equal(launch.selectiveDecisions.length,3);
    assert.equal(launch.selectiveDecisions.filter(row=>
      row.decision==='working').length,1);
    assert.equal(launch.selectiveDecisions.filter(row=>
      row.decision==='waiting_turn').length,2);
    assert.equal(launch.chase.teamId,
      launch.selectiveDecisions.find(row=>
        row.decision==='working').teamId);
    assert.equal(launch.rotation.selected.teamId,'d');
    assert.equal(launch.riderEnergy.length,48);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='chase').length,1);
    assert.equal(launch.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    assert.equal(validateFinaleConcurrentNamedMultiSelectiveRotationFromTour(
      tour,JSON.parse(JSON.stringify(launch))),true);
    const forged=structuredClone(launch);
    forged.selectiveDecisions[0].decision='wait';
    assert.throws(()=>validateFinaleConcurrentNamedMultiSelectiveRotationFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('a non-due named phase does not erase another paid attack',()=>{
  for(const gender of ['M','F']){
    const tour=mixedSelectiveSource(gender);
    const original=structuredClone(tour.provisionalResults);
    assert.throws(()=>(
      recordFinaleConcurrentNamedMixedSelectiveRotationFromTour(
        multiSelectiveSource(gender))),/needs eligible named attacks/);
    assert.throws(()=>recordFinaleConcurrentNamedMultiSelectiveRotationFromTour(
      tour),/needs eligible named attacks/);
    const launch=recordFinaleConcurrentNamedMixedSelectiveRotationFromTour(
      tour);
    assert.equal(launch.version,
      FINALE_CONCURRENT_NAMED_MIXED_SELECTIVE_ROTATION_VERSION);
    assert.deepEqual(launch.nonlaunchingNamedDecisions.map(row=>
      [row.riderId,row.decision]),[['b-0','not_due']]);
    assert.deepEqual(launch.attacks.map(row=>row.riderId),['a-0']);
    assert.equal(launch.riderEnergy.find(row=>row.riderId==='b-0')
      .role,'sheltered');
    assert.equal(launch.riderEnergy.filter(row=>row.role==='attack')
      .length,1);
    assert.equal(launch.riderEnergy.length,48);
    assert.equal(validateFinaleConcurrentNamedMixedSelectiveRotationFromTour(
      tour,JSON.parse(JSON.stringify(launch))),true);
    const contact=recordFinaleConcurrentNamedMixedSelectiveRotationContactFromTour(
      tour);
    assert.deepEqual(contact.roadGroups.flatMap(row=>row.riderIds),['a-0']);
    assert.ok(contact.pelotonRiderIds.includes('b-0'));
    assert.equal(contact.riderEnergy.length,48);
    assert.equal(validateFinaleConcurrentNamedMixedSelectiveRotationContactFromTour(
      tour,JSON.parse(JSON.stringify(contact))),true);
    const forged=structuredClone(contact);
    forged.nonlaunchingNamedDecisions[0].decision='eligible';
    assert.throws(()=>(
      validateFinaleConcurrentNamedMixedSelectiveRotationContactFromTour(
        tour,forged)),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('no due named attack leaves selective chasers waiting while rotation pays',()=>{
  for(const gender of ['M','F']){
    const tour=mixedSelectiveSource(gender,{firstAttackAtKm:36});
    const original=structuredClone(tour.provisionalResults);
    assert.throws(()=>(
      recordFinaleConcurrentNamedInactiveSelectiveRotationFromTour(
        mixedSelectiveSource(gender))),/needs eligible named attacks/);
    const launch=recordFinaleConcurrentNamedInactiveSelectiveRotationFromTour(
      tour);
    assert.deepEqual(launch.nonlaunchingNamedDecisions.map(row=>
      [row.riderId,row.decision]),
    [['a-0','not_due'],['b-0','not_due']]);
    assert.deepEqual(launch.attacks,[]);
    assert.equal(launch.chase,null);
    assert.ok(launch.selectiveDecisions.every(row=>
      row.decision==='wait'));
    assert.equal(launch.rotationDecision,'paid');
    assert.equal(launch.riderEnergy.length,48);
    assert.equal(launch.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    assert.equal(validateFinaleConcurrentNamedInactiveSelectiveRotationFromTour(
      tour,JSON.parse(JSON.stringify(launch))),true);
    const contact=recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(
      tour);
    assert.deepEqual(contact.roadGroups,[]);
    assert.equal(contact.pelotonRiderIds.length,48);
    assert.equal(validateFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(
      tour,JSON.parse(JSON.stringify(contact))),true);
    const forged=structuredClone(contact);
    forged.riderEnergy[0].energySpent=0;
    assert.throws(()=>(
      validateFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(
        tour,forged)),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('inactive complete bunch pays the second 250 metres without chase',()=>{
  for(const gender of ['M','F']){
    const tour=mixedSelectiveSource(gender,{firstAttackAtKm:36});
    const original=structuredClone(tour.provisionalResults);
    const contact=recordFinaleConcurrentNamedInactiveSelectiveRotationContactFromTour(
      tour);
    const followup=recordFinaleConcurrentInactiveBunchFollowupFromTour(tour);
    assert.equal(followup.startDistanceM,contact.endDistanceM);
    assert.equal(followup.endDistanceM,40500);
    assert.equal(followup.roadGroups.length,0);
    assert.equal(followup.pelotonRiderIds.length,48);
    assert.equal(followup.rotation.selected.teamId,'d');
    assert.equal(followup.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    for(const row of followup.riderEnergy){
      assert.equal(row.energyAtDecision,contact.riderEnergy.find(previous=>
        previous.riderId===row.riderId).energyAfter);
      assert.ok(row.energyAfter>=0);
    }
    assert.deepEqual(followup.riderAttackLoad,contact.riderAttackLoad);
    assert.equal(followup.pointsStatus,'withheld');
    assert.equal(validateFinaleConcurrentInactiveBunchFollowupFromTour(tour,
      JSON.parse(JSON.stringify(followup))),true);
    const forged=structuredClone(followup);
    forged.riderEnergy[0].energySpent=0;
    assert.throws(()=>validateFinaleConcurrentInactiveBunchFollowupFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('inactive bunch falls back to passive pace when rotation cannot pay',()=>{
  const tour=mixedSelectiveSource('M',{
    firstAttackAtKm:36,rotationHelpers:false});
  const followup=recordFinaleConcurrentInactiveBunchFollowupFromTour(tour);
  assert.equal(followup.rotation.selected,null);
  assert.equal(followup.rotation.bunchSpeedKph,
    followup.rotation.passiveBunchSpeedKph);
  assert.ok(followup.riderEnergy.every(row=>row.role==='sheltered'));
  assert.equal(followup.pelotonRiderIds.length,48);
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
