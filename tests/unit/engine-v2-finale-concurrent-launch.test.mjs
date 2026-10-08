import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedLaunchFromTour,
  validateFinaleConcurrentNamedLaunchFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-launch.mjs';

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

function source(gender,{chase='ignore',rotate=false}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,gender,{attack:true}),
    team('b',80,gender,{attack:true}),
    team('c',75,gender,{chase}),
    team('d',80,gender,{rotate})];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('two named attacks pay independently against one passive bunch',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender);
    const original=structuredClone(tour.provisionalResults);
    const launch=recordFinaleConcurrentNamedLaunchFromTour(tour);
    assert.equal(launch.endDistanceM,39250);
    assert.equal(launch.attacks.length,2);
    assert.deepEqual(launch.attacks.map(row=>row.riderId),['a-0','b-0']);
    assert.equal(launch.riderEnergy.length,32);
    assert.equal(launch.riderEnergy.filter(row=>row.role==='attack')
      .length,2);
    assert.ok(launch.attacks.every(row=>row.energySpent>0&&
      row.bunchSeconds===launch.bunchElapsedSeconds));
    for(const attack of launch.attacks){
      const energy=launch.riderEnergy.find(row=>
        row.riderId===attack.riderId);
      assert.equal(energy.energySpent,attack.energySpent);
      assert.equal(energy.energyAfter,attack.energyAfter);
    }
    assert.equal(launch.roadOutcomeStatus,'unresolved');
    assert.equal(validateFinaleConcurrentNamedLaunchFromTour(tour,
      JSON.parse(JSON.stringify(launch))),true);
    const forged=structuredClone(launch);
    forged.riderEnergy.find(row=>row.riderId==='b-0')
      .energySpent=0;
    assert.throws(()=>validateFinaleConcurrentNamedLaunchFromTour(tour,
      forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('unpaid rival work is refused by the passive launch',()=>{
  assert.throws(()=>recordFinaleConcurrentNamedLaunchFromTour(
    source('M',{chase:'selective'})),/complete passive bunch/);
  assert.throws(()=>recordFinaleConcurrentNamedLaunchFromTour(
    source('M',{rotate:true})),/complete passive bunch/);
});
