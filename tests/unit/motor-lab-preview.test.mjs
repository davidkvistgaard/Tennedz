import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotorLabPreview} from '../../lib/engine/v2/preview.mjs';

test('guided preview is deterministic, complete and omits the engine tuning table',()=>{
 const first=createMotorLabPreview({plan:'break',seed:7});
 const again=createMotorLabPreview({plan:'break',seed:7});
 assert.deepEqual(first,again);
 assert.equal(first.kind,'fictional-motor-lab');
 assert.equal(first.routeId,'coast');
 assert.equal(first.frames.length,160);
 assert.equal(first.frames.at(-1).km,160);
 assert.equal(first.results.length,32);
 assert.equal(new Set(first.results.map(result=>result.name)).size,32);
 assert(first.frames.some(frame=>frame.groups.length));
 assert(first.frames.some(frame=>frame.moments.length));
 assert(!JSON.stringify(first).includes('chaseStrength'));
 assert(!JSON.stringify(first).includes('cooperationBonus'));
});

test('two fixed routes preserve the seed but produce distinct recorded terrain',()=>{
 const coast=createMotorLabPreview({plan:'sprint',routeId:'coast',seed:1});
 const ridge=createMotorLabPreview({plan:'sprint',routeId:'ridge',seed:1});
 assert.equal(ridge.scenarioName,'Ridge Road laboratory');
 assert.equal(ridge.routeId,'ridge');
 assert.equal(ridge.frames.length,160);
 assert(ridge.frames.some(frame=>frame.terrain==='climb'));
 assert(ridge.frames.some(frame=>frame.terrain==='descent'));
 assert.equal(ridge.frames[34].elevationM,330);
 assert.equal(ridge.frames[34].gradientPct,5);
 assert(ridge.frames.every(frame=>Number.isFinite(frame.elevationM)&&
  Number.isFinite(frame.gradientPct)));
 assert(!coast.frames.some(frame=>frame.terrain==='climb'));
 assert(coast.frames.every(frame=>frame.elevationM<40));
 assert.notDeepEqual(coast.frames,ridge.frames);
 assert.deepEqual(ridge,createMotorLabPreview({plan:'sprint',routeId:'ridge',seed:1}));
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
 assert.deepEqual(advanced.orders,{chaseContribution:'follow_plan',breakResponse:'chase_if_threatened',
  breakWork:'sit_on',lateEffort:'hard',breakAttackMarker:'none',roadCaptain:'standard',captainSupport:'hold_position'});
 assert(advanced.frames[120].moments.includes('Amber switched to hard effort'));
 assert(!standard.frames[120].moments.includes('Amber switched to hard effort'));
 assert.notDeepEqual(standard.frames,advanced.frames);
 assert.deepEqual(advanced,createMotorLabPreview({plan:'break',seed:5,orders:advanced.orders}));
});

test('a reachable helper can support Amber Captain on the fixed ridge exercise',()=>{
 const common={plan:'sprint',seed:1,routeId:'ridge'};
 const alone=createMotorLabPreview(common);
 const supported=createMotorLabPreview({...common,orders:{captainSupport:'drop_back_if_dropped'}});
 assert.equal(alone.frames.filter(frame=>frame.amberCaptainDropped).length,7);
 assert.equal(supported.frames.filter(frame=>frame.amberCaptainDropped).length,2);
 assert(supported.frames.some(frame=>frame.moments.some(moment=>
  /helped Amber Captain recover \d+\.\d s/.test(moment))));
 assert.equal(alone.results.find(result=>result.name==='Amber Captain').position,
  supported.results.find(result=>result.name==='Amber Captain').position);
 assert.deepEqual(supported,createMotorLabPreview({...common,orders:supported.orders}));
 const attackPlan=createMotorLabPreview({...common,plan:'break'});
 assert.equal(attackPlan.frames.filter(frame=>frame.amberCaptainDropped).length,0);
});

