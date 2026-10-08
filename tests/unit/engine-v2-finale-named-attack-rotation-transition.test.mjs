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
import {continueFinaleNamedAttackRotationBunch,
  validateFinaleNamedAttackRotationBunch} from
  '../../lib/engine/v2/finale-named-attack-rotation-bunch.mjs';
import {probeLastKmRotationContainedFromTour,
  validateLastKmRotationContainedFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-contained.mjs';
import {probeLastKmRotationSoloFromTour,
  validateLastKmRotationSoloFromTour} from
  '../../lib/engine/v2/finale-last-km-rotation-solo.mjs';
import {recordFinaleRotationSoloSliceFromTour,
  validateFinaleRotationSoloSliceFromTour,
  recordFinaleRotationSoloSecondSliceFromTour,
  validateFinaleRotationSoloSecondSliceFromTour,
  recordFinaleRotationSoloCatchSliceFromTour,
  validateFinaleRotationSoloCatchSliceFromTour,
  recordFinaleRotationSoloRunFromTour,
  validateFinaleRotationSoloRunFromTour,
  recordFinaleRotationSoloLateCatchFromTour,
  validateFinaleRotationSoloLateCatchFromTour} from
  '../../lib/engine/v2/finale-rotation-solo-slice.mjs';
import {recordFinaleRotationContainedSprintPlanFromTour,
  validateFinaleRotationContainedSprintPlanFromTour,
  recordFinaleRotationSoloSprintPlanFromTour,
  validateFinaleRotationSoloSprintPlanFromTour} from
  '../../lib/engine/v2/finale-sprint-plan.mjs';
import {recordFinaleRotationSoloLateCatchSprintFromTour,
  validateFinaleRotationSoloLateCatchSprintFromTour} from
  '../../lib/engine/v2/finale-rotation-solo-late-catch-sprint.mjs';
import {probeFinaleRotationSoloFinishBoundsFromTour,
  validateFinaleRotationSoloFinishBoundsFromTour,
  probeFinaleRotationSoloLateCatchBoundsFromTour,
  validateFinaleRotationSoloLateCatchBoundsFromTour} from
  '../../lib/engine/v2/finale-rotation-solo-finish-bounds.mjs';
import {recordFinaleRotationContainedOrderedApproachFromTour,
  validateFinaleRotationContainedOrderedApproachFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-ordered-approach.mjs';
import {recordFinaleRotationContainedOrderedSprintFromTour,
  validateFinaleRotationContainedOrderedSprintFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-ordered-sprint.mjs';
import {probeFinaleRotationContainedOrderedBoundsFromTour,
  validateFinaleRotationContainedOrderedBoundsFromTour} from
  '../../lib/engine/v2/finale-rotation-catch-finish-bounds.mjs';
import {recordFinaleRotationBranchFromTour,
  validateFinaleRotationBranchFromTour} from
  '../../lib/engine/v2/finale-rotation-branch-recording.mjs';
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
  const oldResults=structuredClone(tour.provisionalResults);
  const solo=probeLastKmRotationSoloFromTour(tour,{teamId:'a'});
  assert.deepEqual(solo.frames,[rotated,followup]);
  assert.equal(solo.sourceKm,39);
  assert.equal(solo.at500M.distanceM,39500);
  assert.equal(solo.at500M.roadGroups.length,1);
  assert.deepEqual(solo.at500M.roadGroups[0].riderIds,['a-0']);
  assert.ok(solo.at500M.roadGroups[0].gapSeconds>0);
  assert.equal(solo.at500M.pelotonRiderIds.length,31);
  assert.equal(solo.at500M.riderEnergy.length,32);
  assert.equal(validateLastKmRotationSoloFromTour(tour,
    {teamId:'a'},solo),true);
  assert.throws(()=>validateLastKmRotationSoloFromTour(tour,
    {teamId:'a'},{...solo,at500M:{...solo.at500M,
      roadGroups:[]}}),/does not replay/);
  const soloStep=recordFinaleRotationSoloSliceFromTour(tour,{
    attackTeamId:'a'});
  assert.equal(soloStep.sourceRoadTraceVersion,solo.version);
  assert.equal(soloStep.startDistanceM,39500);
  assert.equal(soloStep.endDistanceM,39600);
  assert.equal(soloStep.riderEnergy.length,32);
  assert.deepEqual(soloStep.roadGroups[0].riderIds,['a-0']);
  assert.ok(soloStep.roadGroups[0].gapSeconds>0);
  assert.equal(soloStep.rotation.selected?.teamId,'b');
  assert.equal(soloStep.paceSource,'front_rotation');
  assert.ok(soloStep.riderEnergy.every(row=>
    row.energySpent>0&&row.energyAfter>=0));
  assert.equal(validateFinaleRotationSoloSliceFromTour(tour,
    {attackTeamId:'a'},soloStep),true);
  assert.throws(()=>validateFinaleRotationSoloSliceFromTour(tour,
    {attackTeamId:'a'},{...soloStep,bunchTravelSeconds:0}),
  /does not replay/);
  const second=recordFinaleRotationSoloSecondSliceFromTour(tour,{
    attackTeamId:'a'});
  assert.equal(second.sourceSliceVersion,soloStep.version);
  assert.equal(second.startDistanceM,soloStep.endDistanceM);
  assert.equal(second.endDistanceM,39700);
  assert.ok(second.roadGroups[0].gapSeconds>0);
  assert.ok(second.riderEnergy.every(row=>row.energyAtDecision===
    soloStep.riderEnergy.find(previous=>previous.riderId===row.riderId)
      .energyAfter));
  assert.equal(validateFinaleRotationSoloSecondSliceFromTour(tour,
    {attackTeamId:'a'},JSON.parse(JSON.stringify(second))),true);
  assert.throws(()=>validateFinaleRotationSoloSecondSliceFromTour(tour,
    {attackTeamId:'a'},{...second,bunchTravelSeconds:0}),
  /does not replay/);
  assert.throws(()=>recordFinaleRotationSoloRunFromTour(tour,{
    attackTeamId:'a'}),/needs an exact catch continuation/);
  const lateCatch=recordFinaleRotationSoloLateCatchFromTour(tour,{
    attackTeamId:'a'});
  assert.ok(lateCatch.catchDistanceM>39700&&
    lateCatch.catchDistanceM<39800);
  assert.equal(lateCatch.endDistanceM,39800);
  assert.equal(lateCatch.frames.length,3);
  assert.equal(lateCatch.frames[2].afterCatchRotationPlan.selected
    ?.teamId,'c');
  const secondEnergy=new Map(second.riderEnergy.map(row=>
    [row.riderId,row.energyAfter]));
  assert.ok(lateCatch.frames[2].riderEnergy.every(row=>
    row.energyAtDecision===secondEnergy.get(row.riderId)&&
    row.energySpent===row.preCatchEnergySpent+
      row.postCatchEnergySpent&&row.energyAfter>=0));
  assert.equal(lateCatch.roadGroups.length,0);
  assert.equal(lateCatch.pelotonRiderIds.length,32);
  assert.equal(lateCatch.riderEnergy.length,32);
  assert.equal(lateCatch.resultStatus,'unclassified');
  assert.equal(lateCatch.bunchElapsedSecondsAtMerge,
    solo.at500M.bunchElapsedSeconds+
    lateCatch.frames.reduce((sum,frame)=>
      sum+frame.bunchTravelSeconds,0));
  assert.equal(validateFinaleRotationSoloLateCatchFromTour(tour,
    {attackTeamId:'a'},JSON.parse(JSON.stringify(lateCatch))),true);
  assert.throws(()=>validateFinaleRotationSoloLateCatchFromTour(tour,
    {attackTeamId:'a'},{...lateCatch,catchDistanceM:39700}),
  /does not replay/);
  const soloPlanInput={attackTeamId:'a',
    plans:['a','b','c','d'].map(teamId=>({teamId,
      finisherId:`${teamId}-0`,
      leadOutRiderId:teamId==='b'?'b-2':null}))};
  const soloPlan=recordFinaleRotationSoloSprintPlanFromTour(tour,
    soloPlanInput);
  assert.equal(soloPlan.sourceRoadTraceVersion,solo.version);
  assert.equal(soloPlan.decisionDistanceM,39500);
  assert.notEqual(soloPlan.decisions[0].roadGroupId,'peloton');
  assert.equal(soloPlan.decisions[1].leadOutRiderId,'b-2');
  assert.equal(validateFinaleRotationSoloSprintPlanFromTour(tour,
    soloPlanInput,JSON.parse(JSON.stringify(soloPlan))),true);
  assert.throws(()=>recordFinaleRotationSoloSprintPlanFromTour(tour,{
    ...soloPlanInput,plans:soloPlanInput.plans.map(row=>
      row.teamId==='a'?{...row,leadOutRiderId:'a-2'}:row)}),
  /cannot work beside the finisher/);
  assert.throws(()=>validateFinaleRotationSoloSprintPlanFromTour(tour,
    soloPlanInput,{...soloPlan,decisionDistanceM:0}),
  /does not replay/);
  assert.throws(()=>recordFinaleRotationSoloLateCatchSprintFromTour(tour,
    soloPlanInput),/needs paid work before late contact/);
  const noLeadOutInput={...soloPlanInput,
    plans:soloPlanInput.plans.map(row=>({
      ...row,leadOutRiderId:null}))};
  const lateSprint=recordFinaleRotationSoloLateCatchSprintFromTour(
    tour,noLeadOutInput);
  assert.equal(lateSprint.sourceCatchVersion,lateCatch.version);
  assert.equal(lateSprint.startDistanceM,39800);
  assert.equal(lateSprint.endDistanceM,40000);
  assert.equal(lateSprint.frames.length,2);
  assert.equal(lateSprint.lineRiderEnergy.length,32);
  assert.equal(lateSprint.roadGroups.length,0);
  assert.equal(lateSprint.resultStatus,'unclassified');
  assert.ok(lateSprint.frames.every(frame=>
    frame.riderEnergy.length===32&&
    frame.riderEnergy.filter(row=>row.role==='sprint').length===4&&
    frame.riderEnergy.every(row=>row.energyAfter>=0)));
  assert.ok(lateSprint.frames.some(frame=>
    frame.rotation.selected&&frame.riderEnergy.some(row=>
      row.role==='front_rotation'&&row.energySpent>0)));
  const mergeEnergy=new Map(lateCatch.riderEnergy.map(row=>
    [row.riderId,row.energy]));
  assert.ok(lateSprint.frames[0].riderEnergy.every(row=>
    row.energyAtDecision===mergeEnergy.get(row.riderId)));
  assert.equal(lateSprint.bunchElapsedSecondsAtLine,
    lateCatch.bunchElapsedSecondsAtMerge+
    lateSprint.frames.reduce((sum,frame)=>
      sum+frame.bunchTravelSeconds,0));
  assert.equal(validateFinaleRotationSoloLateCatchSprintFromTour(tour,
    noLeadOutInput,JSON.parse(JSON.stringify(lateSprint))),true);
  assert.throws(()=>validateFinaleRotationSoloLateCatchSprintFromTour(tour,
    noLeadOutInput,{...lateSprint,bunchElapsedSecondsAtLine:0}),
  /does not replay/);
  const helperFinisherInput={...noLeadOutInput,
    plans:noLeadOutInput.plans.map(row=>row.teamId==='b'?
      {...row,finisherId:'b-2'}:row)};
  const helperSprint=recordFinaleRotationSoloLateCatchSprintFromTour(
    tour,helperFinisherInput);
  assert.deepEqual(helperSprint.busyTeamIds,['b']);
  assert.ok(helperSprint.frames.every(frame=>
    frame.supersededRotationTeamIds.includes('b')));
  assert.notDeepEqual(helperSprint.lineRiderEnergy,
    lateSprint.lineRiderEnergy);
  const bounds=probeFinaleRotationSoloLateCatchBoundsFromTour(tour,
    noLeadOutInput);
  assert.equal(bounds.sourceRunVersion,lateSprint.version);
  assert.equal(bounds.knownFirstPlaceRiderId,null);
  assert.equal(bounds.pointsStatus,'withheld');
  assert.equal(bounds.riders.length,32);
  assert.ok(bounds.riders.every(row=>
    row.firstPossiblePlace===1&&row.lastPossiblePlace===32));
  assert.equal(validateFinaleRotationSoloLateCatchBoundsFromTour(tour,
    noLeadOutInput,JSON.parse(JSON.stringify(bounds))),true);
  assert.throws(()=>validateFinaleRotationSoloLateCatchBoundsFromTour(
    tour,noLeadOutInput,{...bounds,knownFirstPlaceRiderId:'a-0'}),
  /do not replay/);
  assert.throws(()=>probeFinaleRotationSoloFinishBoundsFromTour(tour,{
    attackTeamId:'a'}),/needs an exact catch continuation/);
  assert.deepEqual(tour.provisionalResults,oldResults);
  }
});

