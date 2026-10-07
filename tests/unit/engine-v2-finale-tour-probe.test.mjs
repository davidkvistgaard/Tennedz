import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION,TUNING_VERSION} from
  '../../lib/engine/v2/tuning.mjs';
import {FINALE_WORKER_PASSIVE_SLOPE_VERSION} from
  '../../lib/engine/v2/finale-worker.mjs';
import {finaleSnapshotFromTour,FINALE_SNAPSHOT_VERSION} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {advanceFinaleGroupStep} from '../../lib/engine/v2/finale-group-step.mjs';
import {simulateFinaleGroupRun,validateFinaleGroupRun,
  simulateFinaleGroupToLine,validateFinaleGroupToLine} from
  '../../lib/engine/v2/finale-group-run.mjs';
import {validateFinalePair} from '../../lib/engine/v2/finale-pair.mjs';
import {validateFinaleRelay} from '../../lib/engine/v2/finale-relay.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {validateFinaleLeadOutPull} from '../../lib/engine/v2/finale-lead-out-pull.mjs';
import {probeFinalePairFromTour,probeFinaleRelayFromTour,
  probeFinaleLeadOutFromTour,probeFinaleGroupStepFromTour,
  probeFinaleGroupRunFromTour,probeFinaleGroupToLineFromTour} from
  '../../lib/engine/v2/finale-tour-probe.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]]};
function team(id,preset,baseline){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:60,strength:60,endurance:60,
    timetrial:id==='a'&&index===2?100:60,sprint:50,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset,baseline}};
}
const input={stage,seed:'finale-snapshot',teams:[
  team('a','aggressive',{attackRiderId:'a-2',chase:'ignore'}),
  team('b','protect',{attack:'none',chase:'all'}),
]};

