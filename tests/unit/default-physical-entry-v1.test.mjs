import test from 'node:test';
import assert from 'node:assert/strict';
import {planDefaultPhysicalEntryV1,
  validateDefaultTacticsV1} from
  '../../lib/race/default-physical-entry-v1.mjs';

const riders=Array.from({length:12},(_,index)=>({
  id:`r${index}`,gender:index===11?'F':'M',
  flat:70+index,sprint:80-index,hills:65+index,
  mountain:60+index,cobbles:60+index,
  endurance:70,leadership:60+index,
  form:70,fatigue:10,injury_until:null,
}));
const event={gender:'M'};
const stage={distance_km:180,tags:['FLAT']};
const gameDate='2026-02-19';
function team(entry={selected_riders:riders.slice(0,8).map(r=>r.id),
  captain_id:'r0'}){
  return {id:'team-1',riders:structuredClone(riders),entry};
}
function plan(options={}){
  return planDefaultPhysicalEntryV1({team:team(),event,stage,
    gameDate,...options});
}

test('keeps an entered lineup and chooses a versioned neutral tactic',()=>{
  const result=plan();
  assert.equal(result.lineupSource,'entered');
  assert.equal(result.tacticsSource,'game_ai');
  assert.equal(result.selectedRiders.length,8);
  assert.equal(result.captainId,'r0');
  assert.equal(result.orders.baseline.attack,'none');
  assert.equal(result.orders.baseline.frontWork,'rotate');
  assert.equal(result.stake.sportingGoal,'none');
  assert.equal(result.orders.helperIds.length,6);
});

test('uses a manager default lineup and tactic when entered lineup is absent',()=>{
  const savedLineup={selected_riders:riders.slice(1,9)
    .map(r=>r.id),captain_id:'r1'};
  const savedTactics={effort:'steady',chase:'all',
    attack:'selective',front_work:'sit_in',
    sporting_goal:'sprint_finish'};
  const result=plan({team:team({selected_riders:null,
    captain_id:null}),savedLineup,savedTactics});
  assert.equal(result.lineupSource,'manager_default');
  assert.equal(result.tacticsSource,'manager_default');
  assert.deepEqual(result.selectedRiders,savedLineup.selected_riders);
  assert.equal(result.orders.baseline.attackRiderId,'r1');
  assert.equal(result.stake.sportingGoal,'sprint_finish');
});

test('game AI chooses eligible riders when no valid default exists',()=>{
  const result=plan({team:team({selected_riders:null,
    captain_id:null}),savedLineup:{selected_riders:
      ['r11',...riders.slice(0,7).map(r=>r.id)],
    captain_id:'r11'}});
  assert.equal(result.lineupSource,'game_ai');
  assert.equal(result.selectedRiders.length,8);
  assert.ok(!result.selectedRiders.includes('r11'));
  assert.equal(result.captainId,result.selectedRiders[0]);
});

test('does not replace a completed manager lineup that later became invalid',()=>{
  const entered=team();
  entered.riders[0].injury_until='2026-03-01';
  assert.throws(()=>plan({team:entered}),
    /manager-selected lineup became ineligible/);
});

test('refuses a field with fewer than eight eligible riders',()=>{
  const entered=team({selected_riders:null,captain_id:null});
  entered.riders=entered.riders.slice(0,7);
  assert.throws(()=>plan({team:entered}),
    /fewer than eight eligible riders/);
});

test('rejects incomplete or unknown manager default fields',()=>{
  assert.throws(()=>validateDefaultTacticsV1({effort:'hard'}),
    /complete default race tactic/);
  assert.throws(()=>validateDefaultTacticsV1({effort:'hard',
    chase:'ignore',attack:'none',front_work:'rotate',
    sporting_goal:'win_gc'}),/complete default race tactic/);
});