test('a stronger named solo pays every late slice to a separated line',()=>{
  for(const gender of ['M','F']){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',75,{attack:true,gender}),
      team('b',88,{rotate:true,gender}),
      team('c',55,{rotate:true,chase:'all',gender}),
      team('d',80,{rotate:true,gender})],
    seed:`solo-line-${gender}`,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const road=probeLastKmRotationSoloFromTour(tour,{teamId:'a'});
    const run=recordFinaleRotationSoloRunFromTour(tour,{
      attackTeamId:'a'});
    assert.equal(run.endDistanceM,40000);
    assert.equal(run.frames.length,5);
    assert.deepEqual(run.roadGroups[0].riderIds,['a-0']);
    assert.ok(run.roadGroups[0].gapSeconds>0);
    assert.equal(run.lineRiderEnergy.length,32);
    assert.ok(run.frames.every(frame=>frame.riderEnergy.length===32&&
      frame.roadGroups[0].gapSeconds>0));
    for(let index=1;index<run.frames.length;index++){
      const before=new Map(run.frames[index-1].riderEnergy.map(row=>
        [row.riderId,row.energyAfter]));
      assert.ok(run.frames[index].riderEnergy.every(row=>
        row.energyAtDecision===before.get(row.riderId)));
    }
    assert.equal(run.bunchElapsedSecondsAtLine,
      road.at500M.bunchElapsedSeconds+
      run.frames.reduce((sum,frame)=>sum+frame.bunchTravelSeconds,0));
    assert.equal(validateFinaleRotationSoloRunFromTour(tour,
      {attackTeamId:'a'},JSON.parse(JSON.stringify(run))),true);
    assert.throws(()=>recordFinaleRotationSoloLateCatchFromTour(tour,{
      attackTeamId:'a'}),/needs actual road contact/);
    assert.throws(()=>validateFinaleRotationSoloRunFromTour(tour,
      {attackTeamId:'a'},{...run,bunchElapsedSecondsAtLine:0}),
    /does not replay/);
    const bounds=probeFinaleRotationSoloFinishBoundsFromTour(tour,{
      attackTeamId:'a'});
    assert.equal(bounds.sourceRunVersion,run.version);
    assert.equal(bounds.knownFirstPlaceRiderId,'a-0');
    assert.equal(bounds.pointsStatus,'withheld');
    assert.equal(bounds.riders.length,32);
    assert.deepEqual(bounds.roadBands.map(band=>[
      band.firstPossiblePlace,band.lastPossiblePlace]),
    [[1,1],[2,32]]);
    assert.equal(validateFinaleRotationSoloFinishBoundsFromTour(tour,
      {attackTeamId:'a'},JSON.parse(JSON.stringify(bounds))),true);
    assert.throws(()=>validateFinaleRotationSoloFinishBoundsFromTour(tour,
      {attackTeamId:'a'},{...bounds,knownFirstPlaceRiderId:'b-0'}),
    /do not replay/);
    assert.throws(()=>probeFinaleRotationSoloLateCatchBoundsFromTour(tour,{
      attackTeamId:'a',plans:['a','b','c','d'].map(teamId=>({
        teamId,finisherId:`${teamId}-0`,leadOutRiderId:null}))}),
    /needs actual road contact/);
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

test('a surviving 500 m solo source refuses an unrecorded 100 m catch',()=>{
  for(const gender of ['M','F']){
    const tour=simulateTacticalTour({stage,teams:[
      team('a',60,{attack:true,gender}),
      team('b',88,{rotate:true,gender}),
      team('c',55,{chase:'all',gender}),
      team('d',80,{rotate:true,gender})],
    seed:'attack-with-rotation-M',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const solo=probeLastKmRotationSoloFromTour(tour,{teamId:'a'});
    assert.ok(solo.at500M.roadGroups[0].gapSeconds>0);
    assert.throws(()=>recordFinaleRotationSoloSliceFromTour(tour,{
      attackTeamId:'a'}),/needs an exact catch continuation/);
    const caught=recordFinaleRotationSoloCatchSliceFromTour(tour,{
      attackTeamId:'a'});
    assert.ok(caught.catchDistanceM>39500&&
      caught.catchDistanceM<39600);
    assert.equal(caught.endDistanceM,39600);
    assert.equal(caught.roadGroups.length,0);
    assert.equal(caught.pelotonRiderIds.length,32);
    assert.equal(caught.riderEnergy.length,32);
    assert.equal(caught.bunchTravelSeconds,
      caught.preCatchBunchTravelSeconds+
      caught.postCatchTravelSeconds);
    assert.ok(caught.riderEnergy.every(row=>row.energySpent===
      row.preCatchEnergySpent+row.postCatchEnergySpent&&
      row.energyAfter>=0));
    assert.equal(validateFinaleRotationSoloCatchSliceFromTour(tour,
      {attackTeamId:'a'},JSON.parse(JSON.stringify(caught))),true);
    assert.throws(()=>validateFinaleRotationSoloCatchSliceFromTour(tour,
      {attackTeamId:'a'},{...caught,catchDistanceM:39500}),
    /does not replay/);
  }
});

test('a contained attack pays once then independent front rotation continues',()=>{
  for(const gender of ['M','F']){
    const attacker=team('a',56,{attack:true,gender});
    attacker.orders.baseline.effort='conserve';
    const tour=simulateTacticalTour({stage,teams:[
      attacker,
      team('b',95,{rotate:true,gender}),
      team('c',95,{chase:'all',gender}),
      team('d',80,{rotate:true,gender})],
    seed:`contained-rotation-${gender}`,
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
    const source=finaleSnapshotFromTour(tour,{remainingKm:1,
      includeAttackLoad:true});
    const grid=finaleDistanceGrid(tour.route,{remainingKm:1});
    const launchInput={slice:grid[0],route:tour.route,
      teams:tour.committedInputs.teams,
      pelotonRiderIds:source.peloton.riderIds,
      energies:new Map(source.riders.map(row=>[row.riderId,row.energy])),
      attackerTeamId:'a',attackerRiderId:'a-0',
      repeatLoad:Math.max(0,source.riderAttackLoads.find(row=>
        row.riderId==='a-0').load-TUNING.attack.loadRecoveryPerKm)};
    const launch=advanceFinaleNamedAttackRotationTransition(launchInput);
    assert.equal(launch.roadGroups.length,0);
    const input={launchInput,launch,slice:grid[1]};
    const bunch=continueFinaleNamedAttackRotationBunch(input);
    assert.equal(bunch.roadGroups.length,0);
    assert.equal(bunch.pelotonRiderIds.length,32);
    assert.equal(bunch.rotation.selected.teamId,'d');
    assert.equal(bunch.riderEnergy.filter(row=>
      row.role==='front_rotation').length,2);
    assert.ok(bunch.riderEnergy.every(row=>
      row.energySpent>0&&row.energyAfter>=0));
    assert.equal(validateFinaleNamedAttackRotationBunch(input,bunch),true);
    assert.throws(()=>validateFinaleNamedAttackRotationBunch(input,{
      ...bunch,bunchElapsedSeconds:0}),/does not replay/);
    assert.throws(()=>validateFinaleNamedAttackRotationBunch(input,{
      ...bunch,riderEnergy:bunch.riderEnergy.map(row=>
        row.role==='front_rotation'?{...row,energySpent:0}:row)}),
    /does not replay/);
    const oldResults=structuredClone(tour.provisionalResults);
    const linked=probeLastKmRotationContainedFromTour(tour,{teamId:'a'});
    assert.deepEqual(linked.frames,[launch,bunch]);
    assert.equal(linked.sourceKm,39);
    assert.equal(linked.at500M.distanceM,39500);
    assert.equal(linked.at500M.pelotonRiderIds.length,32);
    assert.equal(linked.at500M.riderEnergy.length,32);
    assert.equal(linked.at500M.bunchElapsedSeconds,
      launch.bunchElapsedSeconds+bunch.bunchElapsedSeconds);
    assert.equal(validateLastKmRotationContainedFromTour(tour,
      {teamId:'a'},linked),true);
    assert.throws(()=>validateLastKmRotationContainedFromTour(tour,
      {teamId:'a'},{...linked,at500M:{...linked.at500M,
        bunchElapsedSeconds:0}}),/does not replay/);
    const planInput={attackTeamId:'a',plans:['a','b','c','d'].map(
      teamId=>({teamId,finisherId:`${teamId}-0`,
        leadOutRiderId:teamId==='b'?null:`${teamId}-2`}))};
    const sprintPlan=recordFinaleRotationContainedSprintPlanFromTour(
      tour,planInput);
    assert.equal(sprintPlan.sourceRoadTraceVersion,linked.version);
    assert.equal(sprintPlan.decisionDistanceM,39500);
    assert.equal(sprintPlan.decisions.length,4);
    assert.equal(sprintPlan.decisions.find(row=>row.teamId==='b')
      .leadOutRiderId,null);
    assert.equal(validateFinaleRotationContainedSprintPlanFromTour(tour,
      planInput,sprintPlan),true);
    assert.throws(()=>validateFinaleRotationContainedSprintPlanFromTour(
      tour,planInput,{...sprintPlan,decisionDistanceM:0}),
    /does not replay/);
    const approach=recordFinaleRotationContainedOrderedApproachFromTour(
      tour,planInput);
    assert.equal(approach.sourceRoadTraceVersion,linked.version);
    assert.equal(approach.sprintPlanVersion,sprintPlan.version);
    assert.equal(approach.endDistanceM,39700);
    assert.equal(approach.frames.length,2);
    assert.ok(approach.frames.every(frame=>
      frame.pelotonRiderIds.length===32&&
      frame.riderEnergy.length===32));
    assert.deepEqual(approach.frames.map(frame=>
      frame.rotation.selected?.teamId),['b','b']);
    assert.ok(approach.frames.every(frame=>
      frame.riderEnergy.filter(row=>row.role==='front_rotation')
        .length===2));
    assert.equal(validateFinaleRotationContainedOrderedApproachFromTour(
      tour,planInput,approach),true);
    assert.throws(()=>validateFinaleRotationContainedOrderedApproachFromTour(
      tour,planInput,{...approach,bunchElapsedSecondsAt300M:0}),
    /does not replay/);
    const leadOutInput={...planInput,plans:planInput.plans.map(row=>
      row.teamId==='b'?{...row,leadOutRiderId:'b-2'}:row)};
    const leadOutApproach=
      recordFinaleRotationContainedOrderedApproachFromTour(tour,
        leadOutInput);
    assert.deepEqual(leadOutApproach.frames.map(frame=>
      frame.supersededRotationTeamIds),[['b','d'],['b','d']]);
    assert.ok(leadOutApproach.frames.every(frame=>
      frame.rotation.selected===null));
    assert.notDeepEqual(approach.energyAt300M,
      leadOutApproach.energyAt300M);
    assert.equal(validateFinaleRotationContainedOrderedApproachFromTour(
      tour,leadOutInput,leadOutApproach),true);
    const sprint=recordFinaleRotationContainedOrderedSprintFromTour(tour,
      planInput);
    const leadOutSprint=recordFinaleRotationContainedOrderedSprintFromTour(
      tour,leadOutInput);
    assert.equal(sprint.sourceApproachVersion,approach.version);
    assert.equal(sprint.sprintPlanVersion,sprintPlan.version);
    assert.equal(sprint.endDistanceM,40000);
    assert.equal(sprint.frames.length,3);
    assert.deepEqual(sprint.frames.map(frame=>
      frame.rotation.selected?.teamId),['b','b','b']);
    assert.ok(sprint.frames.every(frame=>
      frame.riderEnergy.length===32&&
      frame.riderEnergy.filter(row=>row.role==='front_rotation')
        .length===2));
    assert.deepEqual(leadOutSprint.frames.map(frame=>
      frame.supersededRotationTeamIds),[['b','d'],['b','d'],['b','d']]);
    assert.ok(leadOutSprint.frames.every(frame=>
      frame.rotation.selected===null));
    assert.notDeepEqual(sprint.lineRiderEnergy,
      leadOutSprint.lineRiderEnergy);
    assert.equal(sprint.bunchElapsedSecondsAtLine,
      approach.bunchElapsedSecondsAt300M+
      sprint.frames.reduce((sum,frame)=>
        sum+frame.bunchTravelSeconds,0));
    assert.equal(validateFinaleRotationContainedOrderedSprintFromTour(tour,
      planInput,sprint),true);
    assert.equal(validateFinaleRotationContainedOrderedSprintFromTour(tour,
      leadOutInput,leadOutSprint),true);
    assert.throws(()=>validateFinaleRotationContainedOrderedSprintFromTour(
      tour,planInput,{...sprint,bunchElapsedSecondsAtLine:0}),
    /does not replay/);
    const bounds=probeFinaleRotationContainedOrderedBoundsFromTour(tour,
      planInput);
    assert.equal(bounds.sourceRunVersion,sprint.version);
    assert.equal(bounds.lineDistanceM,40000);
    assert.equal(bounds.riders.length,32);
    assert.ok(bounds.riders.every(row=>
      row.firstPossiblePlace===1&&row.lastPossiblePlace===32));
    assert.equal(validateFinaleRotationContainedOrderedBoundsFromTour(tour,
      planInput,bounds),true);
    assert.throws(()=>validateFinaleRotationContainedOrderedBoundsFromTour(
      tour,planInput,{...bounds,riders:bounds.riders.map(row=>
        row.riderId==='a-0'?{...row,lastPossiblePlace:1}:row)}),
    /do not replay/);
    const bundleInput={...planInput,branch:'contained'};
    const bundle=recordFinaleRotationBranchFromTour(tour,bundleInput);
    assert.equal(bundle.sourceMotorVersion,tour.tuningVersion);
    assert.equal(bundle.branch,'contained');
    assert.equal(bundle.resultStatus,'unclassified');
    assert.deepEqual(bundle.road,linked);
    assert.deepEqual(bundle.plan,sprintPlan);
    assert.deepEqual(bundle.approach,approach);
    assert.deepEqual(bundle.sprint,sprint);
    assert.deepEqual(bundle.bounds,bounds);
    assert.equal(validateFinaleRotationBranchFromTour(tour,
      bundleInput,bundle),true);
    assert.equal(validateFinaleRotationBranchFromTour(tour,bundleInput,
      JSON.parse(JSON.stringify(bundle))),true);
    assert.throws(()=>validateFinaleRotationBranchFromTour(tour,
      bundleInput,{...bundle,branch:'caught'}),/does not replay/);
    assert.throws(()=>recordFinaleRotationBranchFromTour(tour,
      {...bundleInput,branch:'unknown'}),/must be caught or contained/);
    assert.deepEqual(tour.provisionalResults,oldResults);
  }
});