test('the five-kilometre handoff retains every actual group and rider energy',()=>{
  const planned=structuredClone(input);
  planned.teams[0].orders.phases=[{atKm:30,attack:'selective',attackRiderId:'a-2'}];
  planned.teams[1].orders.phases=[{atKm:30,attack:'selective',attackRiderId:'b-2'}];
  const tour=simulateTacticalTour({...planned,motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const original=structuredClone(tour);
  const source=tour.frames[34];
  const snapshot=finaleSnapshotFromTour(tour);
  assert.ok(snapshot.roadGroups.some(group=>
    group.riderIds.includes('a-2')&&group.riderIds.includes('b-2')));
  assert.equal(snapshot.version,FINALE_SNAPSHOT_VERSION);
  assert.equal(snapshot.sourceKm,35);
  assert.equal(snapshot.startDistanceM,35000);
  assert.equal(snapshot.remainingM,5000);
  assert.equal(snapshot.sourceTuningVersion,MOTOR_ATTACK_TRACE_VERSION);
  assert.deepEqual(snapshot.roadGroups,source.roadGroups.map(group=>({
    id:group.id,gapSeconds:group.gapSeconds,riderIds:group.riderIds,
    teamIds:group.teamIds})));
  assert.deepEqual(snapshot.riders.map(rider=>rider.riderId),
    source.riderGroups.map(rider=>rider.id));
  for(const rider of snapshot.riders){
    const state=source.riderGroups.find(row=>row.id===rider.riderId);
    assert.equal(rider.energy,state.energy);
    assert.equal(rider.teamId,state.teamId);
    assert.equal(rider.roadGroupId,state.group==='breakaway'?
      source.roadGroups.find(group=>group.riderIds.includes(rider.riderId)).id:
      state.group==='peloton'?'peloton':null);
  }
  assert.deepEqual(snapshot.peloton.riderIds,
    source.riderGroups.filter(rider=>rider.group==='peloton').map(rider=>rider.id));
  assert.deepEqual(tour,original);
  const forged=structuredClone(tour);
  forged.frames[34].riderGroups[0].energy=120;
  assert.throws(()=>finaleSnapshotFromTour(forged),/rider state/);
});

test('a real 5 km recording supplies rider energy, solo gap and locked orders',()=>{
  const tour=simulateTacticalTour(input);
  const original=structuredClone(tour);
  const snapshot=tour.frames[34];
  assert.deepEqual(snapshot.roadGroups.map(group=>group.riderIds),[['a-2']]);
  const probe=probeFinalePairFromTour(tour,{frontRiderId:'a-2',chaseRiderId:'b-2'});
  assert.equal(probe.sourceKm,35);
  assert.equal(probe.sourceTuningVersion,tour.tuningVersion);
  assert.deepEqual(probe.sourceWarnings,['residual_gap_after_sufficient_chase']);
  assert.equal(probe.input.initialGapSeconds,snapshot.roadGroups[0].gapSeconds);
  assert.equal(probe.input.front.energy,snapshot.riderGroups.find(r=>r.id==='a-2').energy);
  assert.equal(probe.input.rear.energy,snapshot.riderGroups.find(r=>r.id==='b-2').energy);
  assert.equal(validateFinalePair(probe.input,probe.recording),true);
  assert.deepEqual(tour,original);
  assert.throws(()=>probeFinalePairFromTour(tour,{
    frontRiderId:'a-2',chaseRiderId:'b-0'}),/nominated helper/);
  assert.throws(()=>probeFinalePairFromTour(tour,{
    frontRiderId:'a-0',chaseRiderId:'b-2'}),/alone ahead/);
  assert.throws(()=>probeFinalePairFromTour(tour,{
    frontRiderId:'a-2',chaseRiderId:'a-3'}),/engaged in the bunch chase/);
});

test('the first group slice charges actual source riders and named workers',()=>{
  const tour=simulateTacticalTour(input);
  const original=structuredClone(tour);
  const probe=probeFinaleGroupStepFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'});
  assert.equal(probe.sourceKm,35);
  assert.equal(probe.input.frontGroup.id,probe.snapshot.roadGroups[0].id);
  assert.deepEqual(probe.sourceWarnings,['residual_gap_after_sufficient_chase']);
  assert.equal(probe.input.riderPlans.length,16);
  assert.deepEqual(probe.recording,
    advanceFinaleGroupStep(probe.input));
  assert.deepEqual(tour,original);
  assert.throws(()=>probeFinaleGroupStepFromTour(tour,{
    frontPullRiderId:'b-2',chasePullRiderId:'b-2'}),/front puller/);
  assert.throws(()=>probeFinaleGroupStepFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'a-3'}),/engaged/);
});

test('a shared front group keeps both attacking teams and a rival bunch',()=>{
  const teams=[team('a','aggressive',{attack:'none',chase:'ignore'}),
    team('b','aggressive',{attack:'none',chase:'ignore'}),
    team('c','protect',{attack:'none',chase:'selective'})];
  for(const team of teams.slice(0,2))team.orders.phases=[{atKm:30,
    attack:'selective',attackRiderId:`${team.id}-2`}];
  const tour=simulateTacticalTour({stage,teams,seed:'shared-front-finale',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=tour.frames[34];
  assert.ok(source.roadGroups.some(group=>
    group.riderIds.includes('a-2')&&group.riderIds.includes('b-2')));
  const probe=probeFinaleGroupStepFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'c-2'});
  assert.deepEqual(probe.input.frontGroup.riderIds,['a-2','b-2']);
  assert.equal(probe.input.riderPlans.find(row=>row.riderId==='b-2').energy,
    source.riderGroups.find(row=>row.id==='b-2').energy);
  assert.equal(probe.recording.riders.find(row=>row.riderId==='b-2').role,
    'sheltered');
});

