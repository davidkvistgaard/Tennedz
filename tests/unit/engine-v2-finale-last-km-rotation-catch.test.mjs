import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {probeLastKmRotationCatchFromTour,
  validateLastKmRotationCatchFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-catch.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  validateFinaleRotationCatchSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:20,profile_points:[[0,100],[20,100]],
  keypoints:[{km:19,kind:'SPRINT'}]};
function team(id,skill,{gender,attack=false,rotate=false,chase='ignore'}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`,`${id}-3`],
    preset:'balanced',baseline:{effort:'steady',chase,
      attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:19,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('v91 source links the paid rotating catch to an exact 500 m handoff',()=>{
  for(const gender of ['M','F']){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',50,{gender,attack:true}),
      team('b',75,{gender,rotate:true}),
      team('c',80,{gender,chase:'all'})],
    seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const oldResults=structuredClone(tour.provisionalResults);
    const record=probeLastKmRotationCatchFromTour(tour,{teamId:'a'});
    assert.equal(record.sourceKm,19);
    assert.equal(record.frames.length,2);
    assert.ok(record.frames[0].roadGroups[0].gapSeconds>0);
    assert.ok(record.frames[1].catchDistanceM>19250&&
      record.frames[1].catchDistanceM<19500);
    assert.equal(record.frames[0].rotation.selected.teamId,'b');
    assert.equal(record.at500M.distanceM,19500);
    assert.equal(record.at500M.pelotonRiderIds.length,24);
    assert.equal(record.at500M.riderEnergy.length,24);
    assert.ok(record.at500M.riderEnergy.every(row=>row.energy>=0));
    assert.equal(record.at500M.bunchElapsedSeconds,
      record.frames[0].bunchElapsedSeconds+
        record.frames[1].bunchElapsedSeconds);
    assert.deepEqual(tour.provisionalResults,oldResults);
    assert.equal(validateLastKmRotationCatchFromTour(tour,
      {teamId:'a'},record),true);
    assert.throws(()=>validateLastKmRotationCatchFromTour(tour,
      {teamId:'a'},{...record,at500M:{...record.at500M,
        bunchElapsedSeconds:0}}),/does not replay/);
    const input={attackTeamId:'a',plans:['a','b','c'].map(teamId=>({
      teamId,finisherId:`${teamId}-0`,leadOutRiderId:`${teamId}-2`}))};
    const plan=recordFinaleRotationCatchSprintPlanFromTour(tour,input);
    assert.equal(plan.decisionDistanceM,19500);
    assert.equal(plan.sourceRoadTraceVersion,record.version);
    assert.deepEqual(plan.decisions.map(row=>row.roadGroupId),
      ['peloton','peloton','peloton']);
    assert.ok(plan.decisions.every(row=>row.finisherEnergy>0&&
      row.leadOutEnergy>=20&&row.leadOutWorkCostPerKm>0));
    assert.equal(validateFinaleRotationCatchSprintPlanFromTour(tour,
      input,plan),true);
    assert.throws(()=>validateFinaleRotationCatchSprintPlanFromTour(tour,
      input,{...plan,decisions:plan.decisions.map(row=>({
        ...row,leadOutEnergy:100}))}),/does not replay/);
    assert.throws(()=>recordFinaleRotationCatchSprintPlanFromTour(tour,{
      ...input,plans:input.plans.map(row=>row.teamId==='b'?{
        ...row,leadOutRiderId:'b-4'}:row)}),
    /distinct locked team riders/);
  }
});
