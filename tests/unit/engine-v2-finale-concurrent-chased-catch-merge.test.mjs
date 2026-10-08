import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from
  '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleConcurrentChasedCatchMergeFromTour,
  validateFinaleConcurrentChasedCatchMergeFromTour} from
  '../../lib/engine/v2/finale-concurrent-chased-catch-merge.mjs';

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

function source(gender,secondSkill,breakWork){
  const stage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:39,kind:'SPRINT'}]};
  const teams=[team('a',30,gender,{attack:true}),
    team('b',secondSkill,gender,{attack:true,breakWork}),
    team('c',100,gender,{chase:'all'}),
    team('d',80,gender)];
  return simulateTacticalTour({stage,teams,
    seed:`concurrent-merge-${gender}-${secondSkill}-${breakWork}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
}

test('caught concurrent attack completes its slice with paid merged travel',()=>{
  for(const gender of ['M','F']){
    const tour=source(gender,50,'sit_on');
    const original=structuredClone(tour.provisionalResults);
    const merged=recordFinaleConcurrentChasedCatchMergeFromTour(tour);
    assert.ok(merged.catchDistanceM>39250&&
      merged.catchDistanceM<39500);
    assert.equal(merged.endDistanceM,39500);
    assert.equal(merged.preCatch.outcome,'caught_uncontinued');
    assert.equal(merged.postCatchTravel.startDistanceM,
      merged.catchDistanceM);
    assert.equal(merged.postCatchTravel.endDistanceM,39500);
    assert.equal(merged.pelotonRiderIds.length,32);
    assert.deepEqual(merged.roadGroups,[]);
    assert.equal(merged.riderEnergy.length,32);
    assert.ok(merged.riderEnergy.every(row=>
      row.energyAfter>=0&&
      row.energyAtCatch>=row.energyAfter&&
      row.postCatchEnergySpent>0));
    assert.equal(merged.sliceElapsedSeconds,
      merged.preCatch.bunchElapsedSeconds+
      merged.postCatchTravel.travelSeconds);
    assert.equal(validateFinaleConcurrentChasedCatchMergeFromTour(
      tour,JSON.parse(JSON.stringify(merged))),true);
    const forged=structuredClone(merged);
    forged.riderEnergy[0].postCatchEnergySpent=0;
    assert.throws(()=>validateFinaleConcurrentChasedCatchMergeFromTour(
      tour,forged),/does not replay/);
    assert.deepEqual(tour.provisionalResults,original);
  }
});

test('a surviving solo cannot take the caught merged branch',()=>{
  for(const gender of ['M','F']){
    assert.throws(()=>recordFinaleConcurrentChasedCatchMergeFromTour(
      source(gender,80,'cooperate')),
    /complete caught bunch/);
  }
});
