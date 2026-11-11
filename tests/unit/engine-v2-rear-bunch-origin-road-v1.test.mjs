import test from 'node:test';
import assert from 'node:assert/strict';
import {runRearBunchOriginRoadV1,
  validateRearBunchOriginRoadV1} from
  '../../lib/engine/v2/rear-bunch-origin-road-v1.mjs';
import {riderKilometreEffect} from
  '../../lib/engine/v2/physiology.mjs';
import {continueRearOriginPaceSoloV1,
  validateRearOriginPaceSoloV1} from
  '../../lib/engine/v2/rear-origin-pace-solo-v1.mjs';
import {runRearOriginPaceFinishV1,
  validateRearOriginPaceFinishV1} from
  '../../lib/engine/v2/rear-origin-pace-finish-v1.mjs';

const rider={id:'r',mountain:20,flat:90,hills:70,timetrial:70,
  endurance:70,strength:70,form:50,fatigue:30};
const routeKilometres=[1,2,3].map(km=>({km,
  terrain:km===3?'climb':'flat',surface:'road',
  gradientPct:km===3?8:0,exposed:false,
  weather:{temperatureC:16,windKph:0,rainMm:0}}));
const bunchTurnPlans=[50,50,100].map((ability,index)=>({
  status:'worked',leaderAbility:ability,
  turns:[{startM:0,endM:1000,ability,
    leaderRiderId:index===1?'r':'leader'}]}));
const orders={baseline:{effort:'conserve'},phases:[]};
const choices=[1,2,3].map(km=>({riderId:'r',km,
  effort:'conserve',action:'hold_wheel',reason:'follow_order'}));
const input={rider,orders,routeKilometres,bunchTurnPlans,choices,
  stageNumber:1,stageCount:3};

test('opt-in follower speed benefit applies only behind the named front',()=>{
  const segment=routeKilometres[0];
  const ability=riderKilometreEffect(rider,segment,{
    phase:'cruise',energy:88,exposed:false}).ability;
  const leaderAbility=+(ability-3.4).toFixed(3);
  const plan={status:'worked',leaderAbility,
    turns:[{startM:0,endM:1000,
      ability:leaderAbility,leaderRiderId:'other'}]};
  const source={...input,routeKilometres:[segment],
    bunchTurnPlans:[plan],choices:[choices[0]],stageCount:1};
  const old=runRearBunchOriginRoadV1(source);
  const revised=runRearBunchOriginRoadV1({
    ...source,followerSpeedVersion:1});
  assert.equal(old.status,'wheel_lost');
  assert.equal(revised.status,'bunch');
  assert.equal(revised.version,'v2-rear-bunch-follower-speed-1');
  assert.equal(revised.steps[0].slices[0].role,'sheltered');
  assert.ok(revised.steps[0].slices[0].holdSpeedKph>
    revised.steps[0].slices[0].bunchSpeedKph);
  assert.equal(validateRearBunchOriginRoadV1({
    ...source,followerSpeedVersion:1},revised),true);
  assert.throws(()=>validateRearBunchOriginRoadV1(source,revised),
    /differs/);
});

