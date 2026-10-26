import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareV91Playtest} from '../../lib/engine/v2/playtest.mjs';
import {prepareV94RivalIntent} from
  '../../lib/engine/v2/playtest-rival-intent-v94.mjs';
import {simulateTacticalTour} from '../../lib/engine/v2/tour.mjs';
import {validateRecordedTour} from '../../lib/engine/v2/recording.mjs';
import {MOTOR_RACE_DYNAMICS_VERSION} from '../../lib/engine/v2/tuning.mjs';

test('v94 rival intent is seeded, inspectable and leaves explicit orders intact',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4,
    seed:'intent-1',attack:'none',chase:'selective',
    managerTactics:[{effort:'hard',attack:'none',chase:'all'}],
    managerTacticOverrides:[{teamId:'rival-3',effort:'hard',
      attack:'repeated',chase:'all'}]});
  const before=structuredClone(prepared.teams);
  const first=prepareV94RivalIntent({prepared,format:'one_day'});
  const again=prepareV94RivalIntent({prepared,format:'one_day'});
  assert.deepEqual(first,again);
  assert.deepEqual(prepared.teams,before);
  assert.equal(first.intent.length,4);
  assert.deepEqual(first.intent[1],{teamId:'rival-1',role:'control',
    source:'manager',baseline:{effort:'hard',attack:'none',chase:'all'}});
  assert.deepEqual(first.teams[1].orders.baseline,before[1].orders.baseline);
  assert.equal(first.intent[2].source,'generated');
  assert.deepEqual(first.intent[3],{teamId:'rival-3',role:'opportunistic',
    source:'manager',baseline:{effort:'hard',attack:'repeated',chase:'all'}});
  assert.deepEqual(first.raceContext.teamRoles,
    Object.fromEntries(first.intent.map(row=>[row.teamId,row.role])));
  const recording=simulateTacticalTour({stage:prepared.stage,
    weather:prepared.weather,teams:first.teams,seed:prepared.seed,
    motorVersion:MOTOR_RACE_DYNAMICS_VERSION,raceContext:first.raceContext});
  assert.equal(validateRecordedTour(recording),true);
  assert.deepEqual(recording.committedInputs.raceContext,first.raceContext);
  const committedRival=recording.committedInputs.teams.find(team=>
    team.id==='rival-1');
  for(const key of ['effort','attack','chase'])
    assert.equal(committedRival.orders.baseline[key],before[1].orders.baseline[key]);
});

test('v94 rival intent rejects incomplete stage context',()=>{
  const prepared=prepareV91Playtest({distanceKm:40,teamCount:4});
  assert.throws(()=>prepareV94RivalIntent({prepared,format:'stage'}),
    /Invalid race context/);
});
