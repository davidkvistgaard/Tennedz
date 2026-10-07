import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {finaleSnapshotFromTour} from
  '../../lib/engine/v2/finale-snapshot.mjs';
import {finaleDistanceGrid} from '../../lib/engine/v2/finale-grid.mjs';
import {recordFinaleFrontRotationSlice,
  validateFinaleFrontRotationSlice} from
  '../../lib/engine/v2/finale-front-rotation-slice.mjs';
import {MOTOR_ATTACK_TRACE_VERSION} from '../../lib/engine/v2/tuning.mjs';

const stage={distance_km:40,profile_points:[[0,100],[40,100]],
  keypoints:[{km:39,kind:'SPRINT'}]};
function team(id,skill,{attack=false,rotate=false}={}){
  return {id,riders:Array.from({length:8},(_,index)=>({
    id:`${id}-${index}`,gender:'M',flat:skill,strength:skill,
    timetrial:skill,endurance:75,acceleration:70,sprint:70,
    leadership:60})),orders:{captainId:`${id}-0`,
    roadCaptainId:`${id}-1`,helperIds:[`${id}-2`,`${id}-3`],
    preset:'balanced',baseline:{effort:'steady',chase:'ignore',
      attack:'none',breakWork:'cooperate',
      frontWork:rotate?'rotate':'sit_in'},
    phases:attack?[{atKm:39,attack:'selective',
      attackRiderId:`${id}-0`}]:[]}};
}

test('independent rotating managers supply one affordable paid pair per slice',()=>{
  const tour=simulateTacticalTour({stage,teams:[
    team('a',60,{attack:true}),team('b',80,{rotate:true}),
    team('c',75,{rotate:true})],
  seed:'rotation-last-km',motorVersion:MOTOR_ATTACK_TRACE_VERSION});
  const source=finaleSnapshotFromTour(tour,{remainingKm:1,
    includeAttackLoad:true});
  assert.equal(source.sourceKm,39);
  const slices=finaleDistanceGrid(tour.route,{remainingKm:1});
  const input={route:tour.route,teams:tour.committedInputs.teams,
    pelotonRiderIds:source.peloton.riderIds,
    energies:new Map(source.riders.map(row=>[row.riderId,row.energy])),
    busyTeamIds:['a']};
  const first=recordFinaleFrontRotationSlice({...input,slice:slices[0]});
  const second=recordFinaleFrontRotationSlice({...input,slice:slices[1]});
  assert.deepEqual(first.eligibleTeamIds,['b','c']);
  assert.equal(first.selected.teamId,'b');
  assert.equal(second.selected.teamId,'c');
  assert.ok(first.selected.work.every(row=>row.energySpent>0&&
    row.energyAfter<row.energyAtDecision));
  assert.equal(new Set(first.selected.riderIds).size,2);
  assert.ok(first.bunchSpeedKph>=first.passiveBunchSpeedKph);
  assert.equal(validateFinaleFrontRotationSlice({...input,
    slice:slices[0]},first),true);
  assert.throws(()=>validateFinaleFrontRotationSlice({...input,
    slice:slices[0]},{...first,selected:{...first.selected,
      work:first.selected.work.map(row=>({...row,energySpent:0}))}}),
  /does not replay/);
  const busy=recordFinaleFrontRotationSlice({...input,
    slice:slices[0],busyTeamIds:['a','b']});
  assert.deepEqual(busy.eligibleTeamIds,['c']);
  assert.equal(busy.selected.teamId,'c');
  const tiredEnergy=new Map(input.energies);
  tiredEnergy.set('b-2',0);
  const tired=recordFinaleFrontRotationSlice({...input,
    slice:slices[0],energies:tiredEnergy});
  assert.deepEqual(tired.eligibleTeamIds,['c']);
  assert.equal(tired.selected.teamId,'c');
  assert.throws(()=>recordFinaleFrontRotationSlice({...input,
    slice:slices[0],busyTeamIds:['b','b']}),/distinct teams/);
  assert.throws(()=>recordFinaleFrontRotationSlice({...input,
    slice:{...slices[0],lengthM:1}}),/canonical slice/);
});