test('successive group slices carry spent energy until catch or finish',()=>{
  const tour=simulateTacticalTour(input);
  const original=structuredClone(tour);
  const probe=probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'});
  assert.equal(validateFinaleGroupRun(probe.input,probe.recording),true);
  assert.equal(probe.recording.sourceTuningVersion,tour.tuningVersion);
  assert.equal(probe.recording.workerTuningVersion,TUNING_VERSION);
  assert.ok(probe.recording.frames.length>=1);
  assert.ok(probe.recording.frames.length<=11);
  for(const [index,frame] of probe.recording.frames.entries()){
    assert.ok(frame.endDistanceM>frame.startDistanceM);
    if(index===0)continue;
    const previous=probe.recording.frames[index-1];
    assert.equal(frame.startDistanceM,previous.endDistanceM);
    for(const rider of frame.riders)assert.ok(rider.energy<=
      previous.riders.find(row=>row.riderId===rider.riderId).energy);
  }
  assert.equal(probe.recording.outcome==='caught',
    probe.recording.endDistanceM<tour.route.distanceKm*1000);
  assert.deepEqual(tour,original);
  const forged=structuredClone(probe.recording);
  forged.frames.at(-1).riders[0].energy+=.1;
  assert.throws(()=>validateFinaleGroupRun(probe.input,forged),/differs/);
});

test('an isolated faster rival group earns a catch before the finish',()=>{
  const tour=simulateTacticalTour(input);
  const source=probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'}).input;
  const trial=structuredClone(source);
  trial.snapshot.roadGroups[0].gapSeconds=1;
  const front=trial.teams[0].riders.find(rider=>rider.id==='a-2');
  const rear=trial.teams[1].riders.find(rider=>rider.id==='b-2');
  front.timetrial=30;
  rear.strength=100;
  const recording=simulateFinaleGroupRun(trial);
  assert.equal(recording.outcome,'caught');
  assert.ok(recording.endDistanceM<tour.route.distanceKm*1000);
  assert.equal(recording.frames.at(-1).event.kind,'catch');
  assert.deepEqual(recording.frames.at(-1).roadGroups,[]);
  assert.equal(validateFinaleGroupRun(trial,recording),true);
});

