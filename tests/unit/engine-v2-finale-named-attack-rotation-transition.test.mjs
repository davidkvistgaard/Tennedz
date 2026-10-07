import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleNamedAttackTransition} from
  '../../lib/engine/v2/finale-named-attack-transition.mjs';
import {advanceFinaleNamedAttackRotationTransition,
  validateFinaleNamedAttackRotationTransition} from
  '../../lib/engine/v2/finale-named-attack-rotation-transition.mjs';
import {continueFinaleNamedAttackRotationGroup,
  validateFinaleNamedAttackRotationFollowup,
  continueFinaleNamedAttackRotationCatch,
  validateFinaleNamedAttackRotationCatch} from
  '../../lib/engine/v2/finale-named-attack-rotation-followup.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,TUNING} from
  '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:39,kind:'SPRINT'}]};
function team(id,skill,{attack=false,rotate=false,chase='ignore',
  gender='M',attackAtKm=39}={}){
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

test('rotating pair and reactive chaser pay once against a named attack',()=>{
  for(const gender of ['M','F']){
  const tour=simulateTacticalTour({stage,teams:[
    team('a',65,{attack:true,gender}),
    team('b',88,{rotate:true,gender}),
    team('c',55,{rotate:true,chase:'all',gender}),
    team('d',80,{rotate:true,gender})],
  seed:`attack-with-rotation-${gender}`,
  motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const attackerId='a-0';
  const input={slice:finaleDistanceGrid(tour.route,{remainingKm:1})[0],
    route:tour.route,teams:tour.committedInputs.teams,
    pelotonRiderIds:source.peloton.riderIds,
    energies:new Map(source.riders.map(row=>[row.riderId,row.energy])),
    attackerTeamId:'a',attackerRiderId:attackerId,
    repeatLoad:Math.max(0,source.riderAttackLoads.find(row=>
      row.riderId===attackerId).load-
      TUNING.attack.loadRecoveryPerKm)};
  const old=advanceFinaleNamedAttackTransition(input);
  const rotated=advanceFinaleNamedAttackRotationTransition(input);
  assert.deepEqual(rotated.rotation.eligibleTeamIds,['b','d']);
  assert.equal(rotated.rotation.selected.teamId,'b');
  assert.equal(rotated.chase.teamId,'c');
  assert.equal(rotated.riderEnergy.length,32);
  assert.equal(rotated.riderEnergy.filter(row=>
    row.role==='front_rotation').length,2);
  assert.equal(rotated.riderEnergy.find(row=>
    row.riderId===attackerId).role,'attack');
  assert.equal(rotated.riderEnergy.find(row=>
    row.riderId===rotated.chase.riderId).role,'chase');
  assert.ok(rotated.riderEnergy.every(row=>row.energySpent>0&&
    row.energyAfter>=0));
  assert.ok(rotated.bunchElapsedSeconds<old.bunchElapsedSeconds);
  assert.ok(rotated.attack.earnedGapSeconds<=old.attack.earnedGapSeconds);
  assert.equal(rotated.roadGroups.length,1);
  assert.equal(validateFinaleNamedAttackRotationTransition(input,
    rotated),true);
  assert.throws(()=>validateFinaleNamedAttackRotationTransition(input,{
    ...rotated,riderEnergy:rotated.riderEnergy.map(row=>
      row.role==='front_rotation'?{...row,energySpent:0}:row)}),
  /does not replay/);
  const followup=continueFinaleNamedAttackRotationGroup({
    launchInput:input,launch:rotated,
    slice:finaleDistanceGrid(tour.route,{remainingKm:1})[1]});
  assert.equal(followup.riderEnergy.length,32);
  assert.equal(followup.rotation.selected.teamId,'d');
  assert.equal(followup.chaseRiderId?.startsWith('c-'),true);
  assert.ok(followup.riderEnergy.every(row=>row.energySpent>0&&
    row.energyAfter>=0));
  assert.ok(followup.roadGroups[0].gapSeconds>0);
  assert.equal(validateFinaleNamedAttackRotationFollowup({
    launchInput:input,launch:rotated,
    slice:finaleDistanceGrid(tour.route,{remainingKm:1})[1]},followup),true);
  assert.throws(()=>validateFinaleNamedAttackRotationFollowup({
    launchInput:input,launch:rotated,
    slice:finaleDistanceGrid(tour.route,{remainingKm:1})[1]},
  {...followup,riderEnergy:followup.riderEnergy.map(row=>
    row.role==='front_rotation'?{...row,energySpent:0}:row)}),
  /does not replay/);
  }
});

test('a rotating mid-slice catch pays a merged remainder in opt-in v2',()=>{
  const shortStage={distance_km:20,
    profile_points:[[0,100],[20,100]],
    keypoints:[{km:19,kind:'SPRINT'}]};
  const tour=simulateTacticalTour({stage:shortStage,teams:[
    team('a',50,{attack:true,attackAtKm:19}),
    team('b',75,{rotate:true}),
    team('c',80,{chase:'all'})],
  seed:'catch-50-75-80',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  const grid=finaleDistanceGrid(tour.route,{remainingKm:1});
  const input={slice:grid[0],route:tour.route,
    teams:tour.committedInputs.teams,
    pelotonRiderIds:source.peloton.riderIds,
    energies:new Map(source.riders.map(row=>[row.riderId,row.energy])),
    attackerTeamId:'a',attackerRiderId:'a-0',
    repeatLoad:Math.max(0,source.riderAttackLoads.find(row=>
      row.riderId==='a-0').load-TUNING.attack.loadRecoveryPerKm)};
  const launch=advanceFinaleNamedAttackRotationTransition(input);
  assert.ok(launch.roadGroups[0].gapSeconds>0);
  assert.throws(()=>continueFinaleNamedAttackRotationGroup({
    launchInput:input,launch,slice:grid[1]}),
  /needs a merged-work continuation rule/);
  const caught=continueFinaleNamedAttackRotationCatch({
    launchInput:input,launch,slice:grid[1]});
  assert.ok(caught.catchDistanceM>grid[1].startDistanceM&&
    caught.catchDistanceM<grid[1].endDistanceM);
  assert.equal(caught.roadGroups.length,0);
  assert.equal(caught.pelotonRiderIds.length,24);
  assert.equal(caught.riderEnergy.length,24);
  assert.ok(caught.riderEnergy.every(row=>row.energySpent===
    row.energyAtDecision-row.energyAfter||
    Math.abs(row.energySpent-(row.energyAtDecision-
      row.energyAfter))<1e-9));
  assert.ok(caught.riderEnergy.some(row=>
    row.postCatchRole==='front_rotation'&&
    row.postCatchEnergySpent>0));
  const beforeWork=caught.beforeCatchRotationPlan.selected.work[0];
  const paid=caught.riderEnergy.find(row=>
    row.riderId===beforeWork.riderId);
  assert.ok(paid.energySpent-paid.postCatchEnergySpent<
    beforeWork.energySpent);
  const afterWork=caught.afterCatchRotationPlan.selected.work[0];
  assert.ok(caught.riderEnergy.find(row=>
    row.riderId===afterWork.riderId).postCatchEnergySpent<
      afterWork.energySpent);
  assert.equal(validateFinaleNamedAttackRotationCatch({
    launchInput:input,launch,slice:grid[1]},caught),true);
  assert.throws(()=>validateFinaleNamedAttackRotationCatch({
    launchInput:input,launch,slice:grid[1]},
  {...caught,catchDistanceM:grid[1].endDistanceM}),
  /does not replay/);
});
