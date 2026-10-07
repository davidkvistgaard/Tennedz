import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {finaleAttackLoadFromTour} from
  '../../lib/engine/v2/finale-attack-load.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {probeLastKmNamedAttackFromTour,
  validateLastKmNamedAttackFromTour} from
  '../../lib/engine/v2/finale-last-km-named-attack.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,attack=false){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:60,strength:60,endurance:60,
    acceleration:65,sprint:50,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    preset:'balanced',baseline:{effort:'conserve',chase:'ignore',
      attack:'none',breakWork:'cooperate'},
    phases:attack?[{atKm:35,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('a recorded named attack enters the short-step boundary with repeat load',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a',true),team('b')],seed:'attack-load-handoff',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  assert.ok(tour.frames[35].attackers.includes('a-0'));
  const before=finaleAttackLoadFromTour(tour,35);
  const atHandoff=finaleAttackLoadFromTour(tour,36);
  const next=finaleAttackLoadFromTour(tour,37);
  const previousSnapshot=finaleSnapshotFromTour(tour,{remainingKm:4});
  const fiveKmSnapshot=finaleSnapshotFromTour(tour,{
    remainingKm:5,includeAttackLoad:true});
  const attackSnapshot=finaleSnapshotFromTour(tour,{
    remainingKm:4,includeAttackLoad:true});
  assert.equal(previousSnapshot.version,'v2-finale-snapshot-2');
  assert.equal(previousSnapshot.riderAttackLoads,undefined);
  assert.equal(attackSnapshot.version,'v2-finale-snapshot-attack-load-3');
  assert.equal(attackSnapshot.sourceKm,36);
  assert.equal(attackSnapshot.attackLoadVersion,
    'v2-finale-attack-load-handoff-1');
  assert.deepEqual(attackSnapshot.riderAttackLoads,atHandoff.riderLoads);
  assert.equal(fiveKmSnapshot.sourceKm,35);
  assert.deepEqual(fiveKmSnapshot.riderAttackLoads,before.riderLoads);
  assert.equal(atHandoff.version,'v2-finale-attack-load-handoff-1');
  assert.equal(before.riderLoads.find(row=>row.riderId==='a-0').load,0);
  assert.equal(atHandoff.riderLoads.find(row=>row.riderId==='a-0').load,1);
  assert.equal(next.riderLoads.find(row=>row.riderId==='a-0').load,.98);
  assert.ok(next.riderLoads.filter(row=>row.load>0)
    .every(row=>row.riderId==='a-0'));
  assert.throws(()=>finaleAttackLoadFromTour(tour,0),/source kilometre/);
  assert.throws(()=>finaleAttackLoadFromTour(tour,41),/source kilometre/);
  const forged=structuredClone(tour);
  forged.frames[35].attackers=[];
  assert.throws(()=>finaleAttackLoadFromTour(forged,36));
});

test('last-kilometre handoff uses the actual penultimate frame and carries attack load',()=>{
  const lateStage={...stage,keypoints:[...stage.keypoints,
    {km:39,kind:'SPRINT'}]};
  const lateAttacker=team('a');
  lateAttacker.orders.phases=[{atKm:39,attack:'selective',
    attackRiderId:'a-0'}];
  const tour=simulateTacticalTour({stage:lateStage,
    teams:[lateAttacker,team('b')],seed:'last-km-handoff',
    motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  assert.equal(source.version,'v2-finale-snapshot-last-km-4');
  assert.equal(source.sourceKm,39);
  assert.equal(source.startDistanceM,39000);
  assert.equal(source.remainingM,1000);
  assert.equal(source.sourceTuningVersion,tour.tuningVersion);
  assert.equal(source.roadGroups.length,0);
  assert.equal(source.droppedRiderIds.length,0);
  assert.equal(source.peloton.riderIds.length,16);
  assert.deepEqual(source.riderAttackLoads,
    finaleAttackLoadFromTour(tour,39).riderLoads);
  assert.deepEqual(source.riders.map(row=>row.energy),
    tour.frames[38].riderGroups.map(row=>row.energy));
  assert.equal(source.riderAttackLoads.find(row=>
    row.riderId==='a-0').load,0);
  assert.throws(()=>finaleSnapshotFromTour(tour,{remainingKm:1}),
    /needs recorded attack load/);
  assert.equal(finaleSnapshotFromTour(tour,{remainingKm:4}).version,
    'v2-finale-snapshot-2');
  const probe=probeLastKmNamedAttackFromTour(tour,{teamId:'a'});
  assert.equal(probe.version,'v2-finale-last-km-named-attack-1');
  assert.equal(probe.sourceSnapshotVersion,source.version);
  assert.equal(probe.energyAtDecision,
    source.riders.find(row=>row.riderId==='a-0').energy);
  assert.equal(probe.sourceRepeatLoad,0);
  assert.equal(probe.repeatLoad,0);
  assert.equal(probe.transition.startDistanceM,39000);
  assert.equal(probe.transition.riderEnergy.length,16);
  assert.equal(validateLastKmNamedAttackFromTour(tour,
    {teamId:'a'},probe),true);
  assert.throws(()=>validateLastKmNamedAttackFromTour(tour,
    {teamId:'a'},{...probe,energyAtDecision:-1}),/does not replay/);
  assert.throws(()=>probeLastKmNamedAttackFromTour(tour,
    {teamId:'b'}),/needs a named rider/);
  const olderTour=simulateTacticalTour({stage:lateStage,
    teams:[lateAttacker,team('b')],seed:'last-km-handoff'});
  assert.throws(()=>probeLastKmNamedAttackFromTour(olderTour,
    {teamId:'a'}),/needs a v91 source/);
});
