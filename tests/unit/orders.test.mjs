import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultOrders,validateOrders,draftOrders,tacticalEffects} from '../../lib/race/orders.mjs';
import {buildRace} from '../../lib/race/cycle.mjs';
const ids=Array.from({length:8},(_,i)=>'a'+i);
test('orders reject foreign riders, wrong captain, unknown values and versions',()=>{
 for(const change of [o=>o.version=2,o=>o.plan='win',o=>o.riders.a1.role='captain',o=>o.riders.a0.role='helper',o=>o.riders.a1.effort='maximum',o=>o.riders.foreign={role:'free',effort:'balanced'},o=>delete o.riders.a2]){const o=defaultOrders(ids,'a0');change(o);assert.throws(()=>validateOrders(o,ids,'a0'));}
 assert.deepEqual(validateOrders(null,ids,'a0'),defaultOrders(ids,'a0'));
});
test('changing captain reconciles role and preserves individual effort',()=>{const o=defaultOrders(ids,'a0');o.riders.a1.effort='aggressive';const d=draftOrders(o,ids,'a1');assert.equal(d.riders.a0.role,'free');assert.equal(d.riders.a1.role,'captain');assert.equal(d.riders.a1.effort,'aggressive');});
function snapshot(){return {event:{id:'tactics',seed:'fixed',kind:'one_day',gender:'M',deadline:'2026-01-01',country_code:'FR',weather_locked:{temp_c:18,wind_kph:5,precipitation_mm:0,condition:'clear',wind_dir:'W'}},game_date:'2026-01-01',stage:{distance_km:140,tags:['FLAT']},teams:['a','b'].map(t=>({id:t,name:t,riders:ids.map((_,i)=>({id:t+i,name:t+i,gender:'M',sprint:50,flat:50,hills:50,mountain:50,cobbles:50,timetrial:50,endurance:50,strength:50,wind:50,form:70,fatigue:10})),entry:{selected_riders:ids.map((_,i)=>t+i),captain_id:t+'0'}}))};}
test('support costs helpers finish and fatigue while helping the captain',()=>{const s=snapshot(),t=s.teams[0],o=defaultOrders(ids,'a0');o.plan='captain';o.riders.a1.role='helper';const e=tacticalEffects(o,t.riders,'a0');assert.ok(e.a0.finish>1);assert.ok(e.a1.finish<1);assert.equal(e.a1.fatigueDelta,3);assert.equal(e.a1.attackWeight,0);});
test('saved plans change results and fatigue deterministically without changing seed ratings',()=>{
 const s=snapshot(),plain=buildRace(s);const o=defaultOrders(ids,'a0');o.plan='conserve';for(const r of Object.values(o.riders))r.effort='careful';s.teams[0].entry.orders=o;const changed=buildRace(s);assert.deepEqual(changed,buildRace(s));assert.notDeepEqual(plain.divisions[0].results,changed.divisions[0].results);const before=plain.divisions[0].results.find(r=>r.rider_id==='a0'),after=changed.divisions[0].results.find(r=>r.rider_id==='a0');assert.equal(before.after.fatigue-after.after.fatigue,9);assert.equal(plain.divisions[0].teams.find(t=>t.team_id==='a').seed_power,changed.divisions[0].teams.find(t=>t.team_id==='a').seed_power);assert.ok(changed.divisions[0].feed.some(f=>f.kind==='orders'));
});
