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

test('guided preview rejects unbounded or unknown requests',()=>{
 for(const input of [{plan:'unknown',seed:0},{plan:'sprint',seed:-1},
  {plan:'sprint',seed:10000},{plan:'sprint',seed:'1'}])
  assert.throws(()=>createMotorLabPreview(input),/valid plan and scenario number/);
});
