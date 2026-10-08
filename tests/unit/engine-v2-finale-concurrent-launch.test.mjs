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
  chase='ignore',rotate=false,captainSkill=skill,
  captainFatigue=0}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,
    flat:index===0?captainSkill:skill,
    strength:index===0?captainSkill:skill,
    timetrial:index===0?captainSkill:skill,
    endurance:75,acceleration:80,
    sprint:70,leadership:60,
    fatigue:index===0?captainFatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase,
      breakWork:'cooperate',frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,{chase='ignore',rotate=false,
  captainSkill=80,captainFatigue=0}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',75,gender,{attack:true}),
    team('b',80,gender,{attack:true,captainSkill,captainFatigue}),
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

test('paired captain ability and fatigue alter only that named launch',()=>{
  for(const gender of ['M','F']){
    const base=recordFinaleConcurrentNamedLaunchFromTour(source(gender));
    const weaker=recordFinaleConcurrentNamedLaunchFromTour(source(gender,{
      captainSkill:70}));
    const tired=recordFinaleConcurrentNamedLaunchFromTour(source(gender,{
      captainFatigue:40}));
    assert.equal(base.bunchSpeedKph,weaker.bunchSpeedKph);
    assert.equal(base.bunchSpeedKph,tired.bunchSpeedKph);
    assert.equal(base.attacks[0].earnedGapSeconds,
      weaker.attacks[0].earnedGapSeconds);
    assert.equal(base.attacks[0].earnedGapSeconds,
      tired.attacks[0].earnedGapSeconds);
    assert.ok(base.attacks[1].earnedGapSeconds>
      weaker.attacks[1].earnedGapSeconds);
    assert.ok(base.attacks[1].earnedGapSeconds>
      tired.attacks[1].earnedGapSeconds);
    assert.ok(tired.attacks[1].energyAtDecision<
      base.attacks[1].energyAtDecision);
  }
});