test('the continuous group run refuses unpaid work from an exhausted follower',()=>{
  const tour=simulateTacticalTour(input);
  const trial=structuredClone(probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'}).input);
  trial.snapshot.riders.find(rider=>rider.riderId==='b-3').energy=.001;
  assert.throws(()=>simulateFinaleGroupRun(trial),/cannot spend energy/);
});

test('a caught group keeps travelling from the catch metre through the line',()=>{
  const tour=simulateTacticalTour(input);
  const source=probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'}).input;
  const trial=structuredClone(source);
  trial.snapshot.roadGroups[0].gapSeconds=1;
  trial.teams[0].riders.find(rider=>rider.id==='a-2').timetrial=30;
  trial.teams[1].riders.find(rider=>rider.id==='b-2').strength=100;
  const recording=simulateFinaleGroupToLine(trial);
  assert.equal(recording.workerTuningVersion,TUNING_VERSION);
  assert.equal(recording.sourceTuningVersion,trial.snapshot.sourceTuningVersion);
  assert.equal(recording.outcome,'caught_merged');
  assert.ok(recording.catchDistanceM<tour.route.distanceKm*1000);
  assert.equal(recording.endDistanceM,tour.route.distanceKm*1000);
  assert.equal(recording.finishGapSeconds,0);
  assert.ok(recording.mergedFrames.length>0);
  const catchFrame=recording.approachFrames.at(-1);
  assert.equal(recording.mergedFrames[0].startDistanceM,catchFrame.endDistanceM);
  assert.equal(recording.mergedFrames.at(-1).endDistanceM,
    tour.route.distanceKm*1000);
  for(const [index,frame] of recording.mergedFrames.entries()){
    const previous=index===0?catchFrame:recording.mergedFrames[index-1];
    assert.equal(frame.startDistanceM,previous.endDistanceM);
    for(const rider of frame.riders)assert.ok(rider.energy<=
      previous.riders.find(row=>row.riderId===rider.riderId).energy);
  }
  assert.deepEqual(recording.finalRiderEnergy.map(row=>row.riderId),
    catchFrame.pelotonRiderIds);
  assert.deepEqual(recording.finalRiderEnergy,
    recording.mergedFrames.at(-1).riders.map(row=>({riderId:row.riderId,
      energy:row.energy})));
  assert.equal(validateFinaleGroupToLine(trial,recording),true);
  const altered=structuredClone(recording);
  altered.mergedFrames[0].riders[0].energy+=1;
  assert.throws(()=>validateFinaleGroupToLine(trial,altered),/differs/);
  const genuine=probeFinaleGroupToLineFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'});
  assert.equal(genuine.recording.outcome,'survived');
  assert.deepEqual(genuine.recording.mergedFrames,[]);
  assert.equal(validateFinaleGroupToLine(genuine.input,genuine.recording),true);
  const differentSourceVersion=structuredClone(genuine.input);
  differentSourceVersion.snapshot.sourceTuningVersion=MOTOR_ATTACK_TRACE_VERSION;
  const versioned=simulateFinaleGroupToLine(differentSourceVersion);
  assert.equal(versioned.sourceTuningVersion,MOTOR_ATTACK_TRACE_VERSION);
  assert.equal(versioned.workerTuningVersion,TUNING_VERSION);
});

test('a team that ignored the gap cannot be invented as a chasing worker',()=>{
  const quiet=structuredClone(input);
  quiet.teams[1].orders.baseline.chase='ignore';
  const tour=simulateTacticalTour(quiet);
  assert.deepEqual(tour.frames[34].roadGroups.map(group=>group.riderIds),[['a-2']]);
  assert.throws(()=>probeFinalePairFromTour(tour,{
    frontRiderId:'a-2',chaseRiderId:'b-2'}),/engaged in the bunch chase/);
});

test('a recorded one-kilometre snapshot supplies the actual lead-out group and energy',()=>{
  const tour=simulateTacticalTour(input);
  const original=structuredClone(tour);
  const probe=probeFinaleLeadOutFromTour(tour,{teamId:'b',
    finisherId:'b-0',nomineeId:'b-2',launchIntent:'standard'});
  const source=tour.frames[38];
  assert.equal(probe.sourceKm,39);
  assert.equal(probe.sourceTuningVersion,tour.tuningVersion);
  assert.equal(probe.recording.workerRiderId,'b-2');
  assert.equal(probe.input.riderStates.find(state=>state.riderId==='b-2').energy,
    source.riderGroups.find(state=>state.id==='b-2').energy);
  assert.equal(probe.input.riderStates.find(state=>state.riderId==='b-2').roadGroupId,
    'peloton');
  assert.equal(validateFinaleLeadOutPull(probe.input,probe.recording),true);
  assert.deepEqual(tour,original);
  assert.throws(()=>probeFinaleLeadOutFromTour(tour,{teamId:'b',
    finisherId:'a-0',launchIntent:'standard'}),/locked team and finisher/);
});

test('two genuinely engaged rival teams supply a reproducible relay probe',()=>{
  const tour=simulateTacticalTour({...input,seed:'relay-snap',teams:[
    input.teams[0],
    team('b','protect',{attack:'none',chase:'selective'}),
    team('c','protect',{attack:'none',chase:'selective'}),
  ]});
  const frame=tour.frames[34];
  assert.deepEqual(frame.roadGroups.map(group=>group.riderIds),[['a-2']]);
  assert.deepEqual(frame.engagedChaseTeamIds,['b','c']);
  const rotation=finaleDistanceGrid(tour.route).map((_,index)=>
    index%2?'c-2':'b-2');
  const probe=probeFinaleRelayFromTour(tour,{frontRiderId:'a-2',
    chaseRiderIds:['b-2','c-2'],rotation});
  assert.equal(probe.sourceKm,35);
  assert.deepEqual(probe.sourceWarnings,['residual_gap_after_sufficient_chase']);
  assert.equal(probe.input.initialGapSeconds,frame.roadGroups[0].gapSeconds);
  assert.deepEqual(probe.input.chasers.map(chaser=>chaser.energy),
    ['b-2','c-2'].map(id=>frame.riderGroups.find(rider=>rider.id===id).energy));
  assert.equal(validateFinaleRelay(probe.input,probe.recording),true);
  assert.throws(()=>probeFinaleRelayFromTour(tour,{frontRiderId:'a-2',
    chaseRiderIds:['b-2','b-2'],rotation}),/two different/);
  assert.throws(()=>probeFinaleRelayFromTour(tour,{frontRiderId:'a-2',
    chaseRiderIds:['b-2','a-3'],rotation}),/engaged in the bunch chase/);
});

test('independent chasing teams rotate paid pulls through a group catch and finish',()=>{
  const tour=simulateTacticalTour({...input,seed:'group-rotation',teams:[
    input.teams[0],
    team('b','protect',{attack:'none',chase:'selective'}),
    team('c','protect',{attack:'none',chase:'selective'}),
  ]});
  assert.deepEqual(tour.frames[34].engagedChaseTeamIds,['b','c']);
  const rotation=finaleDistanceGrid(tour.route).map((_,index)=>
    index%2?'c-2':'b-2');
  const probe=probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2',
    chaseRotationRiderIds:rotation});
  const fixed=probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2'}).recording;
  assert.equal(probe.recording.version,'v2-finale-group-run-3');
  assert.deepEqual(probe.recording.chaseRotationRiderIds,rotation);
  assert.equal(validateFinaleGroupRun(probe.input,probe.recording),true);
  const remaining=(recording,id)=>recording.frames.at(-1).riders.find(rider=>
    rider.riderId===id).energy;
  assert.ok(remaining(probe.recording,'b-2')>remaining(fixed,'b-2'));
  assert.ok(remaining(probe.recording,'c-2')<remaining(fixed,'c-2'));
  const first=probe.recording.frames[0];
  assert.equal(first.chasePullRiderId,'b-2');
  assert.equal(first.riders.find(rider=>rider.riderId==='c-2').role,
    'sheltered');
  const trial=structuredClone(probe.input);
  trial.snapshot.roadGroups[0].gapSeconds=1;
  trial.teams[0].riders.find(rider=>rider.id==='a-2').timetrial=30;
  for(const id of ['b','c'])trial.teams.find(team=>team.id===id)
    .riders.find(rider=>rider.id===`${id}-2`).strength=100;
  const recording=simulateFinaleGroupToLine(trial);
  assert.equal(recording.version,'v2-finale-group-to-line-3');
  assert.equal(recording.outcome,'caught_merged');
  assert.equal(recording.mergedFrames.at(-1).endDistanceM,40000);
  for(const frame of recording.mergedFrames){
    const index=finaleDistanceGrid(tour.route).findIndex(slice=>
      slice.startDistanceM<=frame.startDistanceM&&
      slice.endDistanceM>=frame.endDistanceM);
    assert.equal(frame.pullRiderId,rotation[index]);
    assert.ok(frame.riders.find(rider=>rider.riderId===frame.pullRiderId)
      .energySpent>0);
  }
  assert.equal(validateFinaleGroupToLine(trial,recording),true);
  const altered=structuredClone(recording);
  altered.mergedFrames.at(-1).pullRiderId='b-0';
  assert.throws(()=>validateFinaleGroupToLine(trial,altered),/differs/);
  assert.throws(()=>probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2',
    chaseRotationRiderIds:rotation.map((id,index)=>index===1?'a-3':id),
  }),/engaged in the bunch chase/);
  const slopeProbe=probeFinaleGroupRunFromTour(tour,{
    frontPullRiderId:'a-2',chasePullRiderId:'b-2',
    chaseRotationRiderIds:rotation,
    paceVersion:FINALE_WORKER_PASSIVE_SLOPE_VERSION});
  assert.equal(slopeProbe.recording.version,'v2-finale-group-run-4');
  assert.equal(slopeProbe.recording.workerPaceVersion,
    FINALE_WORKER_PASSIVE_SLOPE_VERSION);
  assert.equal(validateFinaleGroupRun(slopeProbe.input,slopeProbe.recording),true);
  assert.notEqual(slopeProbe.recording.finishGapSeconds,
    probe.recording.finishGapSeconds);
  const strongerChase=structuredClone(slopeProbe.input);
  for(const id of ['b','c'])strongerChase.teams.find(team=>team.id===id)
    .riders.find(rider=>rider.id===`${id}-2`).strength=100;
  assert.ok(simulateFinaleGroupRun(strongerChase).finishGapSeconds<
    slopeProbe.recording.finishGapSeconds);
  const tiredFront=structuredClone(slopeProbe.input);
  tiredFront.snapshot.riders.find(rider=>rider.riderId==='a-2').energy=10;
  assert.ok(simulateFinaleGroupRun(tiredFront).finishGapSeconds<
    slopeProbe.recording.finishGapSeconds);
  const slopeTrial=structuredClone(slopeProbe.input);
  slopeTrial.snapshot.roadGroups[0].gapSeconds=.1;
  slopeTrial.teams[0].riders.find(rider=>rider.id==='a-2').timetrial=30;
  for(const id of ['b','c'])slopeTrial.teams.find(team=>team.id===id)
    .riders.find(rider=>rider.id===`${id}-2`).strength=100;
  const slopeToLine=simulateFinaleGroupToLine(slopeTrial);
  assert.equal(slopeToLine.version,'v2-finale-group-to-line-4');
  assert.equal(slopeToLine.outcome,'caught_merged');
  assert.equal(slopeToLine.mergedFrames.at(-1).endDistanceM,40000);
  assert.equal(validateFinaleGroupToLine(slopeTrial,slopeToLine),true);
});

