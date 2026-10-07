import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {advanceFinaleNamedAttackSlice} from
  '../../lib/engine/v2/finale-named-attack-step.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:10,kind:'SPRINT'},{km:20,kind:'SPRINT'}]};
function team(id,attack){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:65,strength:65,endurance:65,
    acceleration:75,repeatability:50,sprint:55,leadership:50,
  })),orders:{captainId:`${id}-0`,roadCaptainId:`${id}-1`,
    preset:'balanced',baseline:{effort:'hard',chase:'ignore',
      attack:'none',breakWork:'cooperate'},
    phases:attack?[{atKm:35,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('one due named launch pays attack and road work and earns only a measured slice gap',()=>{
  const tour=simulateTacticalTour({stage,
    teams:[team('a',true),team('b',false)],
    seed:'finale-named-slice',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const lockedTeam=tour.committedInputs.teams.find(row=>row.id==='a');
  const grid=finaleDistanceGrid(tour.route,{remainingKm:4});
  const slice=grid.find(row=>row.sourceKm===40);
  assert.equal(slice.lengthM,250);
  const input={slice,route:tour.route,team:lockedTeam,
    riderId:'a-0',energy:40,repeatLoad:.92};
  const escape=advanceFinaleNamedAttackSlice({...input,bunchSpeedKph:40});
  const contained=advanceFinaleNamedAttackSlice({...input,bunchSpeedKph:45});
  assert.equal(escape.version,'v2-finale-named-attack-step-1');
  assert.equal(escape.status,'split');
  assert.ok(escape.earnedGapSeconds>0&&escape.earnedGapSeconds<5);
  assert.equal(contained.status,'contained');
  assert.equal(contained.earnedGapSeconds,0);
  assert.equal(escape.repeatLoadAfter,1.92);
  assert.ok(escape.energySpent>0&&escape.energyAfter<40);
  assert.equal(escape.energySpent,contained.energySpent);
  assert.ok(escape.launchSeconds>0&&escape.frontSeconds>0);
  assert.equal(escape.bunchSeconds-escape.frontSeconds,
    escape.earnedGapSeconds);
  const fresh=advanceFinaleNamedAttackSlice({...input,repeatLoad:0,
    bunchSpeedKph:40});
  assert.ok(fresh.pressure>escape.pressure);
  assert.throws(()=>advanceFinaleNamedAttackSlice({...input,
    slice:grid.find(row=>row.sourceKm===39),bunchSpeedKph:35}),
  /not due/);
  assert.throws(()=>advanceFinaleNamedAttackSlice({...input,
    energy:10,bunchSpeedKph:35}),/not ready/);
  assert.throws(()=>advanceFinaleNamedAttackSlice({...input,
    slice:{...slice,endDistanceM:slice.endDistanceM+10,lengthM:260},
    bunchSpeedKph:40}),/grid slice/);
});
