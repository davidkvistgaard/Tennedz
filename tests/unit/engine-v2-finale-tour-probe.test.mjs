import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateFinalePair} from '../../lib/engine/v2/finale-pair.mjs';
import {validateFinaleRelay} from '../../lib/engine/v2/finale-relay.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {validateFinaleLeadOutPull} from '../../lib/engine/v2/finale-lead-out-pull.mjs';
import {probeFinalePairFromTour,probeFinaleRelayFromTour,
  probeFinaleLeadOutFromTour} from
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
