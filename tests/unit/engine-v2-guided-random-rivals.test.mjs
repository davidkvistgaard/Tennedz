import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveRandomRivalTactics} from
  '../../lib/engine/v2/playtest-rival-random.mjs';
import {createV91Playtest} from '../../lib/engine/v2/playtest.mjs';

test('guided random rivals vary by draw and commit an active attacker',()=>{
  const first=resolveRandomRivalTactics({teamCount:4,random:()=>0});
  const second=resolveRandomRivalTactics({teamCount:4,random:()=>.8});
  assert.notDeepEqual(first,second);
  for(const tactics of [first,second]){
    assert.equal(tactics.length,3);
    assert.ok(tactics.some(row=>row.attack==='repeated'));
    assert.ok(tactics.some(row=>row.attack==='selective'));
    const race=createV91Playtest({distanceKm:40,teamCount:4,
      attack:'none',seed:'sample-flat-finish',managerTactics:tactics});
    assert.ok(race.recording.frames.some(frame=>frame.attackers.length));
    assert.ok(race.recording.frames.some(frame=>frame.roadGroups.length));
    assert.deepEqual(race.settings.managerTactics,tactics);
  }
});

test('guided random rivals preserve explicitly managed teams',()=>{
  const custom={effort:'hard',attack:'none',chase:'all'};
  const named={teamId:'rival-3',effort:'conserve',attack:'none',
    chase:'ignore'};
  const tactics=resolveRandomRivalTactics({teamCount:4,
    customTactics:[custom],overrides:[named],random:()=>.5});
  assert.deepEqual(tactics[0],custom);
  assert.deepEqual(tactics[2],{effort:'conserve',attack:'none',chase:'ignore'});
  assert.equal(tactics[1].attack,'repeated');
});

test('ten fresh default draws record front groups without changing your orders',()=>{
  const variants=[];
  for(let draw=0;draw<10;draw++){
    let calls=0;
    const managerTactics=resolveRandomRivalTactics({teamCount:4,
      random:()=>((draw*7+(++calls)*3)%17)/17});
    variants.push(JSON.stringify(managerTactics));
    const race=createV91Playtest({distanceKm:40,teamCount:4,
      effort:'steady',attack:'none',chase:'selective',
      seed:'sample-flat-finish',managerTactics});
    assert.ok(race.recording.frames.some(frame=>frame.roadGroups.length),
      `draw ${draw} should record a front group`);
    assert.equal(race.recording.committedInputs.teams.find(team=>
      team.id==='you').orders.baseline.attack,'none');
  }
  assert.ok(new Set(variants).size>=3);
});
