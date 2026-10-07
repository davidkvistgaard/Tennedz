import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleNamedAttackTransition} from
  '../../lib/engine/v2/finale-named-attack-transition.mjs';
import {continueFinaleNamedAttackGroup,
  validateFinaleNamedAttackFollowup} from
  '../../lib/engine/v2/finale-named-attack-followup.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,chase,attack=false){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:id==='a'?70:85,
    timetrial:id==='a'?40:85,
    strength:id==='a'?60:85,endurance:65,
    acceleration:id==='a'?95:70,repeatability:70,
    sprint:55,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    helperIds:[`${id}-2`],preset:'balanced',
    baseline:{effort:'hard',chase,attack:'none',breakWork:'cooperate'},
    phases:attack?[{atKm:35,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('the adjacent slice continues a verified launch and accounts for catch work',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a','ignore',true),team('b','all')],
    seed:'finale-named-followup',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const teams=tour.committedInputs.teams;
  const pelotonRiderIds=teams.flatMap(row=>row.riders.map(rider=>rider.id));
  const energies=new Map(pelotonRiderIds.map(id=>[id,40]));
  const grid=finaleDistanceGrid(tour.route,{remainingKm:4});
  const slice=grid.find(row=>row.sourceKm===40);
  const launchInput={slice,route:tour.route,teams,
    pelotonRiderIds,energies,attackerTeamId:'a',
    attackerRiderId:'a-0',repeatLoad:0};
  const launch=advanceFinaleNamedAttackTransition(launchInput);
  assert.equal(launch.attack.status,'split');
  const input={launchInput,launch,slice:grid[grid.indexOf(slice)+1]};
  const followup=continueFinaleNamedAttackGroup(input);
  assert.equal(followup.chaseRiderId,'b-2');
  assert.ok(followup.catchDistanceM>input.slice.startDistanceM&&
    followup.catchDistanceM<input.slice.endDistanceM);
  assert.deepEqual(followup.roadGroups,[]);
  assert.equal(followup.pelotonRiderIds.length,16);
  assert.equal(followup.endDistanceM,input.slice.endDistanceM);
  assert.ok(followup.bunchElapsedSeconds>0);
  assert.equal(followup.riderEnergy.length,16);
  assert.ok(followup.riderEnergy.every(row=>row.energySpent>0&&
    row.energyAfter>=0));
  assert.equal(new Set(followup.riderEnergy.map(row=>row.riderId)).size,16);
  assert.ok(followup.riderEnergy.every(row=>
    row.energyAfter===row.energyAtDecision-row.energySpent));
  assert.equal(validateFinaleNamedAttackFollowup(input,followup),true);
  assert.throws(()=>validateFinaleNamedAttackFollowup(input,{
    ...followup,bunchElapsedSeconds:0}),/does not replay/);
  assert.throws(()=>continueFinaleNamedAttackGroup({...input,
    slice:grid[grid.indexOf(slice)+2]}),/adjacent/);
  assert.throws(()=>continueFinaleNamedAttackGroup({...input,
    launch:{...launch,roadGroups:[{...launch.roadGroups[0],
      gapSeconds:99}]}}),/does not replay/);
  const passiveTeams=teams.map(row=>row.id==='b'?{...row,
    riders:row.riders.map(rider=>({...rider,flat:50,
      timetrial:50,strength:50})),orders:{
      ...row.orders,baseline:{...row.orders.baseline,chase:'ignore'}}}:row);
  const passiveInput={...launchInput,teams:passiveTeams};
  const passiveLaunch=advanceFinaleNamedAttackTransition(passiveInput);
  const passive=continueFinaleNamedAttackGroup({launchInput:passiveInput,
    launch:passiveLaunch,slice:input.slice});
  assert.equal(passive.chaseRiderId,null);
  assert.equal(passive.catchDistanceM,null);
  assert.equal(passive.roadGroups.length,1);
  assert.ok(passive.roadGroups[0].gapSeconds>0);
});