test('a 300 km recording carries earned fatigue into the read-only finale',()=>{
  const distance=300;
  const longStage={distance_km:distance,profile_points:[[0,100],[distance,100]]};
  const makeLong=(id,late)=>({id,
    riders:Array.from({length:8},(_,index)=>({id:`${id}-${index}`,
      gender:'M',flat:late&&index===2?90:70,
      strength:late&&index===2?90:70,
      endurance:late&&index===2?90:70,
      timetrial:late&&index===2?100:70,sprint:50,leadership:50})),
    orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,preset:'protect',
      baseline:{attack:'none',effort:'conserve',
        chase:late?'ignore':'selective'},
      phases:late?[{atKm:270,attack:'repeated',attackRiderId:`${id}-2`,
        effort:'hard'}]:[]}});
  const tour=simulateTacticalTour({stage:longStage,
    teams:[makeLong('a',true),makeLong('b',false)],seed:'late-long'});
  const frame=tour.frames[294];
  assert.deepEqual(frame.roadGroups.map(group=>group.riderIds),[['a-2']]);
  const leader=frame.riderGroups.find(rider=>rider.id==='a-2');
  assert.ok(leader.energy>0&&leader.energy<50);
  const probe=probeFinalePairFromTour(tour,{
    frontRiderId:'a-2',chaseRiderId:'b-2'});
  assert.equal(probe.sourceKm,295);
  assert.equal(probe.input.front.energy,leader.energy);
  assert.deepEqual(probe.sourceWarnings,['residual_gap_after_sufficient_chase']);
  assert.equal(validateFinalePair(probe.input,probe.recording),true);
  // The current kilometre engine still leaves a residual positive gap here.
  // This test preserves the observed input, not its sporting correctness.
  assert.ok(frame.chasePower>0&&frame.passiveGapDelta>0&&
    frame.roadGroups[0].gapSeconds>0);
});
