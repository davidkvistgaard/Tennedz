import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {finaleSnapshotFromTour,FINALE_SNAPSHOT_VERSION} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {advanceFinaleGroupStep} from '../../lib/engine/v2/finale-group-step.mjs';
import {validateFinalePair} from '../../lib/engine/v2/finale-pair.mjs';
import {validateFinaleRelay} from '../../lib/engine/v2/finale-relay.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {validateFinaleLeadOutPull} from '../../lib/engine/v2/finale-lead-out-pull.mjs';
import {probeFinalePairFromTour,probeFinaleRelayFromTour,
  probeFinaleLeadOutFromTour,probeFinaleGroupStepFromTour} from
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