test('recorded work prices sourced rest and a named chase turn',()=>{
  const plans=[
    {version:'v2-peloton-front-turns-1',status:'worked',
      exposureCostVersion:1,leaderAbility:50,
      turns:[{teamId:'other',leaderRiderId:'leader',
        workKind:'front',startM:0,endM:1000,ability:50}],
      extraEnergyCosts:[{teamId:'other',riderId:'leader',
        workKind:'front',leadingM:1000,extraCost:.18}]},
    {version:'v2-peloton-front-turns-1',status:'worked',
      exposureCostVersion:1,leaderAbility:90,
      turns:[{teamId:'team',leaderRiderId:'r',
        workKind:'chase',startM:0,endM:1000,ability:90}],
      extraEnergyCosts:[{teamId:'team',riderId:'r',
        workKind:'chase',leadingM:1000,extraCost:.4}]},
  ];
  const source={rider,orders:{baseline:{effort:'steady'},phases:[]},
    routeKilometres:routeKilometres.slice(0,2),
    bunchTurnPlans:plans,choices:choices.slice(0,2).map(choice=>({
      ...choice,effort:'steady'})),stageNumber:1,stageCount:1};
  const ordinary=runRearBunchOriginRoadV1({
    ...source,followerSpeedVersion:1});
  const recordedInput={...source,teamId:'team',
    followerSpeedVersion:1,recordedWorkVersion:1,
    followerDecisions:[{version:'v94-peloton-follower-effort-2',
      sourceKm:1,riderId:'r',teamId:'team',
      teamOrderEffort:'steady',appliedEffort:'conserve',
      effortSource:'recorded_peloton_rest'},null]};
  const recorded=runRearBunchOriginRoadV1(recordedInput);
  assert.equal(recorded.status,'bunch');
  assert.equal(recorded.version,'v2-rear-bunch-recorded-work-1');
  assert.equal(recorded.steps[0].appliedEffort,'conserve');
  assert.equal(recorded.steps[0].effortSource,'recorded_peloton_rest');
  assert.ok(recorded.steps[0].slices[0].energySpent<
    ordinary.steps[0].slices[0].energySpent);
  assert.equal(recorded.steps[1].slices[0].sourceExtraCost,.4);
  assert.ok(recorded.steps[1].slices[0].energySpent>
    ordinary.steps[1].slices[0].energySpent);
  assert.equal(validateRearBunchOriginRoadV1(
    recordedInput,recorded),true);
  assert.throws(()=>runRearBunchOriginRoadV1({...recordedInput,
    followerDecisions:[{...recordedInput.followerDecisions[0],
      appliedEffort:'hard'},null]}),/follower decision source/);
  assert.throws(()=>runRearBunchOriginRoadV1({...recordedInput,
    bunchTurnPlans:[plans[0],{...plans[1],extraEnergyCosts:[{
      ...plans[1].extraEnergyCosts[0],extraCost:NaN}]}]}),
  /follower decision source/);
});

