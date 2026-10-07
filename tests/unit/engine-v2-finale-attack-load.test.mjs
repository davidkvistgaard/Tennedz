import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';
import {finaleAttackLoadFromTour} from
  '../../lib/engine/v2/finale-attack-load.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';

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