test('road captain leadership changes a precommitted chase response',()=>{
 const standard=createMotorLabPreview({plan:'conserve',seed:1,orders:{breakResponse:'chase_if_threatened'}});
 const experienced=createMotorLabPreview({plan:'conserve',seed:1,orders:{
  breakResponse:'chase_if_threatened',roadCaptain:'experienced',
 }});
 const firstChase=recording=>recording.frames.find(frame=>
  frame.moments.some(moment=>moment.startsWith('Amber road captain called a chase')))?.km;
 assert.equal(firstChase(standard),23);
 assert.equal(firstChase(experienced),22);
 assert(standard.frames[22].moments.some(moment=>
  /called a chase with the leader 8\.2 s ahead/.test(moment)));
 assert(standard.frames[23].moments.includes(
  'Amber road captain ended the chase after the break was caught'));
 assert(experienced.frames.filter(frame=>frame.chasingTeams.includes('Amber')).length>
  standard.frames.filter(frame=>frame.chasingTeams.includes('Amber')).length);
 assert.deepEqual(experienced,createMotorLabPreview({plan:'conserve',seed:1,orders:{
  breakResponse:'chase_if_threatened',roadCaptain:'experienced',
 }}));
});

test('chase contribution changes Amber work without changing the seeded route',()=>{
 const common={plan:'sprint',seed:1,routeId:'coast'};
 const planned=createMotorLabPreview(common);
 const held=createMotorLabPreview({...common,orders:{chaseContribution:'ignore'}});
 const committed=createMotorLabPreview({...common,orders:{chaseContribution:'all'}});
 const amberChaseKm=recording=>recording.frames.filter(frame=>frame.chasingTeams.includes('Amber')).length;
 assert.equal(held.orders.chaseContribution,'ignore');
 assert.equal(amberChaseKm(held),0);
 assert(amberChaseKm(planned)>0);
 assert(held.frames.filter(frame=>frame.groups.length).length>
  committed.frames.filter(frame=>frame.groups.length).length);
 assert(held.frames.at(-1).amberEnergy>planned.frames.at(-1).amberEnergy);
 assert(planned.frames.at(-1).amberEnergy>committed.frames.at(-1).amberEnergy);
 assert.equal(held.routeId,committed.routeId);
 assert.deepEqual(held,createMotorLabPreview({...common,orders:held.orders}));
});

test('recording distinguishes a deliberate wait from teams represented up the road',()=>{
 const recording=createMotorLabPreview({plan:'sprint',seed:1});
 const frame=recording.frames[21];
 assert.equal(frame.km,22);
 assert.deepEqual(frame.chasingTeams,[]);
 assert.deepEqual(frame.waitingTeams,['Amber','Birch']);
 assert.deepEqual(frame.teamsUpRoad,['Cedar','Dune']);
 assert(recording.frames.every(item=>item.groups.length||!item.waitingTeams.length));
});

test('break episodes summarize only contiguous recorded kilometres',()=>{
 const recording=createMotorLabPreview({plan:'sprint',seed:1});
 assert.deepEqual(recording.episodes[0],{startKm:20,lastKm:25,
  peakGapSeconds:12.35,chasedKm:3,waitingKm:3,
  teams:['Cedar','Dune'],caughtAtKm:26});
 assert.equal(recording.episodes.reduce((total,episode)=>
  total+episode.lastKm-episode.startKm+1,0),
 recording.frames.filter(frame=>frame.groups.length).length);
 assert(recording.episodes.every((episode,index)=>index===0||
  recording.episodes[index-1].caughtAtKm<episode.startKm));
 const breakPlan=createMotorLabPreview({plan:'break',seed:1});
 assert.equal(breakPlan.episodes.at(-1).caughtAtKm,null);
 assert.equal(breakPlan.episodes.at(-1).lastKm,160);
});

test('recording distinguishes a failed bunch attack from a rider who got clear',()=>{
 const recording=createMotorLabPreview({plan:'sprint',seed:1});
 assert.deepEqual(recording.frames[4].attackAttempts,['Cedar Captain']);
 assert.deepEqual(recording.frames[4].attacksWithoutGap,['Cedar Captain']);
 assert.deepEqual(recording.frames[19].attacksWithoutGap,[]);
 assert(recording.frames[19].attackAttempts.includes('Cedar Captain'));
 assert(recording.frames[19].groups.some(group=>group.riders.includes('Cedar Captain')));
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
  {plan:'sprint',seed:10000},{plan:'sprint',seed:'1'},
  {plan:'sprint',seed:1,routeId:'outside'}])
  assert.throws(()=>createMotorLabPreview(input),/valid plan, route and scenario number/);
 for(const orders of [null,[],{breakWork:'freewheel'},{lateEffort:120},
  {breakAttackMarker:'41'},{breakAttackMarker:40},{roadCaptain:'legend'},
  {chaseContribution:'infinite'},{captainSupport:'teleport'},{admin:true}])
  assert.throws(()=>createMotorLabPreview({plan:'sprint',seed:1,orders}),/valid advanced orders/);
});
