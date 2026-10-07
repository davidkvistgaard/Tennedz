import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {contestFinaleNamedAttackSlice} from
  '../../lib/engine/v2/finale-named-attack-contest.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,chase,attack=false){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:65,strength:65,endurance:65,
    acceleration:75,repeatability:50,sprint:55,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`],preset:'balanced',
    baseline:{effort:'hard',chase,attack:'none',breakWork:'cooperate'},
    phases:attack?[{atKm:35,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('named launch competes with a locked independent paid chase',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a','ignore',true),team('b','all'),team('c','ignore')],
    seed:'finale-named-contest',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const teams=tour.committedInputs.teams;
  const slice=finaleDistanceGrid(tour.route,{remainingKm:4})
    .find(row=>row.sourceKm===40);
  const pelotonRiderIds=teams.flatMap(row=>row.riders.map(rider=>rider.id));
  const energies=new Map(pelotonRiderIds.map(id=>[id,40]));
  const input={slice,route:tour.route,teams,pelotonRiderIds,energies,
    attackerTeamId:'a',attackerRiderId:'a-0',repeatLoad:.92};
  const chased=contestFinaleNamedAttackSlice(input);
  const passive=contestFinaleNamedAttackSlice({...input,teams:teams.map(row=>
    row.id==='b'?{...row,orders:{...row.orders,
      baseline:{...row.orders.baseline,chase:'ignore'}}}:row)});
  assert.equal(chased.version,'v2-finale-named-attack-contest-1');
  assert.equal(chased.chase.riderId,'b-2');
  assert.ok(chased.chase.energySpent>0);
  assert.equal(chased.chase.energyAfter,40-chased.chase.energySpent);
  assert.equal(passive.chase,null);
  assert.ok(chased.bunchSpeedKph>=passive.bunchSpeedKph);
  assert.ok(chased.attack.earnedGapSeconds<=passive.attack.earnedGapSeconds);
  assert.equal(chased.attack.energyAtDecision,40);
  assert.notEqual(chased.chase.riderId,chased.attack.riderId);
  assert.throws(()=>contestFinaleNamedAttackSlice({...input,
    pelotonRiderIds:pelotonRiderIds.filter(id=>id!=='a-0')}),
  /must be present/);
  assert.throws(()=>contestFinaleNamedAttackSlice({...input,
    pelotonRiderIds:pelotonRiderIds.filter(id=>id!=='c-0')}),
  /one complete bunch/);
  assert.throws(()=>contestFinaleNamedAttackSlice({...input,
    teams:teams.map(row=>row.id==='b'?{...row,orders:{...row.orders,
      baseline:{...row.orders.baseline,chase:'selective'}}}:row)}),
  /selective chase/);
});
