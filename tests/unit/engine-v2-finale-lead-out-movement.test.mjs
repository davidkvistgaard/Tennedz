import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {recordFinaleRotationCatchOrderedSprintFromTour,
  recordFinaleRotationCatchLeadOutSprintFromTour,
  recordFinaleRotationContainedLeadOutSprintFromTour,
  validateFinaleRotationCatchLeadOutSprintFromTour,
  validateFinaleRotationContainedLeadOutSprintFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-ordered-sprint.mjs';
import {recordFinaleRotationCatchLeadOutApproachFromTour,
  validateFinaleRotationCatchLeadOutApproachFromTour,
  recordFinaleRotationContainedLeadOutApproachFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleRotationLeadOutCandidateFromTour,
  validateFinaleRotationLeadOutCandidateFromTour} from
  '../../lib/engine/v2/finale-rotation-lead-out-candidate.mjs';
import {recordPositionedFinaleLineFromTour,
  validatePositionedFinaleLineFromTour} from
  '../../lib/engine/v2/finale-positioned-line.mjs';
import {resolveLeadOutLongitudinal,
  recordLeadOutLongitudinalFromTour,
  validateLeadOutLongitudinalFromTour,
  recordLeadOutConditionalLineFromTour,
  validateLeadOutConditionalLineFromTour} from
  '../../lib/engine/v2/finale-lead-out-longitudinal.mjs';

const stage={distance_km:20,profile_points:[[0,100],[20,100]],
  keypoints:[{km:19,kind:'SPRINT'}]};
function team(id,skill,{gender,attack=false,rotate=false,chase='ignore',
  attackAtKm=19}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender,flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:id==='a'?90:70,
    sprint:70,leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`,`${id}-3`],
    preset:'balanced',baseline:{effort:'steady',chase,
      attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:attackAtKm,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

const plans=helper=>['a','b','c'].map(teamId=>({teamId,
  finisherId:`${teamId}-0`,
  leadOutRiderId:teamId==='c'&&helper?'c-2':null}));
const input=helper=>({attackTeamId:'a',plans:plans(helper)});
const catchTour=gender=>simulateTacticalTour({stage,teams:[
  team('a',50,{gender,attack:true}),
  team('b',75,{gender,rotate:true}),
  team('c',80,{gender,chase:'all'})],
seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});

test('a paid, available helper can carry their finisher into the sprint',()=>{
  for(const gender of ['M','F']){
    const tour=catchTour(gender);
    const without=recordFinaleRotationCatchLeadOutSprintFromTour(tour,
      input(false));
    const withHelper=recordFinaleRotationCatchLeadOutSprintFromTour(tour,
      input(true));
    const approach=recordFinaleRotationCatchLeadOutApproachFromTour(tour,
      input(true));
    const gain=approach.finisherGainsAt300M.find(row=>
      row.riderId==='c-0').gainSeconds;
    assert.ok(gain>0,`${gender}: paid pull should exceed bunch pace`);
    assert.equal(approach.frames.length,2);
    assert.ok(approach.frames.every(frame=>frame.leadOutMovement.length===1&&
      frame.riderEnergy.find(row=>row.riderId==='c-2').role==='lead_out'));
    assert.ok(approach.frames.every(frame=>frame.riderEnergy.find(row=>
      row.riderId==='c-2').energySpent>0));
    assert.ok(withHelper.lineRiderEnergy.find(row=>
      row.riderId==='c-0').gainSeconds>
      without.lineRiderEnergy.find(row=>
        row.riderId==='c-0').gainSeconds);
    assert.equal(without.finisherGainsAt300M.find(row=>
      row.riderId==='c-0').gainSeconds,0);
    assert.equal(validateFinaleRotationCatchLeadOutApproachFromTour(
      tour,input(true),approach),true);
    assert.equal(validateFinaleRotationCatchLeadOutSprintFromTour(
      tour,input(true),withHelper),true);
    const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,
      input(true));
    assert.equal(candidate.branch,'caught');
    assert.equal(candidate.leadOutTiming,'late');
    assert.equal(candidate.leadOutStartDistanceM,19500);
    assert.deepEqual(candidate.sprint,withHelper);
    assert.equal(candidate.leadOutEffects.length,1);
    assert.equal(candidate.leadOutEffects[0].helperId,'c-2');
    assert.ok(candidate.leadOutEffects[0].helperEnergySpent>0);
    assert.equal(candidate.leadOutEffects[0].gainSecondsAt300M,gain);
    assert.equal(candidate.resultStatus,'unclassified');
    assert.equal(candidate.canCommitAwards,false);
    assert.equal(validateFinaleRotationLeadOutCandidateFromTour(tour,{
      ...input(true),branch:'caught'},candidate),true);
    assert.throws(()=>recordFinaleRotationLeadOutCandidateFromTour(tour,{
      ...input(true),branch:'contained'}),/differs from the road/);
    assert.throws(()=>recordFinaleRotationLeadOutCandidateFromTour(tour,{
      ...input(true),leadOutTiming:'early'}),/late 500 m/);
    assert.throws(()=>validateFinaleRotationLeadOutCandidateFromTour(tour,{
      ...input(true),branch:'caught'},
      {...candidate,leadOutEffects:[]}),/does not replay/);
    assert.throws(()=>validateFinaleRotationCatchLeadOutSprintFromTour(
      tour,input(true),{...withHelper,
        finisherGainsAt300M:[{riderId:'c-0',gainSeconds:99}]}),
    /does not replay/);
    const old=recordFinaleRotationCatchOrderedSprintFromTour(tour,input(true));
    assert.equal(old.finisherGainsAt300M,undefined);
  }
});

test('contained whole-bunch path carries the same paid lead-out rule',()=>{
  for(const gender of ['M','F']){
    const attacker=team('a',56,{gender,attack:true,attackAtKm:39});
    attacker.orders.baseline.effort='conserve';
    const tour=simulateTacticalTour({stage:{distance_km:40,
      profile_points:[[0,100],[40,100]],
      keypoints:[{km:39,kind:'SPRINT'}]},teams:[
      attacker,
      team('b',95,{gender,rotate:true}),
      team('c',95,{gender,chase:'all'}),
      team('d',80,{gender,rotate:true})],
    seed:`contained-rotation-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const plans=['a','b','c','d'].map(teamId=>({teamId,
      finisherId:`${teamId}-0`,
      leadOutRiderId:teamId==='c'?'c-2':null}));
    const request={attackTeamId:'a',plans};
    const approach=recordFinaleRotationContainedLeadOutApproachFromTour(
      tour,request);
    const sprint=recordFinaleRotationContainedLeadOutSprintFromTour(
      tour,request);
    assert.ok(approach.frames.every(frame=>
      frame.riderEnergy.find(row=>row.riderId==='c-2').role==='lead_out'));
    assert.equal(sprint.finisherGainsAt300M.find(row=>
      row.riderId==='c-0').gainSeconds,
    approach.finisherGainsAt300M.find(row=>
      row.riderId==='c-0').gainSeconds);
    assert.equal(validateFinaleRotationContainedLeadOutSprintFromTour(
      tour,request,sprint),true);
    const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,
      request);
    assert.equal(candidate.branch,'contained');
    assert.deepEqual(candidate.sprint,sprint);
    assert.equal(candidate.pointsStatus,'withheld');
  }
});

