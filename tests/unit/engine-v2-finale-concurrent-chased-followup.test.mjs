import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentNamedAllChaseContactFromTour} from
  '../../lib/engine/v2/finale-concurrent-named-all-chase-contact.mjs';
import {recordFinaleConcurrentChasedFollowupFromTour,
  validateFinaleConcurrentChasedFollowupFromTour} from
  '../../lib/engine/v2/finale-concurrent-chased-followup.mjs';

function team(id,skill,gender,{attack=false,
  chase='ignore',breakWork='cooperate'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:80,
    sprint:70,leadership:60,fatigue:0})),orders:{
    captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`,`${id}-3`],preset:'balanced',
    baseline:{effort:'steady',attack:'none',chase,
      breakWork,frontWork:'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

function source(gender,{breakWork='cooperate',secondSkill=80}={}){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',30,gender,{attack:true}),
    team('b',secondSkill,gender,{attack:true,breakWork}),
    team('c',100,gender,{chase:'all'}),
    team('d',80,gender)];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-followup-${gender}-${breakWork}-${secondSkill}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('paid concurrent launch moves one road group and all energy forward',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender);
    const contact=recordFinaleConcurrentNamedAllChaseContactFromTour(
      tour);
    const followup=recordFinaleConcurrentChasedFollowupFromTour(tour);
    assert.equal(followup.startDistanceM,contact.endDistanceM);
    assert.equal(followup.outcome,'surviving_solo');
    assert.equal(followup.endDistanceM,followup.plannedEndDistanceM);
    assert.equal(followup.roadGroups.length,1);
    assert.equal(followup.riderEnergy.length,32);
    assert.equal(followup.riderAttackLoad.length,32);
    assert.equal(followup.riderEnergy.filter(row=>row.role==='chase')
      .length,1);
    assert.equal(followup.riderEnergy.filter(row=>row.role==='front')
      .length,1);
    assert.equal(validateFinaleConcurrentChasedFollowupFromTour(tour,
      JSON.parse(JSON.stringify(followup))),true);
    const forged=structuredClone(followup);
    forged.riderEnergy.find(row=>row.role==='chase').energySpent=0;
    assert.throws(()=>validateFinaleConcurrentChasedFollowupFromTour(
      tour,forged),/does not replay/);
  }
});

test('a caught solo stops at measured contact instead of free travel',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,{breakWork:'sit_on',secondSkill:50});
    const followup=recordFinaleConcurrentChasedFollowupFromTour(tour);
    assert.equal(followup.outcome,'caught_uncontinued');
    assert.ok(followup.endDistanceM<followup.plannedEndDistanceM);
    assert.equal(followup.catchDistanceM,followup.endDistanceM);
    assert.deepEqual(followup.roadGroups,[]);
    assert.equal(followup.pelotonRiderIds.length,32);
  }
});
