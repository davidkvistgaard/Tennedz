import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentRelativeArrivalsFromTour,
  validateFinaleConcurrentRelativeArrivalsFromTour,
  recordFinaleConcurrentSelectiveRelativeArrivalsFromTour,
  validateFinaleConcurrentSelectiveRelativeArrivalsFromTour,
  FINALE_CONCURRENT_SELECTIVE_RELATIVE_ARRIVALS_VERSION} from
  '../../lib/engine/v2/finale-concurrent-relative-arrivals.mjs';

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

function source(gender,firstSkill,secondSkill,chaseRule='all'){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',firstSkill,gender,{attack:true}),
    team('b',secondSkill,gender,{attack:true}),
    team('c',100,gender,{chase:chaseRule}),
    team('d',95,gender,{rotate:true})];
  return simulateTacticalTour({stage,teams,
    seed:`relative-arrivals-${gender}-${firstSkill}-${secondSkill}${
      chaseRule==='all'?'':`-${chaseRule}`}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('two paid attackers have relative arrival times without fake groups',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75,80);
    const original=structuredClone(tour.provisionalResults);
    const relative=recordFinaleConcurrentRelativeArrivalsFromTour(tour);
    assert.equal(relative.endDistanceM,39250);
    assert.equal(relative.arrivals.length,2);
    assert.equal(relative.arrivals[0].riderId,'b-0');
    assert.equal(relative.earlierRiderId,'b-0');
    assert.ok(relative.separationSeconds>0);
    assert.equal(relative.separationSeconds,
      relative.arrivals[1].elapsedSeconds-
        relative.arrivals[0].elapsedSeconds);
    assert.equal(relative.estimatedSeparationM,
      250*relative.separationSeconds/
        relative.arrivals[1].elapsedSeconds);
    assert.equal(relative.riderEnergy.length,32);
    assert.equal(relative.riderAttackLoad.length,32);
    assert.equal(relative.roadRelationshipStatus,'unresolved');
    assert.equal(validateFinaleConcurrentRelativeArrivalsFromTour(tour,
      JSON.parse(JSON.stringify(relative))),true);
    const forged=structuredClone(relative);
    forged.separationSeconds=0;
    assert.throws(()=>validateFinaleConcurrentRelativeArrivalsFromTour(
      tour,forged),/do not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('selective chase retains paid relative arrivals without assigning groups',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,75,80,'selective');
    const original=structuredClone(tour.provisionalResults);
    const relative=recordFinaleConcurrentSelectiveRelativeArrivalsFromTour(
      tour);
    assert.equal(relative.version,
      FINALE_CONCURRENT_SELECTIVE_RELATIVE_ARRIVALS_VERSION);
    assert.equal(relative.arrivals.length,2);
    assert.equal(relative.selectiveDecision.decision,'engage');
    assert.equal(relative.roadRelationshipStatus,'unresolved');
    assert.ok(relative.separationSeconds>=0);
    assert.equal(relative.riderEnergy.length,32);
    assert.equal(relative.riderAttackLoad.length,32);
    assert.equal(validateFinaleConcurrentSelectiveRelativeArrivalsFromTour(
      tour,JSON.parse(JSON.stringify(relative))),true);
    const forged=structuredClone(relative);
    forged.selectiveDecision.decision='wait';
    assert.throws(()=>validateFinaleConcurrentSelectiveRelativeArrivalsFromTour(
      tour,forged),/do not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('equal measured arrival times do not invent an earlier rider',()=>{
  for(const gender of ['M','F']){
    const relative=recordFinaleConcurrentRelativeArrivalsFromTour(
      source(gender,75,75));
    assert.equal(relative.separationSeconds,0);
    assert.equal(relative.estimatedSeparationM,0);
    assert.equal(relative.earlierRiderId,null);
    assert.equal(relative.roadRelationshipStatus,'unresolved');
  }
});