test('a weaker paid helper gives no free pull advantage',()=>{
  for(const gender of ['M','F']){
    const weak=team('c',80,{gender,chase:'all'});
    const helper=weak.riders.find(row=>row.id==='c-2');
    for(const skill of ['flat','strength','timetrial','acceleration',
      'sprint'])helper[skill]=60;
    const tour=simulateTacticalTour({stage,teams:[
      team('a',50,{gender,attack:true}),
      team('b',75,{gender,rotate:true}),weak],
    seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const approach=recordFinaleRotationCatchLeadOutApproachFromTour(
      tour,input(true));
    assert.ok(approach.frames.every(frame=>frame.riderEnergy.find(row=>
      row.riderId==='c-2').energySpent>0));
    assert.equal(approach.finisherGainsAt300M.find(row=>
      row.riderId==='c-0').gainSeconds,0);
    const weakLine=recordLeadOutConditionalLineFromTour(tour,input(true));
    const noHelperLine=recordLeadOutConditionalLineFromTour(tour,input(false));
    assert.equal(weakLine.longitudinal.positionsAt100M.find(row=>
      row.riderId==='c-0').distanceToLineM,
    noHelperLine.longitudinal.positionsAt100M.find(row=>
      row.riderId==='c-0').distanceToLineM);
    assert.equal(weakLine.line.finishers.find(row=>row.riderId==='c-0')
      .elapsedSecondsFromLastKmStart,
    noHelperLine.line.finishers.find(row=>row.riderId==='c-0')
      .elapsedSecondsFromLastKmStart);
  }
});

test('changing the nominated finisher changes the paid finale on one source',()=>{
  for(const gender of ['M','F']){
    const c=team('c',80,{gender,chase:'all'});
    c.riders.find(row=>row.id==='c-1').sprint=96;
    const tour=simulateTacticalTour({stage,teams:[
      team('a',50,{gender,attack:true}),
      team('b',75,{gender,rotate:true}),c],
    seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const first=recordFinaleRotationLeadOutCandidateFromTour(tour,
      input(true));
    const changed={...input(true),plans:input(true).plans.map(row=>
      row.teamId==='c'?{...row,finisherId:'c-1'}:row)};
    const second=recordFinaleRotationLeadOutCandidateFromTour(tour,changed);
    assert.deepEqual(first.road,second.road);
    assert.equal(first.leadOutEffects[0].helperId,
      second.leadOutEffects[0].helperId);
    assert.notEqual(first.leadOutEffects[0].gainSecondsAtLine,
      second.leadOutEffects[0].gainSecondsAtLine);
    assert.equal(second.leadOutEffects[0].finisherId,'c-1');
  }
});

test('longer races carry actual source fatigue into the paid pull',()=>{
  for(const gender of ['M','F']){
    const remaining=[];
    for(const distanceKm of [20,40,180,300]){
      const race={distance_km:distanceKm,
        profile_points:[[0,100],[distanceKm,100]],
        keypoints:[{km:distanceKm-1,kind:'SPRINT'}]};
      const tour=simulateTacticalTour({stage:race,teams:[
        team('a',50,{gender,attack:true,
          attackAtKm:distanceKm-1}),
        team('b',75,{gender,rotate:true}),
        team('c',80,{gender,chase:'all'})],
      seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
      const approach=recordFinaleRotationCatchLeadOutApproachFromTour(
        tour,input(true));
      const sprint=recordFinaleRotationCatchLeadOutSprintFromTour(
        tour,input(true));
      remaining.push(approach.energyAt300M.find(row=>
        row.riderId==='c-2').energy);
      assert.equal(sprint.lineRiderEnergy.length,24);
      const conditional=recordLeadOutConditionalLineFromTour(tour,
        input(true));
      assert.equal(conditional.line.finishers.length,24);
      assert.equal(conditional.pointsStatus,'withheld');
      assert.ok(approach.frames.every(frame=>
        frame.riderEnergy.find(row=>row.riderId==='c-2')
          .energySpent>0));
    }
    assert.ok(remaining.every((energy,index)=>
      index===0||energy<remaining[index-1]));
  }
});

test('independent lead-out choices account for a 20-manager field',()=>{
  const fieldStage={distance_km:40,
    profile_points:[[0,100],[40,100]],
    keypoints:[{km:10,kind:'SPRINT'},
      {km:20,kind:'SPRINT'},{km:39,kind:'SPRINT'}]};
  const fieldTeam=(index,gender)=>{
    const id=`t${String(index).padStart(2,'0')}`;
    const skill=index===0?57:65+(index*7)%15;
    return {id,riders:Array.from({length:8},(_,riderIndex)=>({
      id:`${id}-${riderIndex}`,gender,flat:skill,strength:skill,
      timetrial:skill,endurance:70,acceleration:index===0?95:70,
      sprint:50+(index*11)%51,leadership:60})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
      helperIds:[`${id}-2`],preset:'balanced',baseline:{
        effort:'conserve',chase:index%3===0?'all':'ignore',
        attack:'none',breakWork:'cooperate'},
      phases:index===0?[{atKm:39,attack:'selective',
        attackRiderId:`${id}-0`}]:[]}};
  };
  for(const gender of ['M','F']){
    const tour=simulateTacticalTour({stage:fieldStage,
      teams:Array.from({length:20},(_,index)=>fieldTeam(index,gender)),
      seed:`twenty-${gender}`,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const request={branch:'caught',attackTeamId:'t00',
      plans:tour.committedInputs.teams.map((row,index)=>({
        teamId:row.id,finisherId:row.orders.captainId,
        leadOutRiderId:index%2===0?`${row.id}-2`:null}))};
    const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,
      request);
    assert.equal(candidate.sprint.lineRiderEnergy.length,160);
    assert.equal(candidate.leadOutEffects.length,10);
    assert.equal(candidate.leadOutEffects.filter(row=>
      row.gainSecondsAt300M>0).length,9);
    assert.ok(candidate.leadOutEffects.every(row=>
      row.helperEnergySpent>0));
    assert.equal(candidate.resultStatus,'unclassified');
    assert.equal(validateFinaleRotationLeadOutCandidateFromTour(tour,
      request,candidate),true);
    const conditional=recordLeadOutConditionalLineFromTour(tour,request);
    assert.equal(conditional.line.finishers.length,160);
    assert.equal(new Set(conditional.line.finishers.map(row=>
      row.riderId)).size,160);
    assert.equal(conditional.longitudinal.frames.length,4);
    assert.equal(conditional.canCommitAwards,false);
  }
});

test('measured final-100 m positions yield individually paid crossings',()=>{
  for(const gender of ['M','F']){
    const tour=catchTour(gender);
    const request=input(true);
    const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,
      request);
    const positions=candidate.sprint.frames[1].pelotonRiderIds
      .map((riderId,index)=>({riderId,
        distanceToLineM:riderId==='a-0'?100:70+index*.1}));
    const line=recordPositionedFinaleLineFromTour(tour,request,positions);
    assert.equal(line.finishers.length,24);
    assert.equal(new Set(line.finishers.map(row=>row.riderId)).size,24);
    assert.equal(line.resultStatus,'conditional_order');
    assert.equal(line.positionSourceStatus,'external_unverified');
    assert.equal(line.pointsStatus,'withheld');
    assert.ok(line.finishers.every((row,index)=>
      row.position===index+1&&row.energySpentToLine>0&&
      row.energyAtLine>=0&&row.distanceToLineM>0));
    const first=positions.find(row=>row.riderId==='a-1');
    const firstFinish=line.finishers.find(row=>row.riderId==='a-1');
    const proposed=candidate.sprint.frames[2].riderEnergy.find(row=>
      row.riderId==='a-1');
    assert.ok(Math.abs(firstFinish.energySpentToLine-
      proposed.energySpent*first.distanceToLineM/100)<1e-9);
    assert.equal(line.finishers.find(row=>row.riderId==='a-0')
      .energyAtLine,candidate.sprint.lineRiderEnergy.find(row=>
      row.riderId==='a-0').energyAfter);
    assert.equal(validatePositionedFinaleLineFromTour(tour,request,
      positions,line),true);
    assert.throws(()=>validatePositionedFinaleLineFromTour(tour,request,
      positions,{...line,pointsStatus:'awarded'}),/does not replay/);
    assert.throws(()=>recordPositionedFinaleLineFromTour(tour,request,
      positions.slice(1)),/every rider/);
    assert.throws(()=>recordPositionedFinaleLineFromTour(tour,request,
      positions.map(row=>row.riderId==='a-1'?{
        ...row,distanceToLineM:101}:row)),/every rider/);
  }
});

test('position changes can reverse a provisional finish without fake points',()=>{
  const tour=catchTour('M');
  const request=input(true);
  const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,
    request);
  const positions=candidate.sprint.frames[1].pelotonRiderIds
    .map((riderId,index)=>({riderId,distanceToLineM:70+index*.1}));
  const near=recordPositionedFinaleLineFromTour(tour,request,
    positions.map(row=>row.riderId==='c-0'?{
      ...row,distanceToLineM:50}:row));
  const far=recordPositionedFinaleLineFromTour(tour,request,
    positions.map(row=>row.riderId==='c-0'?{
      ...row,distanceToLineM:90}:row));
  assert.equal(near.finishers[0].riderId,'c-0');
  assert.ok(far.finishers.find(row=>row.riderId==='c-0').position>1);
  assert.equal(near.canCommitAwards,false);
  assert.equal(far.canCommitAwards,false);
  const tied=recordPositionedFinaleLineFromTour(tour,request,
    positions.map(row=>row.riderId==='a-2'?{
      ...row,distanceToLineM:positions.find(other=>
        other.riderId==='a-1').distanceToLineM}:row));
  assert.equal(tied.resultStatus,'photo_finish_unresolved');
  assert.equal(tied.finishers.find(row=>row.riderId==='a-1').position,null);
  assert.equal(tied.finishers.find(row=>row.riderId==='a-2').position,null);
});

test('paid lead-out and sprint speeds produce a replayable 100 m handoff',()=>{
  for(const gender of ['M','F']){
    const tour=catchTour(gender);
    const withHelper=recordLeadOutLongitudinalFromTour(tour,input(true));
    const without=recordLeadOutLongitudinalFromTour(tour,input(false));
    assert.equal(withHelper.version,
      'v2-finale-lead-out-longitudinal-candidate-1');
    assert.equal(withHelper.positionSourceStatus,
      'collapsed_road_band_candidate');
    assert.equal(withHelper.frames.length,4);
    assert.ok(withHelper.frames.every(frame=>frame.riders.length===24));
    assert.equal(withHelper.positionsAt100M.length,24);
    assert.ok(withHelper.positionsAt100M.every(row=>
      row.distanceToLineM>0&&row.distanceToLineM<=100));
    assert.ok(withHelper.positionsAt100M.find(row=>
      row.riderId==='c-0').distanceToLineM<
      without.positionsAt100M.find(row=>
        row.riderId==='c-0').distanceToLineM);
    const first=withHelper.frames[0];
    assert.ok(first.riders.find(row=>row.riderId==='c-2')
      .paidDistanceM>100);
    assert.equal(first.riders.find(row=>row.riderId==='c-2')
      .positionM,first.riders.find(row=>row.riderId==='c-0')
      .positionM);
    assert.equal(validateLeadOutLongitudinalFromTour(tour,
      input(true),withHelper),true);
    assert.throws(()=>validateLeadOutLongitudinalFromTour(tour,
      input(true),{...withHelper,positionsAt100M:[]}),
    /does not replay/);
    const line=recordPositionedFinaleLineFromTour(tour,input(true),
      withHelper.positionsAt100M);
    assert.equal(line.finishers.length,24);
    assert.equal(line.pointsStatus,'withheld');
    assert.equal(withHelper.canCommitAwards,false);
    const coupled=recordLeadOutConditionalLineFromTour(tour,input(true));
    const control=recordLeadOutConditionalLineFromTour(tour,input(false));
    assert.deepEqual(coupled.longitudinal,withHelper);
    assert.deepEqual(coupled.line,line);
    assert.equal(coupled.resultStatus,'provisional_conditional');
    assert.equal(coupled.canCommitAwards,false);
    assert.ok(coupled.line.finishers.find(row=>row.riderId==='c-0')
      .elapsedSecondsFromLastKmStart<
      control.line.finishers.find(row=>row.riderId==='c-0')
        .elapsedSecondsFromLastKmStart);
    assert.equal(validateLeadOutConditionalLineFromTour(tour,
      input(true),coupled),true);
    assert.throws(()=>validateLeadOutConditionalLineFromTour(tour,
      input(true),{...coupled,pointsStatus:'awarded'}),
    /does not replay/);
  }
});

test('the conditional first crossing responds to a chosen helper',()=>{
  for(const gender of ['M','F']){
    const b=team('b',75,{gender,rotate:true});
    b.riders[0].sprint=80;
    const tour=simulateTacticalTour({stage,teams:[
      team('a',50,{gender,attack:true}),b,
      team('c',80,{gender,chase:'all'})],
    seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const without=recordLeadOutConditionalLineFromTour(tour,
      input(false));
    const withHelper=recordLeadOutConditionalLineFromTour(tour,
      input(true));
    assert.equal(without.line.finishers[0].riderId,'b-0');
    assert.equal(without.line.finishers[0].position,1);
    assert.equal(withHelper.line.finishers[0].riderId,'c-0');
    assert.equal(withHelper.line.finishers[0].position,1);
    assert.equal(withHelper.pointsStatus,'withheld');
    assert.equal(withHelper.canCommitAwards,false);
  }
});

test('a forged unpaid helper cannot create a longitudinal lead',()=>{
  const tour=catchTour('M');
  const candidate=recordFinaleRotationLeadOutCandidateFromTour(tour,
    input(true));
  const frame=candidate.approach.frames[0];
  const unpaid={...candidate,approach:{...candidate.approach,
    frames:[{...frame,riderEnergy:frame.riderEnergy.map(row=>
      row.riderId==='c-2'?{...row,energySpent:0}:row)},
    candidate.approach.frames[1]]}};
  assert.throws(()=>resolveLeadOutLongitudinal(unpaid),
    /paid lead-out pair/);
  const sprintFrame=candidate.sprint.frames[0];
  const unpaidSprint={...candidate,sprint:{...candidate.sprint,
    frames:[{...sprintFrame,riderEnergy:sprintFrame.riderEnergy.map(row=>
      row.riderId==='c-0'?{...row,energySpent:0}:row)},
    ...candidate.sprint.frames.slice(1)]}};
  assert.throws(()=>resolveLeadOutLongitudinal(unpaidSprint),
    /invalid paid movement/);
});
