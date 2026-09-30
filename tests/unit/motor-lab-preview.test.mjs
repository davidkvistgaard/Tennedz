import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorLabPreview} from '../../lib/engine/v2/preview.mjs';

test('guided preview is deterministic, complete and omits the engine tuning table',()=>{
 const first=createMotorLabPreview({plan:'break',seed:7});
 const again=createMotorLabPreview({plan:'break',seed:7});
 assert.deepEqual(first,again);
 assert.equal(first.kind,'fictional-motor-lab');
 assert.equal(first.frames.length,160);
 assert.equal(first.frames.at(-1).km,160);
 assert.equal(first.results.length,32);
 assert.equal(new Set(first.results.map(result=>result.name)).size,32);
 assert(first.frames.some(frame=>frame.groups.length));
 assert(first.frames.some(frame=>frame.moments.length));
 assert(!JSON.stringify(first).includes('chaseStrength'));
 assert(!JSON.stringify(first).includes('cooperationBonus'));
});

test('another committed plan can change the same seeded fictional race',()=>{
 const sprint=createMotorLabPreview({plan:'sprint',seed:5});
 const breakPlan=createMotorLabPreview({plan:'break',seed:5});
 assert.equal(sprint.seed,breakPlan.seed);
 assert.notEqual(sprint.plan,breakPlan.plan);
 assert.notDeepEqual(sprint.frames,breakPlan.frames);
});

test('advanced orders are committed and alter the same seeded race',()=>{
 const standard=createMotorLabPreview({plan:'break',seed:5});
 const advanced=createMotorLabPreview({plan:'break',seed:5,orders:{
  breakResponse:'chase_if_threatened',breakWork:'sit_on',lateEffort:'hard',
 }});
 assert.deepEqual(advanced.orders,{breakResponse:'chase_if_threatened',
  breakWork:'sit_on',lateEffort:'hard',breakAttackMarker:'none',roadCaptain:'standard'});
 assert(advanced.frames[120].moments.includes('Amber switched to hard effort'));
 assert(!standard.frames[120].moments.includes('Amber switched to hard effort'));
 assert.notDeepEqual(standard.frames,advanced.frames);
 assert.deepEqual(advanced,createMotorLabPreview({plan:'break',seed:5,orders:advanced.orders}));
});

test('road captain leadership changes a precommitted chase response',()=>{
 const standard=createMotorLabPreview({plan:'conserve',seed:1,orders:{breakResponse:'chase_if_threatened'}});
 const experienced=createMotorLabPreview({plan:'conserve',seed:1,orders:{
  breakResponse:'chase_if_threatened',roadCaptain:'experienced',
 }});
 const firstChase=recording=>recording.frames.find(frame=>
  frame.moments.includes('Amber road captain called a chase'))?.km;
 assert.equal(firstChase(standard),23);
 assert.equal(firstChase(experienced),22);
 assert(experienced.frames.filter(frame=>frame.chasingTeams.includes('Amber')).length>
  standard.frames.filter(frame=>frame.chasingTeams.includes('Amber')).length);
 assert.deepEqual(experienced,createMotorLabPreview({plan:'conserve',seed:1,orders:{
  breakResponse:'chase_if_threatened',roadCaptain:'experienced',
 }}));
});

test('a committed break attack can split a group or be visibly blocked',()=>{
 const split=createMotorLabPreview({plan:'break',seed:1,orders:{breakAttackMarker:'40'}});
 assert.equal(split.frames[40].groups.length,2);
 assert(split.frames[40].moments.includes('Amber Captain attacked from a break'));
 assert.deepEqual(split,createMotorLabPreview({plan:'break',seed:1,orders:{breakAttackMarker:'40'}}));
 const blocked=createMotorLabPreview({plan:'break',seed:1,orders:{breakAttackMarker:'120'}});
 assert(blocked.frames[120].moments.some(moment=>moment.includes('could not start: not in break')));
 assert.notDeepEqual(split.frames,blocked.frames);
});

test('guided preview rejects unbounded or unknown requests',()=>{
 for(const input of [{plan:'unknown',seed:0},{plan:'sprint',seed:-1},
  {plan:'sprint',seed:10000},{plan:'sprint',seed:'1'}])
  assert.throws(()=>createMotorLabPreview(input),/valid plan and scenario number/);
 for(const orders of [null,[],{breakWork:'freewheel'},{lateEffort:120},
  {breakAttackMarker:'41'},{breakAttackMarker:40},{roadCaptain:'legend'},{admin:true}])
  assert.throws(()=>createMotorLabPreview({plan:'sprint',seed:1,orders}),/valid advanced orders/);
});
