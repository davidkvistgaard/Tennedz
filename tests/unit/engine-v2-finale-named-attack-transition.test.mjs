import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleNamedAttackTransition,
  validateFinaleNamedAttackTransition} from
  '../../lib/engine/v2/finale-named-attack-transition.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,chase,attack=false){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:id==='a'?80:55,
    strength:65,endurance:65,acceleration:id==='a'?95:50,
    repeatability:70,sprint:55,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`],preset:'balanced',
    baseline:{effort:'hard',chase,attack:'none',breakWork:'cooperate'},
    phases:attack?[{atKm:35,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('a successful named launch records one road group and one energy payment per rider',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a','ignore',true),team('b','all')],
    seed:'finale-named-transition',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const teams=tour.committedInputs.teams;
  const pelotonRiderIds=teams.flatMap(row=>row.riders.map(rider=>rider.id));
  const energies=new Map(pelotonRiderIds.map(id=>[id,40]));
  const slice=finaleDistanceGrid(tour.route,{remainingKm:4})
    .find(row=>row.sourceKm===40);
  const input={slice,route:tour.route,teams,pelotonRiderIds,energies,
    attackerTeamId:'a',attackerRiderId:'a-0',repeatLoad:0};
  const frame=advanceFinaleNamedAttackTransition(input);
  assert.equal(frame.version,'v2-finale-named-attack-transition-1');
  assert.equal(frame.attack.status,'split');
  assert.equal(frame.roadGroups.length,1);
  assert.deepEqual(frame.roadGroups[0].riderIds,['a-0']);
  assert.equal(frame.roadGroups[0].gapSeconds,
    frame.attack.earnedGapSeconds);
  assert.equal(frame.pelotonRiderIds.length,15);
  assert.equal(frame.riderEnergy.length,16);
  assert.equal(new Set(frame.riderEnergy.map(row=>row.riderId)).size,16);
  assert.deepEqual(frame.riderEnergy.filter(row=>row.role==='attack')
    .map(row=>row.riderId),['a-0']);
  assert.deepEqual(frame.riderEnergy.filter(row=>row.role==='chase')
    .map(row=>row.riderId),['b-2']);
  assert.ok(frame.riderEnergy.every(row=>row.energySpent>0&&
    row.energyAfter===40-row.energySpent));
  assert.equal(energies.get('a-0'),40);
  const repeat=advanceFinaleNamedAttackTransition(input);
  assert.deepEqual(repeat,frame);
  assert.equal(validateFinaleNamedAttackTransition(input,frame),true);
  assert.throws(()=>validateFinaleNamedAttackTransition(input,{
    ...frame,roadGroups:[{...frame.roadGroups[0],gapSeconds:99}]}),
  /does not replay/);
  const containedTeams=teams.map(row=>({...row,riders:row.riders.map(rider=>
    ({...rider,flat:row.id==='a'?20:95,
      acceleration:row.id==='a'?20:95,
      strength:row.id==='a'?20:95}))}));
  const contained=advanceFinaleNamedAttackTransition({...input,
    teams:containedTeams,repeatLoad:3});
  assert.equal(contained.attack.status,'contained');
  assert.deepEqual(contained.roadGroups,[]);
  assert.deepEqual(contained.pelotonRiderIds,pelotonRiderIds);
  assert.equal(contained.riderEnergy.length,16);
});