test('physical bunch origin pays wheels before a climb pace split',()=>{
  const road=runRearBunchOriginRoadV1(input);
  assert.equal(road.status,'wheel_lost');
  assert.equal(road.steps.length,3);
  assert.equal(road.steps[2].split.kind,'physical_pace_loss');
  assert.equal(road.steps[2].split.atDistanceM,2000);
  assert.deepEqual(road.steps.slice(0,2).map(step=>
    step.slices[0].role),['sheltered','leader']);
  assert.ok(road.steps[0].slices[0].energySpent>0);
  assert.ok(road.steps[1].slices[0].energySpent>0);
  assert.equal(road.steps[2].energyAfter,road.steps[1].energyAfter);
  assert.equal(validateRearBunchOriginRoadV1(input,road),true);
  const forged=structuredClone(road);
  forged.steps[1].slices[0].energySpent=0;
  assert.throws(()=>validateRearBunchOriginRoadV1(input,forged),
    /differs/);
  assert.throws(()=>runRearBunchOriginRoadV1({...input,
    choices:[choices[0],{...choices[1],effort:'hard'},choices[2]]}),
  /explicit ordered decision/);
  const soloInput={originInput:input,origin:road,
    soloChoice:{riderId:'r',km:3,effort:'conserve',
      reason:'finish_safely'}};
  const solo=continueRearOriginPaceSoloV1(soloInput);
  assert.equal(solo.splitDistanceM,road.steps[2].endDistanceM);
  assert.equal(solo.endDistanceM,3000);
  assert.ok(solo.behindBunchSeconds>0);
  assert.ok(solo.slices.every(slice=>slice.energySpent>0&&
    slice.soloSeconds>slice.bunchSeconds));
  assert.equal(solo.recoveryAward,0);
  assert.equal(validateRearOriginPaceSoloV1(soloInput,solo),true);
  const forgedSolo=structuredClone(solo);
  forgedSolo.slices[0].energySpent=0;
  assert.throws(()=>validateRearOriginPaceSoloV1(
    soloInput,forgedSolo),/differs/);
  const finishInput={soloInput,solo,
    routeKilometres,bunchTurnPlans,soloChoices:[]};
  const finish=runRearOriginPaceFinishV1(finishInput);
  assert.equal(finish.finishDistanceM,3000);
  assert.ok(finish.finishElapsedSeconds>
    finish.bunchElapsedSeconds);
  assert.equal(finish.timeLimitSeconds,null);
  assert.equal(finish.officialResults,false);
  assert.equal(validateRearOriginPaceFinishV1(
    finishInput,finish),true);
  const forgedFinish=structuredClone(finish);
  forgedFinish.behindBunchSeconds=0;
  assert.throws(()=>validateRearOriginPaceFinishV1(
    finishInput,forgedFinish),/differs/);
  const finalSegment={...routeKilometres[2],km:4,
    terrain:'flat',gradientPct:0};
  const finalPlan={status:'worked',leaderAbility:100,
    turns:[{startM:0,endM:500,ability:100,
      leaderRiderId:'leader-a'},
    {startM:500,endM:1000,ability:100,
      leaderRiderId:'leader-b'}]};
  const longerInput={soloInput,solo,
    routeKilometres:[...routeKilometres,finalSegment],
    bunchTurnPlans:[...bunchTurnPlans,finalPlan],
    soloChoices:[{riderId:'r',km:4,effort:'conserve',
      reason:'finish_safely'}]};
  const longer=runRearOriginPaceFinishV1(longerInput);
  assert.equal(longer.finishDistanceM,4000);
  assert.equal(longer.steps[0].slices.length,2);
  assert.ok(longer.steps[0].slices.every(slice=>
    slice.energySpent>0));
  assert.ok(Math.abs(longer.finishElapsedSeconds-
    longer.bunchElapsedSeconds-
    longer.behindBunchSeconds)<1e-9);
  assert.equal(validateRearOriginPaceFinishV1(
    longerInput,longer),true);
  const conflictingPlan={status:'worked',leaderAbility:100,
    turns:[{startM:0,endM:500,ability:100,
      leaderRiderId:'leader'},
    {startM:500,endM:1000,ability:100,
      leaderRiderId:'r'}]};
  const conflictingInput={...input,bunchTurnPlans:[
    ...bunchTurnPlans.slice(0,2),conflictingPlan]};
  const conflictingOrigin=runRearBunchOriginRoadV1(
    conflictingInput);
  assert.equal(conflictingOrigin.status,'wheel_lost');
  assert.throws(()=>continueRearOriginPaceSoloV1({
    originInput:conflictingInput,origin:conflictingOrigin,
    soloChoice:soloInput.soloChoice}),
  /cannot lead the later bunch turn/);
});

test('deliberate release needs an explicit future-stage commitment',()=>{
  const release=[choices[0],{...choices[1],
    action:'release_wheel',
    reason:'committed_future_stage_reserve'},choices[2]];
  assert.throws(()=>runRearBunchOriginRoadV1({...input,
    choices:release}),/explicit ordered decision/);
  const committedStagePlan={riderId:'r',currentStageNumber:1,
    targetStageNumber:2,currentGoal:'finish_safely',
    futureGoal:'target_stage',reserveEnergy:50};
  const road=runRearBunchOriginRoadV1({...input,
    choices:release,committedStagePlan});
  assert.equal(road.status,'wheel_released');
  assert.equal(road.steps.length,2);
  assert.equal(road.steps[1].split.atDistanceM,1000);
  assert.equal(road.steps[1].slices.length,0);
  assert.equal(road.energyAfter,road.steps[0].energyAfter);
});
