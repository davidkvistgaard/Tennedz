import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {probeLastKmRotationCatchFromTour,
  validateLastKmRotationCatchFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-catch.mjs';
import {recordFinaleRotationCatchSprintPlanFromTour,
  validateFinaleRotationCatchSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {recordFinaleRotationCatchSprintApproachFromTour,
  validateFinaleRotationCatchSprintApproachFromTour} from
  '../../lib/engine/v2/finale-sprint-approach.mjs';
import {recordFinaleRotationCatchOrderedApproachFromTour,
  validateFinaleRotationCatchOrderedApproachFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleRotationCatchSprintLaunchFromTour,
  validateFinaleRotationCatchSprintLaunchFromTour} from
  '../../lib/engine/v2/finale-sprint-launch.mjs';
import {recordFinaleRotationCatchSprintRunFromTour,
  validateFinaleRotationCatchSprintRunFromTour} from
  '../../lib/engine/v2/finale-sprint-run.mjs';
import {probeFinaleRotationCatchFinishBoundsFromTour,
  validateFinaleRotationCatchFinishBoundsFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-finish-bounds.mjs';
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
    const approach=recordFinaleRotationCatchSprintApproachFromTour(
      tour,input);
    assert.equal(approach.sourceRoadTraceVersion,record.version);
    assert.equal(approach.sprintPlanVersion,plan.version);
    assert.equal(approach.frames.length,2);
    assert.equal(approach.startDistanceM,19500);
    assert.equal(approach.endDistanceM,19700);
    assert.equal(approach.energyAt300M.length,24);
    assert.equal(approach.sourceBunchElapsedSeconds,
      record.at500M.bunchElapsedSeconds);
    assert.equal(approach.bunchElapsedSecondsAt300M,
      approach.sourceBunchElapsedSeconds+
        approach.frames[0].bunchElapsedSeconds+
        approach.frames[1].bunchElapsedSeconds);
    for(const frame of approach.frames){
      assert.equal(frame.riderEnergy.length,24);
      assert.equal(frame.riderEnergy.filter(row=>
        row.role==='lead_out').length,3);
      assert.ok(frame.riderEnergy.every(row=>row.energySpent>0&&
        row.energyAfter>=0));
    }
    assert.equal(validateFinaleRotationCatchSprintApproachFromTour(
      tour,input,approach),true);
    assert.throws(()=>validateFinaleRotationCatchSprintApproachFromTour(
      tour,input,{...approach,bunchElapsedSecondsAt300M:0}),
    /does not replay/);
    const ordered=recordFinaleRotationCatchOrderedApproachFromTour(
      tour,input);
    assert.equal(ordered.sourceRoadTraceVersion,record.version);
    assert.equal(ordered.frames.length,2);
    assert.deepEqual(ordered.frames.map(frame=>
      frame.supersededRotationTeamIds),[['b'],['b']]);
    assert.ok(ordered.frames.every(frame=>
      frame.rotation.selected===null&&
      frame.riderEnergy.filter(row=>row.role==='lead_out').length===3));
    assert.equal(validateFinaleRotationCatchOrderedApproachFromTour(tour,
      input,ordered),true);
    const freeRotationInput={...input,plans:input.plans.map(row=>
      row.teamId==='b'?{...row,leadOutRiderId:null}:row)};
    const rotating=recordFinaleRotationCatchOrderedApproachFromTour(
      tour,freeRotationInput);
    assert.deepEqual(rotating.frames.map(frame=>
      frame.rotation.selected?.teamId),['b','b']);
    assert.ok(rotating.frames.every(frame=>
      frame.riderEnergy.filter(row=>row.role==='front_rotation')
        .length===2&&
      frame.riderEnergy.filter(row=>row.role==='lead_out').length===2));
    assert.ok(rotating.frames[0].bunchElapsedSeconds<=
      ordered.frames[0].bunchElapsedSeconds);
    assert.equal(validateFinaleRotationCatchOrderedApproachFromTour(tour,
      freeRotationInput,rotating),true);
    assert.throws(()=>validateFinaleRotationCatchOrderedApproachFromTour(
      tour,freeRotationInput,{...rotating,frames:rotating.frames.map(frame=>
        ({...frame,bunchElapsedSeconds:0}))}),/does not replay/);
    const launch=recordFinaleRotationCatchSprintLaunchFromTour(
      tour,input);
    assert.equal(launch.sourceApproachVersion,approach.version);
    assert.equal(launch.sprintPlanVersion,plan.version);
    assert.equal(launch.startDistanceM,19700);
    assert.equal(launch.endDistanceM,19800);
    assert.equal(launch.riderEnergy.length,24);
    assert.equal(launch.sourceBunchElapsedSecondsAt300M,
      approach.bunchElapsedSecondsAt300M);
    assert.equal(launch.bunchElapsedSecondsAt200M,
      approach.bunchElapsedSecondsAt300M+
        launch.bunchTravelSeconds);
    assert.equal(launch.riderEnergy.filter(row=>
      row.role==='sprint').length,3);
    assert.ok(launch.riderEnergy.every(row=>row.energySpent>0&&
      row.energyAfter>=0&&row.gainSeconds>=0));
    assert.equal(validateFinaleRotationCatchSprintLaunchFromTour(
      tour,input,launch),true);
    assert.throws(()=>validateFinaleRotationCatchSprintLaunchFromTour(
      tour,input,{...launch,bunchElapsedSecondsAt200M:0}),
    /does not replay/);
    const run=recordFinaleRotationCatchSprintRunFromTour(tour,input);
    assert.equal(run.sourceLaunchVersion,launch.version);
    assert.equal(run.sprintPlanVersion,plan.version);
    assert.equal(run.startDistanceM,19700);
    assert.equal(run.endDistanceM,20000);
    assert.equal(run.frames.length,2);
    assert.deepEqual(run.launch,launch);
    assert.equal(run.lineRiderEnergy.length,24);
    assert.equal(run.sourceBunchElapsedSecondsAt200M,
      launch.bunchElapsedSecondsAt200M);
    assert.equal(run.bunchElapsedSecondsAtLine,
      launch.bunchElapsedSecondsAt200M+
        run.frames[0].bunchTravelSeconds+
        run.frames[1].bunchTravelSeconds);
    for(const frame of run.frames){
      assert.equal(frame.riderEnergy.length,24);
      assert.ok(frame.riderEnergy.every(row=>row.energySpent>0&&
        row.energyAfter>=0&&row.gainSeconds>=0));
    }
    assert.equal(validateFinaleRotationCatchSprintRunFromTour(
      tour,input,run),true);
    assert.throws(()=>validateFinaleRotationCatchSprintRunFromTour(
      tour,input,{...run,bunchElapsedSecondsAtLine:0}),
    /does not replay/);
    const bounds=probeFinaleRotationCatchFinishBoundsFromTour(
      tour,input);
    assert.equal(bounds.sourceRunVersion,run.version);
    assert.equal(bounds.lineDistanceM,20000);
    assert.equal(bounds.roadBands.length,1);
    assert.equal(bounds.roadBands[0].riderIds.length,24);
    assert.equal(bounds.riders.length,24);
    assert.ok(bounds.riders.every(row=>row.firstPossiblePlace===1&&
      row.lastPossiblePlace===24));
    const gainers=bounds.riders.filter(row=>
      row.movementGainSeconds>0);
    assert.deepEqual(gainers.map(row=>row.riderId),['c-0']);
    assert.equal(oldResults[0].riderId,'c-5');
    assert.equal(bounds.riders.find(row=>row.riderId==='c-5')
      .movementGainSeconds,0);
    assert.equal(validateFinaleRotationCatchFinishBoundsFromTour(tour,
      input,bounds),true);
    assert.throws(()=>validateFinaleRotationCatchFinishBoundsFromTour(tour,
      input,{...bounds,riders:bounds.riders.map(row=>
        row.riderId==='c-0'?{...row,firstPossiblePlace:1,
          lastPossiblePlace:1}:row)}),/do not replay/);
    assert.deepEqual(tour.provisionalResults,oldResults);
  }
});
