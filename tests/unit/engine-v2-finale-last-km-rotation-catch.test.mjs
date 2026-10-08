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
  validateFinaleRotationCatchSprintLaunchFromTour,
  recordFinaleRotationCatchOrderedLaunchFromTour,
  validateFinaleRotationCatchOrderedLaunchFromTour} from
  '../../lib/engine/v2/finale-sprint-launch.mjs';
import {recordFinaleRotationCatchSprintRunFromTour,
  validateFinaleRotationCatchSprintRunFromTour,
  recordFinaleRotationCatchOrderedRunFromTour,
  validateFinaleRotationCatchOrderedRunFromTour} from
  '../../lib/engine/v2/finale-sprint-run.mjs';
import {recordFinaleRotationCatchOrderedSprintFromTour,
  validateFinaleRotationCatchOrderedSprintFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-ordered-sprint.mjs';
import {probeFinaleRotationCatchFinishBoundsFromTour,
  validateFinaleRotationCatchFinishBoundsFromTour,
  probeFinaleRotationCatchOrderedBoundsFromTour,
  validateFinaleRotationCatchOrderedBoundsFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-finish-bounds.mjs';
import {recordFinaleRotationBranchFromTour,
  validateFinaleRotationBranchFromTour} from
  '../../lib/engine/v2/finale-rotation-branch-recording.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:20,profile_points:[[0,100],[20,100]],
  keypoints:[{km:19,kind:'SPRINT'}]};
function team(id,skill,{gender,attack=false,rotate=false,chase='ignore',
  effort='steady',attackAtKm=19}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`,`${id}-3`],
    preset:'balanced',baseline:{effort,chase,
      attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:attackAtKm,attack:'selective',
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
    const orderedLaunch=recordFinaleRotationCatchOrderedLaunchFromTour(
      tour,input);
    const rotatingLaunch=recordFinaleRotationCatchOrderedLaunchFromTour(
      tour,freeRotationInput);
    assert.equal(orderedLaunch.sourceApproachVersion,ordered.version);
    assert.equal(rotatingLaunch.sourceApproachVersion,rotating.version);
    assert.equal(orderedLaunch.sourceBunchElapsedSecondsAt300M,
      ordered.bunchElapsedSecondsAt300M);
    assert.equal(rotatingLaunch.sourceBunchElapsedSecondsAt300M,
      rotating.bunchElapsedSecondsAt300M);
    assert.equal(orderedLaunch.endDistanceM,19800);
    assert.equal(rotatingLaunch.riderEnergy.length,24);
    assert.notDeepEqual(orderedLaunch.riderEnergy,
      rotatingLaunch.riderEnergy);
    assert.equal(validateFinaleRotationCatchOrderedLaunchFromTour(tour,
      input,orderedLaunch),true);
    assert.equal(validateFinaleRotationCatchOrderedLaunchFromTour(tour,
      freeRotationInput,rotatingLaunch),true);
    assert.throws(()=>validateFinaleRotationCatchOrderedLaunchFromTour(
      tour,input,{...orderedLaunch,bunchElapsedSecondsAt200M:0}),
    /does not replay/);
    const orderedRun=recordFinaleRotationCatchOrderedRunFromTour(
      tour,input);
    const rotatingRun=recordFinaleRotationCatchOrderedRunFromTour(
      tour,freeRotationInput);
    assert.deepEqual(orderedRun.launch,orderedLaunch);
    assert.deepEqual(rotatingRun.launch,rotatingLaunch);
    assert.equal(orderedRun.sourceLaunchVersion,orderedLaunch.version);
    assert.equal(rotatingRun.sourceLaunchVersion,rotatingLaunch.version);
    assert.equal(orderedRun.endDistanceM,20000);
    assert.equal(orderedRun.frames.length,2);
    assert.equal(orderedRun.lineRiderEnergy.length,24);
    assert.equal(rotatingRun.lineRiderEnergy.length,24);
    assert.notDeepEqual(orderedRun.lineRiderEnergy,
      rotatingRun.lineRiderEnergy);
    assert.equal(orderedRun.bunchElapsedSecondsAtLine,
      orderedLaunch.bunchElapsedSecondsAt200M+
      orderedRun.frames[0].bunchTravelSeconds+
      orderedRun.frames[1].bunchTravelSeconds);
    assert.equal(validateFinaleRotationCatchOrderedRunFromTour(tour,
      input,orderedRun),true);
    assert.equal(validateFinaleRotationCatchOrderedRunFromTour(tour,
      freeRotationInput,rotatingRun),true);
    assert.throws(()=>validateFinaleRotationCatchOrderedRunFromTour(tour,
      input,{...orderedRun,bunchElapsedSecondsAtLine:0}),
    /does not replay/);
    const paidSprint=recordFinaleRotationCatchOrderedSprintFromTour(
      tour,freeRotationInput);
    const leadOutSprint=recordFinaleRotationCatchOrderedSprintFromTour(
      tour,input);
    assert.equal(paidSprint.sourceApproachVersion,rotating.version);
    assert.equal(paidSprint.frames.length,3);
    assert.equal(paidSprint.lineRiderEnergy.length,24);
    assert.deepEqual(paidSprint.frames.map(frame=>
      frame.rotation.selected?.teamId),['b','b','b']);
    assert.ok(paidSprint.frames.every(frame=>
      frame.riderEnergy.filter(row=>row.role==='front_rotation')
        .length===2));
    assert.deepEqual(leadOutSprint.frames.map(frame=>
      frame.supersededRotationTeamIds),[['b'],['b'],['b']]);
    assert.ok(leadOutSprint.frames.every(frame=>
      frame.rotation.selected===null));
    assert.notDeepEqual(paidSprint.lineRiderEnergy,
      leadOutSprint.lineRiderEnergy);
    assert.equal(paidSprint.bunchElapsedSecondsAtLine,
      rotating.bunchElapsedSecondsAt300M+
      paidSprint.frames.reduce((sum,frame)=>
        sum+frame.bunchTravelSeconds,0));
    assert.equal(validateFinaleRotationCatchOrderedSprintFromTour(tour,
      freeRotationInput,paidSprint),true);
    assert.equal(validateFinaleRotationCatchOrderedSprintFromTour(tour,
      input,leadOutSprint),true);
    assert.throws(()=>validateFinaleRotationCatchOrderedSprintFromTour(
      tour,freeRotationInput,{...paidSprint,bunchElapsedSecondsAtLine:0}),
    /does not replay/);
    const helperFinisherInput={...freeRotationInput,
      plans:freeRotationInput.plans.map(row=>row.teamId==='b'?
        {...row,finisherId:'b-2'}:row)};
    const helperFinisher=recordFinaleRotationCatchOrderedSprintFromTour(
      tour,helperFinisherInput);
    assert.deepEqual(helperFinisher.frames.map(frame=>
      frame.supersededRotationTeamIds),[['b'],['b'],['b']]);
    assert.ok(helperFinisher.frames.every(frame=>
      frame.riderEnergy.find(row=>row.riderId==='b-2').role==='sprint'&&
      frame.rotation.selected===null));
    assert.equal(validateFinaleRotationCatchOrderedSprintFromTour(tour,
      helperFinisherInput,helperFinisher),true);
    const paidBounds=probeFinaleRotationCatchOrderedBoundsFromTour(tour,
      freeRotationInput);
    const leadOutBounds=probeFinaleRotationCatchOrderedBoundsFromTour(tour,
      input);
    assert.equal(paidBounds.sourceRunVersion,paidSprint.version);
    assert.equal(paidBounds.elapsedSecondsFromLastKmStart,
      paidSprint.bunchElapsedSecondsAtLine);
    assert.equal(paidBounds.riders.length,24);
    assert.ok(paidBounds.riders.every(row=>
      row.firstPossiblePlace===1&&row.lastPossiblePlace===24));
    assert.ok(leadOutBounds.riders.every(row=>
      row.firstPossiblePlace===1&&row.lastPossiblePlace===24));
    assert.notDeepEqual(paidBounds.riders.map(row=>row.energyAfter),
      leadOutBounds.riders.map(row=>row.energyAfter));
    assert.equal(validateFinaleRotationCatchOrderedBoundsFromTour(tour,
      freeRotationInput,paidBounds),true);
    assert.throws(()=>validateFinaleRotationCatchOrderedBoundsFromTour(
      tour,freeRotationInput,{...paidBounds,riders:paidBounds.riders.map(
        row=>row.riderId==='b-0'?{...row,lastPossiblePlace:1}:row)}),
    /do not replay/);
    const bundleInput={...freeRotationInput,branch:'caught'};
    const bundle=recordFinaleRotationBranchFromTour(tour,bundleInput);
    assert.equal(bundle.sourceMotorVersion,tour.tuningVersion);
    assert.equal(bundle.branch,'caught');
    assert.equal(bundle.resultStatus,'unclassified');
    assert.deepEqual(bundle.road,record);
    assert.deepEqual(bundle.approach,rotating);
    assert.deepEqual(bundle.sprint,paidSprint);
    assert.deepEqual(bundle.bounds,paidBounds);
    assert.equal(validateFinaleRotationBranchFromTour(tour,
      bundleInput,bundle),true);
    assert.throws(()=>validateFinaleRotationBranchFromTour(tour,
      bundleInput,{...bundle,branch:'contained'}),/does not replay/);
    assert.throws(()=>validateFinaleRotationBranchFromTour(tour,
      bundleInput,{...bundle,bounds:{...bundle.bounds,
        elapsedSecondsFromLastKmStart:0}}),/does not replay/);
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

test('ordered sprint replays on compatible flat and rolling sources and rejects other road states',()=>{
  const plans=['a','b','c'].map(teamId=>({teamId,
    finisherId:`${teamId}-0`,
    leadOutRiderId:teamId==='b'?null:`${teamId}-2`}));
  for(const gender of ['M','F']){
    for(const [profile,points] of [
      ['flat',[[0,100],[20,100]]],
      ['rolling',[[0,100],[10,180],[20,100]]]]){
      for(const bSkill of [65,75]){
        const tour=simulateTacticalTour({stage:{...stage,
          profile_points:points},teams:[
          team('a',50,{gender,attack:true}),
          team('b',bSkill,{gender,rotate:true}),
          team('c',80,{gender,chase:'all'})],
        seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
        const input={attackTeamId:'a',plans};
        const run=recordFinaleRotationCatchOrderedSprintFromTour(tour,input);
        assert.deepEqual(run.frames.map(frame=>
          frame.rotation.selected?.teamId),['b','b','b'],
        `${gender} ${profile} ${bSkill}`);
        assert.ok(run.frames.every(frame=>frame.riderEnergy.length===24));
        assert.equal(validateFinaleRotationCatchOrderedSprintFromTour(tour,
          input,run),true);
        const bounds=probeFinaleRotationCatchOrderedBoundsFromTour(tour,input);
        assert.ok(bounds.riders.every(row=>
          row.firstPossiblePlace===1&&row.lastPossiblePlace===24));
      }
    }
    for(const [points,bSkill,error] of [
      [[[0,100],[15,100],[20,260]],75,/actual road contact/],
      [[[0,100],[20,100]],85,/complete bunch/]]){
      const tour=simulateTacticalTour({stage:{...stage,
        profile_points:points},teams:[
        team('a',50,{gender,attack:true}),
        team('b',bSkill,{gender,rotate:true}),
        team('c',80,{gender,chase:'all'})],
      seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
      assert.throws(()=>recordFinaleRotationCatchOrderedSprintFromTour(
        tour,{attackTeamId:'a',plans}),error);
    }
  }
});

test('longer source fatigue and stronger front effort remain paid or leave the catch branch',()=>{
  const plans=['a','b','c'].map(teamId=>({teamId,
    finisherId:`${teamId}-0`,
    leadOutRiderId:teamId==='b'?null:`${teamId}-2`}));
  for(const gender of ['M','F']){
    for(const effort of ['conserve','steady']){
      const helperEnergy=[];
      for(const distanceKm of [20,40,180,300]){
        const sourceStage={distance_km:distanceKm,
          profile_points:[[0,100],[distanceKm,100]],
          keypoints:[{km:distanceKm-1,kind:'SPRINT'}]};
        const tour=simulateTacticalTour({stage:sourceStage,teams:[
          team('a',50,{gender,attack:true,attackAtKm:distanceKm-1}),
          team('b',75,{gender,rotate:true,effort}),
          team('c',80,{gender,chase:'all'})],
        seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
        const input={attackTeamId:'a',plans};
        const run=recordFinaleRotationCatchOrderedSprintFromTour(tour,input);
        assert.deepEqual(run.frames.map(frame=>
          frame.rotation.selected?.teamId),['b','b','b']);
        assert.ok(run.frames.every(frame=>
          frame.riderEnergy.filter(row=>row.role==='front_rotation')
            .length===2));
        helperEnergy.push(run.lineRiderEnergy.find(row=>
          row.riderId==='b-2').energyAfter);
        assert.equal(validateFinaleRotationCatchOrderedSprintFromTour(tour,
          input,run),true);
      }
      assert.ok(helperEnergy.every((energy,index)=>
        index===0||energy<helperEnergy[index-1]));
    }
    const distanceKm=300;
    const sourceStage={distance_km:distanceKm,
      profile_points:[[0,100],[distanceKm,100]],
      keypoints:[{km:distanceKm-1,kind:'SPRINT'}]};
    const hardTour=simulateTacticalTour({stage:sourceStage,teams:[
      team('a',50,{gender,attack:true,attackAtKm:distanceKm-1}),
      team('b',75,{gender,rotate:true,effort:'hard'}),
      team('c',80,{gender,chase:'all'})],
    seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    assert.throws(()=>recordFinaleRotationCatchOrderedSprintFromTour(
      hardTour,{attackTeamId:'a',plans}),/complete bunch/);
  }
});
