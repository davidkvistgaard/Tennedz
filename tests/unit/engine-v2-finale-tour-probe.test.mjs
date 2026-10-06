import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateFinalePair} from '../../lib/engine/v2/finale-pair.mjs';
import {probeFinalePairFromTour} from
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
